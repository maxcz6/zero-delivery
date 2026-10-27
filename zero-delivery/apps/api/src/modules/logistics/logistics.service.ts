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
  UbicacionRepartidorEntity,
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
    riderId: string,
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
    riderId: string,
  ): Promise<PedidoEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pedidoRepo = queryRunner.manager.getRepository(PedidoEntity);
      const riderRepo = queryRunner.manager.getRepository(RepartidorEntity);
      const detalleRepo =
        queryRunner.manager.getRepository(DetallePedidoEntity);
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
        where: {
          inquilino_id: actor.tenantId,
          clave: "monto_minimo_garantia_centavos",
        },
      });
      const minGarantia = configGarantia
        ? BigInt(String(configGarantia.valor))
        : BigInt(5000);

      const elegibilidad = evaluateRiderEligibility({
        rider,
        saldoCentavos,
        esPedidoEfectivo: pedido.metodo_pago === "EFECTIVO",
        tieneItemsFragiles,
        minimoGarantiaCentavos: minGarantia,
      });

      if (!elegibilidad.elegible) {
        throw new BadRequestException(
          `Repartidor no elegible: ${elegibilidad.motivos.join(". ")}`,
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
    orderId: string,
  ): Promise<{ pedido: PedidoEntity; movimiento: MovimientoBilleteraEntity }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pedidoRepo = queryRunner.manager.getRepository(PedidoEntity);
      const movRepo = queryRunner.manager.getRepository(
        MovimientoBilleteraEntity,
      );
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
    motivo?: string,
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
    motivoAjuste?: string,
  ): Promise<LiquidacionEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const liqRepo = queryRunner.manager.getRepository(LiquidacionEntity);
      const movRepo = queryRunner.manager.getRepository(
        MovimientoBilleteraEntity,
      );

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

  /**
   * Registra una coordenada de telemetría GPS para el repartidor.
   */
  async recordLocation(
    actor: ActorContext,
    latitud: number,
    longitud: number,
    precisionM?: number,
  ): Promise<UbicacionRepartidorEntity> {
    if (!actor.riderId) {
      throw new ForbiddenException(
        "El usuario no tiene perfil de repartidor asignado",
      );
    }
    const repo = this.dataSource.getRepository(UbicacionRepartidorEntity);
    const item = repo.create({
      repartidor_id: actor.riderId,
      latitud,
      longitud,
      precision_m: precisionM ?? null,
    });
    return repo.save(item);
  }

  /**
   * Recomendación de repartidores para un pedido: puntúa a cada repartidor con
   * estrellas, distancia a la sucursal, disponibilidad, garantía/saldo (si es contra entrega)
   * y confianza, e indica quién es elegible y por qué. Sirve a Coordinador, Soporte y Admin.
   */
  async getAssignmentRecommendations(actor: ActorContext, orderId: string) {
    const rows: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT p.id, p.numero, p.metodo_pago, p.estado_pago, p.estado_operativo,
              p.total_centavos, p.efectivo_por_cobrar_centavos, p.direccion_snapshot, p.repartidor_id,
              s.nombre AS sucursal_nombre, s.direccion AS sucursal_direccion,
              s.latitud AS s_lat, s.longitud AS s_lng,
              c.nombre AS cliente_nombre
         FROM pedidos p
         JOIN sucursales s ON s.id = p.sucursal_id
         JOIN clientes c ON c.id = p.cliente_id
        WHERE p.id = $1 AND p.inquilino_id = $2`,
      [orderId, actor.tenantId],
    );
    const p = rows[0];
    if (!p) throw new NotFoundException("Pedido no encontrado");

    const fragRows: Array<{ f: boolean | null }> = await this.dataSource.query(
      `SELECT bool_or(pr.es_fragil) AS f
         FROM detalle_pedido d JOIN productos pr ON pr.id = d.producto_id
        WHERE d.pedido_id = $1`,
      [orderId],
    );
    const tieneFragiles = Boolean(fragRows[0]?.f);
    const esEfectivo = p.metodo_pago === "EFECTIVO";

    const sLat = p.s_lat === null ? null : Number(p.s_lat);
    const sLng = p.s_lng === null ? null : Number(p.s_lng);
    const dir = (p.direccion_snapshot ?? {}) as Record<string, any>;
    const cLat =
      dir.latitud === null || dir.latitud === undefined
        ? null
        : Number(dir.latitud);
    const cLng =
      dir.longitud === null || dir.longitud === undefined
        ? null
        : Number(dir.longitud);

    const km = (
      aLat: number,
      aLng: number,
      bLat: number,
      bLng: number,
    ): number => {
      const rad = (d: number) => (d * Math.PI) / 180;
      const dLat = rad(bLat - aLat);
      const dLng = rad(bLng - aLng);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
      return 6371 * 2 * Math.asin(Math.sqrt(h));
    };

    const distanciaSucursalCliente =
      sLat !== null && sLng !== null && cLat !== null && cLng !== null
        ? Math.round(km(sLat, sLng, cLat, cLng) * 10) / 10
        : null;

    const configRows: Array<{ valor: unknown }> = await this.dataSource
      .query(
        `SELECT valor FROM configuraciones WHERE inquilino_id = $1 AND clave = 'monto_minimo_garantia_centavos' LIMIT 1`,
        [actor.tenantId],
      )
      .catch(() => []);
    const minGarantia = configRows[0]
      ? BigInt(String(configRows[0].valor).replace(/"/g, ""))
      : BigInt(5000);

    const riders: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT r.id, r.nombre_completo, r.telefono, r.tipo_vehiculo, r.estado, r.alta_confianza,
              r.puntaje_confianza, r.esta_activo, r.tipo_flota, r.nombre_agencia,
              (SELECT avg(estrellas)::float FROM calificaciones
                 WHERE tipo_sujeto = 'REPARTIDOR' AND sujeto_id = r.id) AS estrellas,
              (SELECT count(*)::int FROM calificaciones
                 WHERE tipo_sujeto = 'REPARTIDOR' AND sujeto_id = r.id) AS n_calificaciones,
              (SELECT latitud FROM ubicaciones_repartidor WHERE repartidor_id = r.id ORDER BY creado_en DESC LIMIT 1) AS lat,
              (SELECT longitud FROM ubicaciones_repartidor WHERE repartidor_id = r.id ORDER BY creado_en DESC LIMIT 1) AS lng,
              (SELECT creado_en FROM ubicaciones_repartidor WHERE repartidor_id = r.id ORDER BY creado_en DESC LIMIT 1) AS gps_en,
              (SELECT COALESCE(sum(monto_centavos), 0)::text FROM movimientos_billetera
                 WHERE repartidor_id = r.id AND inquilino_id = $1) AS saldo,
              (SELECT count(*)::int FROM pedidos
                 WHERE repartidor_id = r.id
                   AND estado_operativo IN ('REPARTIDOR_ASIGNADO','REPARTIDOR_EN_RECOJO','EN_CAMINO')) AS activos
         FROM repartidores r
        WHERE r.inquilino_id = $1 AND r.esta_activo = true`,
      [actor.tenantId],
    );

    const evaluados = riders.map((r) => {
      const saldo = BigInt(r.saldo ?? "0");
      const elegibilidad = evaluateRiderEligibility({
        rider: r as unknown as RepartidorEntity,
        saldoCentavos: saldo,
        esPedidoEfectivo: esEfectivo,
        tieneItemsFragiles: tieneFragiles,
        minimoGarantiaCentavos: minGarantia,
      });

      const razones: string[] = [];
      const lat = r.lat === null ? null : Number(r.lat);
      const lng = r.lng === null ? null : Number(r.lng);
      const distanciaKm =
        lat !== null && lng !== null && sLat !== null && sLng !== null
          ? Math.round(km(lat, lng, sLat, sLng) * 10) / 10
          : null;

      // Estrellas (30)
      const estrellas: number | null =
        r.estrellas === null ? null : Math.round(Number(r.estrellas) * 10) / 10;
      const ptsEstrellas = ((estrellas ?? 3.5) / 5) * 30;
      razones.push(
        estrellas === null
          ? "Sin calificaciones todavía (puntaje neutro)"
          : `${estrellas.toFixed(1)}/5 en ${r.n_calificaciones} entrega(s)`,
      );

      // Distancia (30)
      let ptsDistancia = 10;
      if (distanciaKm !== null) {
        ptsDistancia = Math.max(0, 1 - distanciaKm / 8) * 30;
        razones.push(`A ${distanciaKm} km de la sucursal`);
      } else {
        razones.push("Sin ubicación GPS reciente");
      }

      // Disponibilidad y carga (15)
      let ptsDisp =
        r.estado === "DISPONIBLE" ? 15 : r.estado === "OCUPADO" ? 5 : 0;
      ptsDisp = Math.max(0, ptsDisp - (r.activos ?? 0) * 3);
      razones.push(
        r.estado === "DISPONIBLE"
          ? "Disponible ahora"
          : `Estado: ${r.estado} · ${r.activos} entrega(s) activas`,
      );

      // Garantía / saldo (15)
      let ptsGarantia = 5;
      if (esEfectivo) {
        if (r.alta_confianza) {
          ptsGarantia = 15;
          razones.push("Alta confianza: puede cobrar efectivo");
        } else if (saldo >= minGarantia) {
          ptsGarantia = 12;
          razones.push(
            `Garantía suficiente (S/ ${(Number(saldo) / 100).toFixed(2)})`,
          );
        } else {
          ptsGarantia = 0;
        }
      }

      // Confianza (10)
      const ptsConfianza =
        ((r.puntaje_confianza === null ? 50 : Number(r.puntaje_confianza)) /
          100) *
        10;

      const score = elegibilidad.elegible
        ? Math.round(
            ptsEstrellas + ptsDistancia + ptsDisp + ptsGarantia + ptsConfianza,
          )
        : 0;

      return {
        id: r.id as string,
        nombre_completo: r.nombre_completo as string,
        telefono: r.telefono as string,
        tipo_vehiculo: r.tipo_vehiculo as string,
        estado: r.estado as string,
        alta_confianza: Boolean(r.alta_confianza),
        flota: r.nombre_agencia ?? r.tipo_flota,
        estrellas,
        n_calificaciones: r.n_calificaciones as number,
        distancia_sucursal_km: distanciaKm,
        gps_en: r.gps_en ?? null,
        saldo_centavos: saldo.toString(),
        garantia_ok: esEfectivo
          ? elegibilidad.elegible || !elegibilidad.bloqueadoPorDeuda
          : true,
        entregas_activas: r.activos as number,
        elegible: elegibilidad.elegible,
        motivos_no_elegible: elegibilidad.motivos,
        score,
        razones,
        recomendado: false,
      };
    });

    evaluados.sort((a, b) => {
      if (a.elegible !== b.elegible) return a.elegible ? -1 : 1;
      return b.score - a.score;
    });
    const mejor = evaluados.find((e) => e.elegible);
    if (mejor) mejor.recomendado = true;

    const advertencias: string[] = [];
    if (!esEfectivo && p.estado_pago !== "PAGADO") {
      advertencias.push(
        "El pago digital aún no está validado: confírmalo antes del traspaso al repartidor.",
      );
    }
    if (esEfectivo) {
      advertencias.push(
        "Pedido contra entrega: solo repartidores con garantía suficiente o alta confianza son elegibles.",
      );
    }
    if (tieneFragiles)
      advertencias.push(
        "Contiene productos frágiles: se requiere vehículo tipo AUTO.",
      );
    if (!evaluados.some((e) => e.elegible)) {
      advertencias.push("Ningún repartidor es elegible en este momento.");
    }

    return {
      pedido: {
        id: p.id as string,
        numero: p.numero,
        estado_operativo: p.estado_operativo,
        estado_pago: p.estado_pago,
        metodo_pago: p.metodo_pago,
        es_contra_entrega: esEfectivo,
        total_centavos: String(p.total_centavos),
        efectivo_por_cobrar_centavos: String(p.efectivo_por_cobrar_centavos),
        cliente_nombre: p.cliente_nombre,
        direccion_entrega: dir.texto_direccion ?? null,
        sucursal_nombre: p.sucursal_nombre,
        sucursal_direccion: p.sucursal_direccion,
        distancia_sucursal_cliente_km: distanciaSucursalCliente,
        tiene_fragiles: tieneFragiles,
        repartidor_actual_id: p.repartidor_id ?? null,
      },
      garantia_minima_centavos: minGarantia.toString(),
      advertencias,
      repartidores: evaluados,
    };
  }
}
