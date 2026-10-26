import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  RepartidorEntity,
  PedidoEntity,
  MovimientoBilleteraEntity,
  LiquidacionEntity,
  EventoSalidaEntity,
  DetallePedidoEntity,
  ProductoEntity,
  ConfiguracionEntity,
} from "@zero-delivery/database";
import { ActorContext, formatPen } from "@zero-delivery/shared-types";
import { evaluateRiderEligibility } from "./rider-eligibility";

@Injectable()
export class LogisticsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Obtiene la lista de repartidores con su estado y vehículo.
   */
  async getRiders(actor: ActorContext): Promise<RepartidorEntity[]> {
    const riderRepo = this.dataSource.getRepository(RepartidorEntity);
    return riderRepo.find({
      where: { inquilino_id: actor.tenantId, esta_activo: true },
      order: { nombre_completo: "ASC" },
    });
  }

  /**
   * Obtiene el saldo neto y estado de garantía de un repartidor a partir del libro mayor.
   */
  async getRiderWalletBalance(
    actor: ActorContext,
    riderId: string
  ): Promise<{
    repartidor_id: string;
    saldo_centavos: string;
    saldo_soles: string;
    tiene_deuda: boolean;
    movimientos: MovimientoBilleteraEntity[];
  }> {
    const movRepo = this.dataSource.getRepository(MovimientoBilleteraEntity);
    const movimientos = await movRepo.find({
      where: { repartidor_id: riderId, inquilino_id: actor.tenantId },
      order: { creado_en: "DESC" },
    });

    let totalCentavos = BigInt(0);
    for (const mov of movimientos) {
      totalCentavos += BigInt(mov.monto_centavos);
    }

    return {
      repartidor_id: riderId,
      saldo_centavos: totalCentavos.toString(),
      saldo_soles: formatPen(totalCentavos),
      tiene_deuda: totalCentavos < BigInt(0),
      movimientos,
    };
  }

  /**
   * Asignación manual de repartidor validando elegibilidad, vehículo y saldo.
   */
  async assignRiderToOrder(
    actor: ActorContext,
    orderId: string,
    riderId: string
  ): Promise<PedidoEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pedidoRepo = queryRunner.manager.getRepository(PedidoEntity);
      const riderRepo = queryRunner.manager.getRepository(RepartidorEntity);
      const detalleRepo = queryRunner.manager.getRepository(DetallePedidoEntity);
      const prodRepo = queryRunner.manager.getRepository(ProductoEntity);
      const outboxRepo = queryRunner.manager.getRepository(EventoSalidaEntity);
      const configRepo = queryRunner.manager.getRepository(ConfiguracionEntity);

      const pedido = await pedidoRepo
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .where("p.id = :orderId AND p.inquilino_id = :tenantId", {
          orderId,
          tenantId: actor.tenantId,
        })
        .getOne();

      if (!pedido) {
        throw new NotFoundException("Pedido no encontrado");
      }

      const rider = await riderRepo.findOne({
        where: { id: riderId, inquilino_id: actor.tenantId },
      });

      if (!rider) {
        throw new NotFoundException("Repartidor no encontrado");
      }

      // Comprobar si los productos del pedido son frágiles
      const detalles = await detalleRepo.find({
        where: { pedido_id: pedido.id },
      });

      let tieneItemsFragiles = false;
      for (const d of detalles) {
        const prod = await prodRepo.findOne({
          where: { id: d.producto_id, inquilino_id: actor.tenantId },
        });
        if (prod?.es_fragil) {
          tieneItemsFragiles = true;
          break;
        }
      }

      // Calcular saldo de billetera actual del repartidor
      const walletInfo = await this.getRiderWalletBalance(actor, riderId);
      const saldoCentavos = BigInt(walletInfo.saldo_centavos);

      // Parámetros de garantía configurables
      const configGarantia = await configRepo.findOne({
        where: { inquilino_id: actor.tenantId, clave: "monto_minimo_garantia_centavos" },
      });
      const minGarantia = configGarantia ? BigInt(String(configGarantia.valor)) : BigInt(5000);

      const elegibilidad = evaluateRiderEligibility({
        rider,
        saldoCentavos,
        esPedidoEfectivo: pedido.metodo_pago === "EFECTIVO",
        tieneItemsFragiles,
        minimoGarantiaCentavos: minGarantia,
      });

      if (!elegibilidad.elegible) {
        throw new BadRequestException(
          `Repartidor no elegible: ${elegibilidad.motivos.join(". ")}`
        );
      }

      pedido.repartidor_id = rider.id;
      if (
        pedido.estado_operativo === "LISTO" ||
        pedido.estado_operativo === "CONFIRMADO"
      ) {
        pedido.estado_operativo = "REPARTIDOR_ASIGNADO";
      }

      rider.estado = "OCUPADO";
      await riderRepo.save(rider);
      const pedidoGuardado = await pedidoRepo.save(pedido);

      // Evento de integración
      const outbox = outboxRepo.create({
        inquilino_id: actor.tenantId,
        tipo: "REPARTIDOR_ASIGNADO",
        datos: {
          pedido_id: pedido.id,
          repartidor_id: rider.id,
          nombre_repartidor: rider.nombre_completo,
        },
        estado: "PENDIENTE",
      });
      await outboxRepo.save(outbox);

      await queryRunner.commitTransaction();
      return pedidoGuardado;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Registro del cobro en efectivo contra entrega por parte del repartidor.
   * Crea un asiento contable en el libro mayor movimientos_billetera con signo negativo
   * (reduciendo el saldo o aumentando la deuda temporal del repartidor hasta la liquidación).
   */
  async collectCashOnDelivery(
    actor: ActorContext,
    orderId: string
  ): Promise<{ pedido: PedidoEntity; movimiento: MovimientoBilleteraEntity }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pedidoRepo = queryRunner.manager.getRepository(PedidoEntity);
      const movRepo = queryRunner.manager.getRepository(MovimientoBilleteraEntity);
      const outboxRepo = queryRunner.manager.getRepository(EventoSalidaEntity);

      const pedido = await pedidoRepo
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .where("p.id = :orderId AND p.inquilino_id = :tenantId", {
          orderId,
          tenantId: actor.tenantId,
        })
        .getOne();

      if (!pedido) {
        throw new NotFoundException("Pedido no encontrado");
      }

      if (pedido.metodo_pago !== "EFECTIVO") {
        throw new BadRequestException("Este pedido no es de pago en efectivo");
      }

      if (!pedido.repartidor_id) {
        throw new BadRequestException("El pedido no tiene repartidor asignado");
      }

      const totalCentavos = BigInt(pedido.total_centavos);
      // El signo para EFECTIVO_COBRADO es NEGATIVO por el CHECK constraint
      const montoNegativo = -totalCentavos;

      const movimiento = movRepo.create({
        inquilino_id: actor.tenantId,
        repartidor_id: pedido.repartidor_id,
        tipo: "EFECTIVO_COBRADO",
        monto_centavos: montoNegativo.toString(),
        pedido_id: pedido.id,
        actor_id: actor.userId,
        motivo: `Cobro en efectivo contra entrega de pedido #${pedido.numero}`,
      });
      const movGuardado = await movRepo.save(movimiento);

      pedido.efectivo_por_cobrar_centavos = "0";
      pedido.estado_pago = "PAGADO";
      const pedidoGuardado = await pedidoRepo.save(pedido);

      const outbox = outboxRepo.create({
        inquilino_id: actor.tenantId,
        tipo: "EFECTIVO_COBRADO",
        datos: {
          pedido_id: pedido.id,
          repartidor_id: pedido.repartidor_id,
          monto_centavos: totalCentavos.toString(),
        },
        estado: "PENDIENTE",
      });
      await outboxRepo.save(outbox);

      await queryRunner.commitTransaction();
      return { pedido: pedidoGuardado, movimiento: movGuardado };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Depósito inicial de garantía en el libro mayor para habilitar cobros en efectivo.
   */
  async depositGuarantee(
    actor: ActorContext,
    riderId: string,
    montoCentavos: string,
    motivo?: string
  ): Promise<MovimientoBilleteraEntity> {
    const movRepo = this.dataSource.getRepository(MovimientoBilleteraEntity);
    const monto = BigInt(montoCentavos);

    if (monto <= BigInt(0)) {
      throw new BadRequestException("El monto de garantía debe ser positivo");
    }

    const mov = movRepo.create({
      inquilino_id: actor.tenantId,
      repartidor_id: riderId,
      tipo: "DEPOSITO_GARANTIA",
      monto_centavos: monto.toString(),
      actor_id: actor.userId,
      motivo: motivo ?? "Depósito de garantía inicial",
    });

    return movRepo.save(mov);
  }

  /**
   * Cierre diario de liquidación y recepción de efectivo del repartidor.
   */
  async confirmSettlement(
    actor: ActorContext,
    riderId: string,
    fechaOperativa: string,
    efectivoRecibidoCentavos: string,
    tarifaPagableCentavos: string,
    motivoAjuste?: string
  ): Promise<LiquidacionEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const liqRepo = queryRunner.manager.getRepository(LiquidacionEntity);
      const movRepo = queryRunner.manager.getRepository(MovimientoBilleteraEntity);

      const efectivoRecibido = BigInt(efectivoRecibidoCentavos);
      const tarifaPagable = BigInt(tarifaPagableCentavos);

      const liquidacion = liqRepo.create({
        inquilino_id: actor.tenantId,
        repartidor_id: riderId,
        fecha_operativa: fechaOperativa,
        corte_en: new Date(),
        efectivo_recibido_centavos: efectivoRecibido.toString(),
        tarifa_repartidor_referencia_centavos: tarifaPagable.toString(),
        tarifa_repartidor_pagable_centavos: tarifaPagable.toString(),
        motivo_ajuste_tarifa_repartidor: motivoAjuste ?? null,
        estado: "CONFIRMADO",
        confirmado_por: actor.userId,
        confirmado_en: new Date(),
      });

      const liqGuardada = await liqRepo.save(liquidacion);

      // Si se recibió efectivo, asentar EFECTIVO_LIQUIDADO (positivo)
      if (efectivoRecibido > BigInt(0)) {
        const mov = movRepo.create({
          inquilino_id: actor.tenantId,
          repartidor_id: riderId,
          tipo: "EFECTIVO_LIQUIDADO",
          monto_centavos: efectivoRecibido.toString(),
          liquidacion_id: liqGuardada.id,
          actor_id: actor.userId,
          motivo: `Liquidación diaria de efectivo de fecha ${fechaOperativa}`,
        });
        await movRepo.save(mov);
      }

      await queryRunner.commitTransaction();
      return liqGuardada;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
