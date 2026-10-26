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
} from "@zero-delivery/database";
import {
  ActorContext,
  EstadoOperativoPedidoDb,
  CrearPedidoManualInput,
  PermissionKey,
  can,
} from "@zero-delivery/shared-types";
import { evaluateReleaseGate } from "./release-gate";
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
    const pedidoRepo = this.dataSource.getRepository(PedidoEntity);
    const pedido = await pedidoRepo.findOne({
      where: { id: orderId, inquilino_id: actor.tenantId },
    });

    if (!pedido) {
      throw new NotFoundException("Pedido no encontrado");
    }

    this.assertOrderPermission(actor, "order.handoff_to_rider", pedido);

    pedido.traspaso_en = new Date();
    pedido.traspaso_por = actor.userId;
    await pedidoRepo.save(pedido);

    return (await this.getOrderById(actor, orderId))!;
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
}
