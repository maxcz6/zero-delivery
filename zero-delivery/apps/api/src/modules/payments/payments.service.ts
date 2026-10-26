import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  PagoEntity,
  EventoPagoEntity,
  PagoRestauranteEntity,
  PedidoEntity,
  EventoSalidaEntity,
} from "@zero-delivery/database";
import { ActorContext, EstadoPagoDb, MetodoPagoDb } from "@zero-delivery/shared-types";

@Injectable()
export class PaymentsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Crea o asegura un registro de pago para un pedido dado.
   */
  async getOrCreatePaymentForOrder(
    actor: ActorContext,
    pedidoId: string,
    metodo: MetodoPagoDb,
    montoCentavos: string
  ): Promise<PagoEntity> {
    const pagoRepo = this.dataSource.getRepository(PagoEntity);
    let pago = await pagoRepo.findOne({
      where: { pedido_id: pedidoId, inquilino_id: actor.tenantId },
    });

    if (!pago) {
      pago = pagoRepo.create({
        inquilino_id: actor.tenantId,
        pedido_id: pedidoId,
        metodo,
        monto_centavos: montoCentavos,
        estado: "PENDIENTE",
      });
      pago = await pagoRepo.save(pago);

      const eventoRepo = this.dataSource.getRepository(EventoPagoEntity);
      const ev = eventoRepo.create({
        inquilino_id: actor.tenantId,
        pago_id: pago.id,
        tipo: "CREADO",
        despues: { estado: "PENDIENTE", monto_centavos: montoCentavos, metodo },
        actor_id: actor.userId,
      });
      await eventoRepo.save(ev);
    }

    return pago;
  }

  /**
   * Validación humana de comprobantes Yape o transferencia bancaria.
   * Transaccional con bloqueo pesimista y asiento inmutable en eventos_pago.
   */
  async validatePayment(
    actor: ActorContext,
    paymentId: string,
    referencia?: string,
    motivo?: string
  ): Promise<PagoEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pagoRepo = queryRunner.manager.getRepository(PagoEntity);
      const pedidoRepo = queryRunner.manager.getRepository(PedidoEntity);
      const eventoRepo = queryRunner.manager.getRepository(EventoPagoEntity);
      const outboxRepo = queryRunner.manager.getRepository(EventoSalidaEntity);

      const pago = await pagoRepo
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .where("p.id = :paymentId AND p.inquilino_id = :tenantId", {
          paymentId,
          tenantId: actor.tenantId,
        })
        .getOne();

      if (!pago) {
        throw new NotFoundException("Pago no encontrado");
      }

      const antes = {
        estado: pago.estado,
        monto_centavos: pago.monto_centavos,
        referencia: pago.referencia,
      };

      pago.estado = "PAGADO";
      pago.validado_por = actor.userId;
      pago.validado_en = new Date();
      if (referencia) {
        pago.referencia = referencia.trim();
      }

      const pagoGuardado = await pagoRepo.save(pago);

      // Sincronizar estado de pago en el pedido
      const pedido = await pedidoRepo.findOne({
        where: { id: pago.pedido_id, inquilino_id: actor.tenantId },
      });
      if (pedido) {
        pedido.estado_pago = "PAGADO";
        await pedidoRepo.save(pedido);
      }

      // Bitácora append-only
      const ev = eventoRepo.create({
        inquilino_id: actor.tenantId,
        pago_id: pago.id,
        tipo: "VALIDADO",
        antes,
        despues: {
          estado: "PAGADO",
          monto_centavos: pago.monto_centavos,
          referencia: pago.referencia,
          validado_por: actor.userId,
        },
        motivo: motivo ?? "Comprobante validado manualmente",
        actor_id: actor.userId,
      });
      await eventoRepo.save(ev);

      // Encolado outbox
      const outbox = outboxRepo.create({
        inquilino_id: actor.tenantId,
        tipo: "PAGO_VALIDADO",
        datos: {
          pago_id: pago.id,
          pedido_id: pago.pedido_id,
          monto_centavos: pago.monto_centavos,
          validado_por: actor.userId,
        },
        estado: "PENDIENTE",
      });
      await outboxRepo.save(outbox);

      await queryRunner.commitTransaction();
      return pagoGuardado;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Confirmación humana del pago o liquidación a la sucursal de restaurante antes del despacho.
   */
  async confirmRestaurantPayout(
    actor: ActorContext,
    pagoRestauranteId: string,
    metodo?: string,
    referencia?: string
  ): Promise<PagoRestauranteEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pagoRestRepo = queryRunner.manager.getRepository(PagoRestauranteEntity);
      const pedidoRepo = queryRunner.manager.getRepository(PedidoEntity);
      const outboxRepo = queryRunner.manager.getRepository(EventoSalidaEntity);

      const pagoRest = await pagoRestRepo
        .createQueryBuilder("pr")
        .setLock("pessimistic_write")
        .where("pr.id = :pagoRestauranteId AND pr.inquilino_id = :tenantId", {
          pagoRestauranteId,
          tenantId: actor.tenantId,
        })
        .getOne();

      if (!pagoRest) {
        throw new NotFoundException("Pago de restaurante no encontrado");
      }

      pagoRest.estado = "CONFIRMADO";
      pagoRest.confirmado_por = actor.userId;
      pagoRest.confirmado_en = new Date();
      if (metodo) pagoRest.metodo = metodo;
      if (referencia) pagoRest.referencia = referencia;

      const pagoRestGuardado = await pagoRestRepo.save(pagoRest);

      // Sincronizar en pedidos.estado_pago_restaurante
      const pedido = await pedidoRepo.findOne({
        where: { id: pagoRest.pedido_id, inquilino_id: actor.tenantId },
      });
      if (pedido) {
        pedido.estado_pago_restaurante = "CONFIRMADO";
        await pedidoRepo.save(pedido);
      }

      const outbox = outboxRepo.create({
        inquilino_id: actor.tenantId,
        tipo: "PAGO_RESTAURANTE_CONFIRMADO",
        datos: {
          pago_restaurante_id: pagoRest.id,
          pedido_id: pagoRest.pedido_id,
          monto_centavos: pagoRest.monto_centavos,
          confirmado_por: actor.userId,
        },
        estado: "PENDIENTE",
      });
      await outboxRepo.save(outbox);

      await queryRunner.commitTransaction();
      return pagoRestGuardado;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Corrección de pago con registro obligatorio de motivo y estados antes/después.
   */
  async correctPayment(
    actor: ActorContext,
    paymentId: string,
    data: {
      nuevo_monto_centavos?: string;
      nuevo_estado?: EstadoPagoDb;
      motivo: string;
    }
  ): Promise<PagoEntity> {
    if (!data.motivo || data.motivo.trim().length < 4) {
      throw new BadRequestException(
        "El motivo es obligatorio (mínimo 4 caracteres) para corregir un pago"
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pagoRepo = queryRunner.manager.getRepository(PagoEntity);
      const eventoRepo = queryRunner.manager.getRepository(EventoPagoEntity);

      const pago = await pagoRepo
        .createQueryBuilder("p")
        .setLock("pessimistic_write")
        .where("p.id = :paymentId AND p.inquilino_id = :tenantId", {
          paymentId,
          tenantId: actor.tenantId,
        })
        .getOne();

      if (!pago) {
        throw new NotFoundException("Pago no encontrado");
      }

      const antes = {
        estado: pago.estado,
        monto_centavos: pago.monto_centavos,
      };

      if (data.nuevo_monto_centavos) {
        pago.monto_centavos = data.nuevo_monto_centavos;
      }
      if (data.nuevo_estado) {
        pago.estado = data.nuevo_estado;
        if (
          (data.nuevo_estado === "PAGADO" || data.nuevo_estado === "REEMBOLSADO") &&
          !pago.validado_por
        ) {
          pago.validado_por = actor.userId;
          pago.validado_en = new Date();
        }
      }

      const pagoGuardado = await pagoRepo.save(pago);

      const despues = {
        estado: pagoGuardado.estado,
        monto_centavos: pagoGuardado.monto_centavos,
      };

      const ev = eventoRepo.create({
        inquilino_id: actor.tenantId,
        pago_id: pago.id,
        tipo: "CORREGIDO",
        antes,
        despues,
        motivo: data.motivo.trim(),
        actor_id: actor.userId,
      });
      await eventoRepo.save(ev);

      await queryRunner.commitTransaction();
      return pagoGuardado;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtiene los pagos asociados a un pedido.
   */
  async getPaymentsByOrder(
    actor: ActorContext,
    orderId: string
  ): Promise<PagoEntity[]> {
    const pagoRepo = this.dataSource.getRepository(PagoEntity);
    return pagoRepo.find({
      where: { pedido_id: orderId, inquilino_id: actor.tenantId },
      order: { creado_en: "DESC" },
    });
  }

  /**
   * Obtiene la liquidación al restaurante de un pedido (si existe).
   */
  async getRestaurantPaymentByOrder(
    actor: ActorContext,
    orderId: string
  ): Promise<PagoRestauranteEntity | null> {
    const pagoRestRepo = this.dataSource.getRepository(PagoRestauranteEntity);
    return pagoRestRepo.findOne({
      where: { pedido_id: orderId, inquilino_id: actor.tenantId },
    });
  }
}
