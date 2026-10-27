import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { DataSource, In } from "typeorm";
import { randomBytes } from "node:crypto";
import {
  PedidoEntity,
  DetallePedidoEntity,
  ModificadorDetallePedidoEntity,
  HistorialEstadosPedidoEntity,
  EventoSalidaEntity,
  ClienteEntity,
  SucursalEntity,
  ProductoEntity,
  GrupoModificadoresEntity,
  OpcionModificadorEntity,
  ProductoGrupoModificadoresEntity,
  ConfiguracionEntity,
  PagoEntity,
  RepartidorEntity,
} from "@zero-delivery/database";
import {
  ActorContext,
  EstadoOperativoPedidoDb,
  CrearPedidoManualInput,
  PermissionKey,
  can,
} from "@zero-delivery/shared-types";
import { evaluateReleaseGate } from "./release-gate";
import { ensureRestaurantPayout } from "../payments/restaurant-payout";
import {
  ALLOWED_TRANSITIONS,
  STATES_REQUIRING_MOTIVO,
  TRANSITION_PERMISSIONS,
} from "./order-transitions";

@Injectable()
export class OrdersService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Creación de pedido manual transaccional con Idempotencia y número secuencial vía trigger.
   */
  async createManualOrder(
    actor: ActorContext,
    input: CrearPedidoManualInput,
    idempotencyKey?: string
  ): Promise<PedidoEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pedidoRepo = queryRunner.manager.getRepository(PedidoEntity);
      const clienteRepo = queryRunner.manager.getRepository(ClienteEntity);
      const sucursalRepo = queryRunner.manager.getRepository(SucursalEntity);
      const productoRepo = queryRunner.manager.getRepository(ProductoEntity);
      const grupoModificadorRepo = queryRunner.manager.getRepository(GrupoModificadoresEntity);
      const opcionRepo = queryRunner.manager.getRepository(OpcionModificadorEntity);
      const productoGrupoModificadorRepo = queryRunner.manager.getRepository(ProductoGrupoModificadoresEntity);
      const detalleRepo = queryRunner.manager.getRepository(DetallePedidoEntity);
      const modDetalleRepo = queryRunner.manager.getRepository(ModificadorDetallePedidoEntity);
      const historialRepo = queryRunner.manager.getRepository(HistorialEstadosPedidoEntity);
      const outboxRepo = queryRunner.manager.getRepository(EventoSalidaEntity);

      const claveIdempotencia = input.clave_idempotencia ?? idempotencyKey ?? null;

      // 1. Verificación de Idempotencia
      if (claveIdempotencia) {
        const existingOrder = await pedidoRepo.findOne({
          where: {
            inquilino_id: actor.tenantId,
            clave_idempotencia: claveIdempotencia,
          },
          relations: ["items"],
        });

        if (existingOrder) {
          await queryRunner.rollbackTransaction();
          return existingOrder;
        }
      }

      // 2. Validar sucursal
      const sucursal = await sucursalRepo.findOne({
        where: { id: input.sucursal_id, inquilino_id: actor.tenantId },
      });
      if (!sucursal) {
        throw new NotFoundException("Sucursal no encontrada");
      }

      // 3. Resolver cliente: por ID existente o creando uno nuevo
      let clienteId: string;
      if (input.cliente_id) {
        const clienteExistente = await clienteRepo.findOne({
          where: { id: input.cliente_id, inquilino_id: actor.tenantId },
        });
        if (!clienteExistente) {
          throw new NotFoundException("Cliente no encontrado");
        }
        clienteId = clienteExistente.id;
      } else if (input.cliente_nuevo) {
        const nuevoCliente = clienteRepo.create({
          inquilino_id: actor.tenantId,
          nombre: input.cliente_nuevo.nombre,
          telefono_e164: input.cliente_nuevo.telefono_e164,
          marca_riesgo: "NINGUNO",
        });
        const clienteGuardado = await clienteRepo.save(nuevoCliente);
        clienteId = clienteGuardado.id;
      } else {
        throw new BadRequestException(
          "Se requiere cliente_id o cliente_nuevo para crear un pedido"
        );
      }

      // 4. Calcular importes y crear items con precios fijados (snapshot)
      let subtotalItemsCentavos = BigInt(0);
      const itemsParaGuardar: Array<{
        detalle: DetallePedidoEntity;
        modificadores: ModificadorDetallePedidoEntity[];
      }> = [];

      for (const itemInput of input.items) {
        const producto = await productoRepo.findOne({
          where: { id: itemInput.producto_id, inquilino_id: actor.tenantId },
        });

        if (!producto) {
          throw new NotFoundException(
            `Producto ${itemInput.producto_id} no encontrado`
          );
        }

        const precioBase = BigInt(producto.precio_base_centavos);
        const empaque = BigInt(producto.empaque_centavos || "0");
        let subtotalUnitario = precioBase + empaque;

        const modificadoresEntidad: ModificadorDetallePedidoEntity[] = [];
        const gruposProducto = await productoGrupoModificadorRepo.find({
          where: { producto_id: producto.id },
        });
        const grupoIds = gruposProducto.map(({ grupo_id }) => grupo_id);
        const grupos = grupoIds.length
          ? await grupoModificadorRepo.find({
              where: { id: In(grupoIds), inquilino_id: actor.tenantId },
            })
          : [];

        if (grupos.length !== grupoIds.length) {
          throw new BadRequestException(
            `Configuración de modificadores inválida para el producto ${producto.nombre}`
          );
        }

        const gruposPorId = new Map(grupos.map((grupo) => [grupo.id, grupo]));
        const seleccionesPorGrupo = new Map<string, number>();
        const opcionesSeleccionadas = new Set<string>();

        if (itemInput.modificadores && itemInput.modificadores.length > 0) {
          for (const modInput of itemInput.modificadores) {
            if (opcionesSeleccionadas.has(modInput.opcion_id)) {
              throw new BadRequestException(
                "No se puede seleccionar la misma opción de modificador más de una vez"
              );
            }

            const opcion = await opcionRepo.findOne({
              where: { id: modInput.opcion_id, esta_activo: true },
            });

            const grupo = opcion ? gruposPorId.get(opcion.grupo_id) : undefined;
            if (!opcion || !grupo) {
              throw new BadRequestException(
                `Opción de modificador ${modInput.opcion_id} no válida para el producto`
              );
            }

            const selecciones = (seleccionesPorGrupo.get(grupo.id) ?? 0) + 1;
            if (selecciones > grupo.maximo_seleccion) {
              throw new BadRequestException(
                `Se excedió el máximo de opciones para el grupo ${grupo.nombre}`
              );
            }

            opcionesSeleccionadas.add(opcion.id);
            seleccionesPorGrupo.set(grupo.id, selecciones);

            const sobreprecio = BigInt(opcion.incremento_precio_centavos || "0");
            subtotalUnitario += sobreprecio;

            const modDetalle = modDetalleRepo.create({
              nombre_snapshot: modInput.nombre_snapshot,
              incremento_precio_centavos: opcion.incremento_precio_centavos,
            });
            modificadoresEntidad.push(modDetalle);
          }
        }

        for (const grupo of grupos) {
          if ((seleccionesPorGrupo.get(grupo.id) ?? 0) < grupo.minimo_seleccion) {
            throw new BadRequestException(
              `Faltan opciones obligatorias para el grupo ${grupo.nombre}`
            );
          }
        }

        if (subtotalUnitario < BigInt(0)) {
          throw new BadRequestException(
            `El precio unitario del producto ${producto.nombre} no puede ser negativo`
          );
        }

        const cantidad = BigInt(itemInput.cantidad);
        const subtotalLinea = subtotalUnitario * cantidad;
        subtotalItemsCentavos += subtotalLinea;

        const detalle = detalleRepo.create({
          producto_id: producto.id,
          nombre_snapshot: producto.nombre,
          precio_base_centavos: precioBase.toString(),
          empaque_centavos: empaque.toString(),
          precio_unitario_centavos: subtotalUnitario.toString(),
          cantidad: itemInput.cantidad,
          total_linea_centavos: subtotalLinea.toString(),
        });

        itemsParaGuardar.push({ detalle, modificadores: modificadoresEntidad });
      }

      const totalCentavos = subtotalItemsCentavos;

      if (totalCentavos < BigInt(0)) {
        throw new BadRequestException("El total del pedido no puede ser negativo");
      }

      // Si el método de pago es EFECTIVO, el saldo por cobrar es el total
      const efectivoPorCobrar =
        input.metodo_pago === "EFECTIVO" ? totalCentavos.toString() : "0";

      // 5. Crear cabecera del Pedido con numero = '0' para que el trigger lo asigne
      const tokenPublico = randomBytes(16).toString("hex");

      const pedido = pedidoRepo.create({
        inquilino_id: actor.tenantId,
        numero: "0",
        sucursal_id: sucursal.id,
        cliente_id: clienteId,
        direccion_snapshot: input.direccion_snapshot as Record<string, unknown>,
        canal: input.canal ?? "MANUAL",
        estado_operativo: "NUEVO",
        estado_pago: "PENDIENTE",
        metodo_pago: input.metodo_pago,
        estado_pago_restaurante: "PENDIENTE",
        subtotal_items_centavos: subtotalItemsCentavos.toString(),
        tarifa_entrega_centavos: "0",
        descuento_centavos: "0",
        impuesto_centavos: "0",
        total_centavos: totalCentavos.toString(),
        efectivo_por_cobrar_centavos: efectivoPorCobrar,
        clave_idempotencia: claveIdempotencia,
        token_publico: tokenPublico,
        notas: input.notas ?? null,
        factura_solicitada: input.factura_solicitada ?? false,
        creado_por: actor.userId,
      });

      const pedidoGuardado = await pedidoRepo.save(pedido);

      // 6. Guardar líneas y modificadores asociados
      for (const { detalle, modificadores } of itemsParaGuardar) {
        detalle.pedido_id = pedidoGuardado.id;
        const detalleGuardado = await detalleRepo.save(detalle);

        for (const mod of modificadores) {
          mod.detalle_pedido_id = detalleGuardado.id;
          await modDetalleRepo.save(mod);
        }
      }

      // 6b. Los pagos electrónicos quedan pendientes de validación humana;
      // el efectivo se cobra contra entrega y no genera registro previo.
      if (input.metodo_pago !== "EFECTIVO") {
        const pagoRepo = queryRunner.manager.getRepository(PagoEntity);
        await pagoRepo.save(
          pagoRepo.create({
            inquilino_id: actor.tenantId,
            pedido_id: pedidoGuardado.id,
            metodo: input.metodo_pago,
            monto_centavos: totalCentavos.toString(),
            estado: "PENDIENTE",
            referencia: null,
          })
        );
      }

      // 7. Registrar en el historial de estados (Inmutable)
      const historial = historialRepo.create({
        inquilino_id: actor.tenantId,
        pedido_id: pedidoGuardado.id,
        estado_anterior: null,
        estado_nuevo: "NUEVO",
        actor_id: actor.userId,
        rol_actor: actor.role,
        motivo: "Creación de pedido manual",
      });
      await historialRepo.save(historial);

      // 8. Encolado Transaccional (Outbox Pattern)
      const eventoOutbox = outboxRepo.create({
        inquilino_id: actor.tenantId,
        tipo: "PEDIDO_CREADO",
        datos: {
          pedido_id: pedidoGuardado.id,
          numero: pedidoGuardado.numero,
          total_centavos: pedidoGuardado.total_centavos,
          metodo_pago: pedidoGuardado.metodo_pago,
          sucursal_id: pedidoGuardado.sucursal_id,
        },
        estado: "PENDIENTE",
      });
      await outboxRepo.save(eventoOutbox);

      await queryRunner.commitTransaction();

      // Recargar con relaciones completas
      return (await this.getOrderById(actor, pedidoGuardado.id))!;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Transición transaccional de estados con bloqueo pesimista (SELECT ... FOR UPDATE)
   * y control de concurrencia optimista (version).
   */
  async transitionOrder(
    actor: ActorContext,
    orderId: string,
    nuevoEstado: EstadoOperativoPedidoDb,
    motivo?: string,
    versionEsperada?: number
  ): Promise<PedidoEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pedidoRepo = queryRunner.manager.getRepository(PedidoEntity);
      const historialRepo = queryRunner.manager.getRepository(HistorialEstadosPedidoEntity);
      const outboxRepo = queryRunner.manager.getRepository(EventoSalidaEntity);
      const configRepo = queryRunner.manager.getRepository(ConfiguracionEntity);

      // 1. Bloqueo pesimista sobre el pedido
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

      const permission = TRANSITION_PERMISSIONS[nuevoEstado];
      if (!permission) {
        throw new ForbiddenException(
          "No hay permiso asignado para esta transición de pedido"
        );
      }
      this.assertOrderPermission(actor, permission, pedido);

      // 2. Control de concurrencia optimista si se envió versión esperada
      if (versionEsperada !== undefined && pedido.version !== versionEsperada) {
        throw new ConflictException(
          `Conflicto de concurrencia: el pedido fue modificado por otro proceso (versión actual: ${pedido.version}, enviada: ${versionEsperada})`
        );
      }

      const estadoActual = pedido.estado_operativo;

      // 3. Validar si la transición está permitida en la FSM
      const permitidas = ALLOWED_TRANSITIONS[estadoActual] ?? [];
      if (!permitidas.includes(nuevoEstado)) {
        throw new BadRequestException(
          `Transición no permitida de ${estadoActual} a ${nuevoEstado}`
        );
      }

      // 4. Validar motivo si el nuevo estado lo exige
      if (STATES_REQUIRING_MOTIVO.includes(nuevoEstado)) {
        if (!motivo || motivo.trim().length < 3) {
          throw new BadRequestException(
            `El motivo es obligatorio (mínimo 3 caracteres) para la transición a ${nuevoEstado}`
          );
        }
      }

      // 5. Validar la Compuerta de Liberación (Release Gate) para EN_CAMINO
      if (nuevoEstado === "EN_CAMINO") {
        const configRestaurante = await configRepo.findOne({
          where: {
            inquilino_id: actor.tenantId,
            clave: "requiere_confirmacion_pago_restaurante",
          },
        });
        const requiereConfirmacion = configRestaurante
          ? configRestaurante.valor === "true"
          : true;

        const gate = evaluateReleaseGate(
          {
            estado_operativo: pedido.estado_operativo,
            repartidor_id: pedido.repartidor_id,
            metodo_pago: pedido.metodo_pago,
            estado_pago: pedido.estado_pago,
            estado_pago_restaurante: pedido.estado_pago_restaurante,
            traspaso_en: pedido.traspaso_en,
          },
          { requiereConfirmacionPagoRestaurante: requiereConfirmacion }
        );

        if (!gate.canRelease) {
          throw new BadRequestException(
            `Compuerta de liberación denegada: ${gate.reasons.join(". ")}`
          );
        }

        pedido.liberado_en = new Date();
        pedido.liberado_por = actor.userId;
      }

      // Manejo de cancelación solicitada y reversión
      if (nuevoEstado === "CANCELACION_SOLICITADA") {
        pedido.estado_previo_solicitud_cancelacion = estadoActual;
      }

      // Al aceptar el pedido nace su liquidación al restaurante, de modo que pueda
      // confirmarse antes del despacho y no al final del flujo.
      if (nuevoEstado === "CONFIRMADO") {
        await ensureRestaurantPayout(queryRunner.manager, pedido);
      }

      pedido.estado_operativo = nuevoEstado;

      const pedidoActualizado = await pedidoRepo.save(pedido);

      // Registrar historial inmutable
      const historial = historialRepo.create({
        inquilino_id: actor.tenantId,
        pedido_id: pedido.id,
        estado_anterior: estadoActual,
        estado_nuevo: nuevoEstado,
        actor_id: actor.userId,
        rol_actor: actor.role,
        motivo: motivo ?? null,
      });
      await historialRepo.save(historial);

      // Encolar evento outbox
      const evento = outboxRepo.create({
        inquilino_id: actor.tenantId,
        tipo: "PEDIDO_ESTADO_CAMBIADO",
        datos: {
          pedido_id: pedido.id,
          estado_anterior: estadoActual,
          estado_nuevo: nuevoEstado,
          motivo: motivo ?? null,
          actor_id: actor.userId,
        },
        estado: "PENDIENTE",
      });
      await outboxRepo.save(evento);

      await queryRunner.commitTransaction();

      return (await this.getOrderById(actor, pedidoActualizado.id))!;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Registro del traspaso físico del pedido de la cocina al repartidor.
   */
  async registerHandoff(actor: ActorContext, orderId: string): Promise<PedidoEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const pedidoRepo = queryRunner.manager.getRepository(PedidoEntity);
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

      this.assertOrderPermission(actor, "order.handoff_to_rider", pedido);

      // Mismo criterio que pedidos_traspaso_requiere_pago_chk y
      // pedidos_control_despacho_chk, validado aquí para responder 400 con un
      // mensaje de negocio en lugar del 500 que provoca la restricción en BD.
      if (!pedido.repartidor_id) {
        throw new BadRequestException(
          "No se puede registrar el traspaso: el pedido aún no tiene repartidor asignado"
        );
      }
      if (pedido.estado_pago_restaurante !== "CONFIRMADO") {
        throw new BadRequestException(
          "No se puede registrar el traspaso: el pago al restaurante aún no está confirmado"
        );
      }

      pedido.traspaso_en = new Date();
      pedido.traspaso_por = actor.userId;
      await pedidoRepo.save(pedido);

      await queryRunner.commitTransaction();

      return (await this.getOrderById(actor, orderId))!;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private assertOrderPermission(
    actor: ActorContext,
    permission: PermissionKey,
    pedido: PedidoEntity
  ): void {
    if (
      actor.role === "RIDER" &&
      permission === "delivery.update_own" &&
      (!pedido.repartidor_id || pedido.repartidor_id !== actor.riderId)
    ) {
      throw new ForbiddenException(
        "El repartidor solo puede actualizar pedidos asignados a su cuenta"
      );
    }

    const decision = can(actor, permission, {
      tenantId: actor.tenantId,
      branchId: pedido.sucursal_id,
      riderId: pedido.repartidor_id ?? undefined,
    });

    if (!decision.allowed) {
      throw new ForbiddenException(decision.reason);
    }
  }

  /**
   * Consulta de pedido individual con filtrado por rol y relaciones.
   */
  async getOrderById(
    actor: ActorContext,
    orderId: string
  ): Promise<PedidoEntity | null> {
    const pedidoRepo = this.dataSource.getRepository(PedidoEntity);
    const query = pedidoRepo
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.cliente", "c")
      .leftJoinAndSelect("p.sucursal", "s")
      .leftJoinAndSelect("p.repartidor", "r")
      .leftJoinAndSelect("p.items", "items")
      .where("p.id = :orderId AND p.inquilino_id = :tenantId", {
        orderId,
        tenantId: actor.tenantId,
      });

    if (actor.role === "BRANCH_MANAGER") {
      if (actor.branchIds.length === 0) {
        query.andWhere("1 = 0");
      } else {
        query.andWhere("p.sucursal_id IN (:...branchIds)", {
          branchIds: actor.branchIds,
        });
      }
    }

    if (actor.role === "RIDER") {
      if (!actor.riderId) {
        query.andWhere("1 = 0");
      } else {
        query.andWhere("p.repartidor_id = :riderId", { riderId: actor.riderId });
      }
    }

    return query.getOne();
  }

  /**
   * Lista pedidos activos para el tablero Kanban y monitoreo.
   */
  async getActiveOrders(actor: ActorContext, sucursalId?: string): Promise<PedidoEntity[]> {
    const pedidoRepo = this.dataSource.getRepository(PedidoEntity);
    const query = pedidoRepo
      .createQueryBuilder("p")
      .leftJoinAndSelect("p.cliente", "c")
      .leftJoinAndSelect("p.sucursal", "s")
      .leftJoinAndSelect("p.repartidor", "r")
      .leftJoinAndSelect("p.items", "items")
      .leftJoinAndSelect("items.producto", "producto")
      .where("p.inquilino_id = :tenantId", { tenantId: actor.tenantId })
      .andWhere(
        "p.estado_operativo NOT IN ('ENTREGADO', 'CANCELADO', 'RECHAZADO', 'DEVUELTO_A_RESTAURANTE')"
      );

    if (sucursalId) {
      query.andWhere("p.sucursal_id = :sucursalId", { sucursalId });
    }

    if (actor.role === "BRANCH_MANAGER") {
      if (actor.branchIds.length === 0) {
        query.andWhere("1 = 0");
      } else {
        query.andWhere("p.sucursal_id IN (:...branchIds)", {
          branchIds: actor.branchIds,
        });
      }
    }

    // Privacidad por asignación: el repartidor solo ve pedidos que tiene asignados.
    if (actor.role === "RIDER") {
      if (!actor.riderId) {
        query.andWhere("1 = 0");
      } else {
        query.andWhere("p.repartidor_id = :riderId", { riderId: actor.riderId });
      }
    }

    return query.orderBy("p.creado_en", "ASC").getMany();
  }

  /**
   * Obtiene la información pública de un pedido por su token_publico (sin auth).
   */
  async getPublicOrderByToken(token: string) {
    const orderRepo = this.dataSource.getRepository(PedidoEntity);
    const order = await orderRepo.findOne({
      where: { token_publico: token },
      relations: ["sucursal", "items", "repartidor"],
    });

    if (!order) {
      throw new NotFoundException("Pedido no encontrado con el código provisto");
    }

    return {
      id: order.id,
      numero: order.numero,
      token_publico: order.token_publico,
      estado_operativo: order.estado_operativo,
      estado_pago: order.estado_pago,
      metodo_pago: order.metodo_pago,
      direccion_snapshot: order.direccion_snapshot,
      total_centavos: order.total_centavos,
      subtotal_items_centavos: order.subtotal_items_centavos,
      tarifa_entrega_centavos: order.tarifa_entrega_centavos,
      creado_en: order.creado_en,
      sucursal: order.sucursal
        ? {
            nombre: order.sucursal.nombre,
            direccion: order.sucursal.direccion,
            telefono: order.sucursal.telefono,
          }
        : null,
      repartidor: order.repartidor
        ? {
            nombre_completo: order.repartidor.nombre_completo,
            tipo_vehiculo: order.repartidor.tipo_vehiculo,
          }
        : null,
      items: (order.items ?? []).map((i) => ({
        id: i.id,
        nombre_snapshot: i.nombre_snapshot,
        cantidad: i.cantidad,
        precio_unitario_centavos: i.precio_unitario_centavos,
        total_linea_centavos: i.total_linea_centavos,
      })),
    };
  }

  /**
   * Obtiene las métricas y KPIs operacionales del inquilino.
   */
  async getStatsOverview(actor: ActorContext) {
    const orderRepo = this.dataSource.getRepository(PedidoEntity);
    const riderRepo = this.dataSource.getRepository(RepartidorEntity);

    const orders = await orderRepo.find({
      where: { inquilino_id: actor.tenantId },
    });

    const activeOrders = orders.filter(
      (o) =>
        ![
          "ENTREGADO",
          "CANCELADO",
          "RECHAZADO",
          "DEVUELTO_A_RESTAURANTE",
        ].includes(o.estado_operativo)
    );
    const deliveredOrders = orders.filter(
      (o) => o.estado_operativo === "ENTREGADO"
    );

    const totalSalesCents = orders
      .filter(
        (o) => o.estado_pago === "PAGADO" || o.estado_operativo === "ENTREGADO"
      )
      .reduce((acc, o) => acc + Number(o.total_centavos || 0), 0);

    const activeRidersCount = await riderRepo.count({
      where: {
        inquilino_id: actor.tenantId,
        estado: In(["DISPONIBLE", "OCUPADO", "EN_CAMINO"]),
      },
    });

    const cashOrdersCount = orders.filter(
      (o) => o.metodo_pago === "EFECTIVO"
    ).length;
    const yapeOrdersCount = orders.filter((o) => o.metodo_pago === "YAPE").length;

    return {
      activeOrdersCount: activeOrders.length,
      deliveredOrdersCount: deliveredOrders.length,
      totalOrdersCount: orders.length,
      totalSalesCents,
      totalSalesSoles: totalSalesCents / 100,
      activeRidersCount,
      cashOrdersCount,
      yapeOrdersCount,
    };
  }

  /**
   * Pedido creado por el cliente desde la carta pública (sin login).
   * El pedido nace en NUEVO y aparece en el tablero del Coordinador / Soporte.
   * Cada sucursal es independiente: solo se aceptan platos de la carta de esa sucursal.
   */
  async createPublicOrder(input: {
    sucursal_slug: string;
    cliente: { nombre: string; telefono: string };
    direccion: { texto: string; referencia?: string | null; latitud?: number | null; longitud?: number | null };
    metodo_pago: "EFECTIVO" | "YAPE" | "TRANSFERENCIA_BANCARIA";
    notas?: string | null;
    items: Array<{ producto_id: string; cantidad: number }>;
  }): Promise<{ numero: string; token_publico: string; total_centavos: string }> {
    const sucursalRepo = this.dataSource.getRepository(SucursalEntity);
    const productoRepo = this.dataSource.getRepository(ProductoEntity);

    const sucursal = await sucursalRepo.findOne({
      where: { slug: input.sucursal_slug, esta_activo: true },
    });
    if (!sucursal) throw new NotFoundException("Sucursal no encontrada");
    if (!sucursal.apertura_manual) {
      throw new BadRequestException("La sucursal está cerrada en este momento");
    }

    const nombre = input.cliente?.nombre?.trim() ?? "";
    const telefono = (input.cliente?.telefono ?? "").replace(/[\s-]/g, "");
    const telE164 = telefono.startsWith("+") ? telefono : `+51${telefono}`;
    if (nombre.length < 2) throw new BadRequestException("Indica tu nombre");
    if (!/^\+[1-9]\d{7,14}$/.test(telE164)) throw new BadRequestException("Teléfono inválido");
    if (!input.direccion?.texto || input.direccion.texto.trim().length < 3) {
      throw new BadRequestException("Indica la dirección de entrega");
    }
    if (!["EFECTIVO", "YAPE", "TRANSFERENCIA_BANCARIA"].includes(input.metodo_pago)) {
      throw new BadRequestException("Método de pago inválido");
    }
    if (!Array.isArray(input.items) || input.items.length === 0 || input.items.length > 50) {
      throw new BadRequestException("El pedido debe tener entre 1 y 50 platos");
    }
    for (const it of input.items) {
      if (!Number.isInteger(it.cantidad) || it.cantidad < 1 || it.cantidad > 50) {
        throw new BadRequestException("Cantidad inválida");
      }
    }

    // Independencia por sucursal: todos los platos deben pertenecer a su carta.
    const ids = [...new Set(input.items.map((i) => i.producto_id))];
    const validos = await productoRepo.find({
      where: {
        id: In(ids),
        inquilino_id: sucursal.inquilino_id,
        restaurante_id: sucursal.restaurante_id,
        esta_activo: true,
      },
    });
    if (validos.length !== ids.length) {
      throw new BadRequestException("Algún plato no pertenece a esta sucursal o no está disponible");
    }

    const actor = {
      tenantId: sucursal.inquilino_id,
      userId: null,
      role: "SUPPORT_AGENT",
      branchIds: [],
      requestId: randomBytes(8).toString("hex"),
    } as unknown as ActorContext;

    const pedido = await this.createManualOrder(actor, {
      sucursal_id: sucursal.id,
      cliente_nuevo: { nombre, telefono_e164: telE164 },
      direccion_snapshot: {
        texto_direccion: input.direccion.texto.trim(),
        referencia: input.direccion.referencia ?? null,
        latitud: input.direccion.latitud ?? null,
        longitud: input.direccion.longitud ?? null,
      },
      canal: "WEB",
      metodo_pago: input.metodo_pago,
      efectivo_por_cobrar_centavos: 0,
      factura_solicitada: false,
      notas: input.notas ?? null,
      items: input.items.map((i) => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        modificadores: [],
      })),
    } as CrearPedidoManualInput);

    return {
      numero: String(pedido.numero),
      token_publico: pedido.token_publico,
      total_centavos: String(pedido.total_centavos),
    };
  }
}
