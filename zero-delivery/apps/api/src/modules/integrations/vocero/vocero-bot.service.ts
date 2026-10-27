import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  OnModuleInit,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  AlertaEntity,
  ClienteEntity,
  EventoEntradaEntity,
  InquilinoEntity,
  RegistroAuditoriaEntity,
} from "@zero-delivery/database";
import {
  ActorContext,
  DecisionBotRegistro,
  MetodoPagoDb,
  VoceroDispatchEvent,
  formatPen,
  voceroDispatchEventSchema,
} from "@zero-delivery/shared-types";
import { OrdersService } from "../../orders/orders.service";
import { LogisticsService } from "../../logistics/logistics.service";
import { VoceroClientService } from "./vocero-client.service";

export const ESTADO_PEDIDO_ETIQUETA_ES: Record<string, string> = {
  NUEVO: "Nuevo (recibido)",
  CONFIRMADO: "Confirmado por el local",
  EN_PREPARACION: "En preparación en cocina",
  LISTO: "Listo para recojo",
  REPARTIDOR_ASIGNADO: "Repartidor asignado",
  REPARTIDOR_EN_RECOJO: "Repartidor en el local",
  EN_CAMINO: "En camino a tu dirección",
  ENTREGADO: "Entregado",
  ENTREGA_FALLIDA: "Entrega fallida (en coordinación)",
  PENDIENTE_RESOLUCION: "Pendiente de resolución humana",
  CANCELACION_SOLICITADA: "Cancelación en revisión",
  CANCELADO: "Cancelado",
};

@Injectable()
export class VoceroBotService implements OnModuleInit {
  private readonly logger = new Logger(VoceroBotService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly logisticsService: LogisticsService,
    private readonly voceroClient: VoceroClientService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const tenantId = await this.resolveDefaultTenantId();
      if (!tenantId) return;

      // Inicializar por única vez la bandera de Hito 4 encendida para que el conector esté listo
      const initRows: Array<{ valor: unknown }> = await this.dataSource.query(
        `SELECT valor FROM configuraciones WHERE inquilino_id = $1 AND clave = 'bot.inicializado_hito4' LIMIT 1`,
        [tenantId],
      );
      if (initRows.length === 0) {
        await this.upsertSetting(
          tenantId,
          "funcionalidad.integracion.vocero",
          true,
          null,
        );
        await this.upsertSetting(
          tenantId,
          "bot.auto_asignar_repartidor",
          true,
          null,
        );
        await this.upsertSetting(
          tenantId,
          "bot.auto_confirmar_efectivo",
          true,
          null,
        );
        await this.upsertSetting(
          tenantId,
          "bot.inicializado_hito4",
          true,
          null,
        );
      }

      await this.syncRuntimeClientConfig(tenantId);
      await this.healFailedInboundEvents(tenantId);
    } catch (err) {
      this.logger.warn(
        `No se pudo inicializar configuración por defecto del Bot Vocero: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async getStringSetting(
    tenantId: string,
    clave: string,
  ): Promise<string | null> {
    const rows: Array<{ valor: unknown }> = await this.dataSource
      .query(
        `SELECT valor FROM configuraciones WHERE inquilino_id = $1 AND clave = $2 LIMIT 1`,
        [tenantId, clave],
      )
      .catch(() => []);
    if (!rows[0]) return null;
    const v = rows[0].valor;
    if (typeof v === "string" && v.trim()) return v.trim();
    return null;
  }

  private async syncRuntimeClientConfig(tenantId: string): Promise<void> {
    const savedBaseUrl = await this.getStringSetting(
      tenantId,
      "vocero.base_url",
    );
    const savedApiKey = await this.getStringSetting(
      tenantId,
      "vocero.bot_api_key",
    );
    this.voceroClient.setRuntimeConfig({
      baseUrl: savedBaseUrl,
      botApiKey: savedApiKey,
    });
  }

  /**
   * Reprocesa automáticamente cualquier evento entrante que haya quedado FALLIDO
   * por error temporal de consulta SQL, garantizando que el historial quede íntegro.
   */
  private async healFailedInboundEvents(tenantId: string): Promise<void> {
    const failedRows: Array<{ id: string; datos: any }> = await this.dataSource
      .query(
        `SELECT id, datos FROM eventos_entrada
WHERE proveedor = 'vocero'
AND estado = 'FALLIDO'
AND error LIKE '%margen_centavos%'
ORDER BY recibido_en ASC
LIMIT 10`,
      )
      .catch(() => []);

    if (failedRows.length === 0) return;

    const enabled = await this.isIntegrationEnabled(tenantId);
    for (const row of failedRows) {
      try {
        const parsed = voceroDispatchEventSchema.safeParse(row.datos);
        if (!parsed.success) continue;
        const decision = await this.evaluateAndExecuteBotTurn(
          tenantId,
          parsed.data,
          Date.now() - 45,
          enabled,
        );
        await this.dataSource.query(
          `UPDATE eventos_entrada
SET estado = 'PROCESADO', procesado_en = now(), error = $1
WHERE id = $2`,
          [JSON.stringify(decision), row.id],
        );
      } catch {
        // ignore
      }
    }
  }

  /**
   * Resuelve el inquilino activo por slug o toma el primer inquilino activo.
   */
  async resolveDefaultTenantId(slug?: string | null): Promise<string | null> {
    const repo = this.dataSource.getRepository(InquilinoEntity);
    if (slug) {
      const bySlug = await repo.findOne({ where: { slug } });
      if (bySlug) return bySlug.id;
    }
    const first = await repo.findOne({
      where: {},
      order: { creado_en: "ASC" },
    });
    return first?.id ?? null;
  }

  /**
   * Construye un ActorContext válido con el usuario administrador del inquilino
   * para que el Bot pueda crear pedidos, confirmar estados y asignar repartidores.
   */
  async getBotActor(tenantId: string): Promise<ActorContext> {
    const rows: Array<{ id: string }> = await this.dataSource
      .query(
        `SELECT id FROM usuarios WHERE inquilino_id = $1 AND esta_activo = true ORDER BY creado_en ASC LIMIT 1`,
        [tenantId],
      )
      .catch(() => []);

    return {
      userId: rows[0]?.id ?? "00000000-0000-0000-0000-000000000000",
      tenantId,
      role: "ADMIN",
      branchIds: [],
      requestId: `bot_${Date.now()}`,
    };
  }

  private async getBooleanSetting(
    tenantId: string,
    clave: string,
    fallback: boolean,
  ): Promise<boolean> {
    const rows: Array<{ valor: unknown }> = await this.dataSource
      .query(
        `SELECT valor FROM configuraciones WHERE inquilino_id = $1 AND clave = $2 LIMIT 1`,
        [tenantId, clave],
      )
      .catch(() => []);
    if (!rows[0]) return fallback;
    const v = rows[0].valor;
    if (typeof v === "boolean") return v;
    if (typeof v === "string")
      return v.replace(/"/g, "").toLowerCase() === "true";
    return Boolean(v);
  }

  private async upsertSetting(
    tenantId: string,
    clave: string,
    valor: unknown,
    userId: string | null,
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO configuraciones (inquilino_id, clave, valor, es_marcador, actualizado_por, actualizado_en)
VALUES ($1, $2, $3::jsonb, false, $4, now())
ON CONFLICT (inquilino_id, clave)
DO UPDATE SET valor = EXCLUDED.valor, es_marcador = false, actualizado_por = EXCLUDED.actualizado_por, actualizado_en = now()`,
      [tenantId, clave, JSON.stringify(valor), userId],
    );
  }

  /**
   * Consulta si el conector bidireccional con Vocero CRM está ENCENDIDO o APAGADO.
   */
  async isIntegrationEnabled(tenantId?: string): Promise<boolean> {
    const resolvedTenantId = tenantId ?? (await this.resolveDefaultTenantId());
    if (!resolvedTenantId) return false;
    return this.getBooleanSetting(
      resolvedTenantId,
      "funcionalidad.integracion.vocero",
      true,
    );
  }

  /**
   * Estado de salud para Vocero CRM (GET /api/v1/webhooks/vocero/health).
   * Compatible tanto con 06-VOCERO_CRM.md como con fetchBrainHealth de vocero-crm.
   */
  async getWebhookHealth() {
    const tenantId = await this.resolveDefaultTenantId();
    const enabled = tenantId
      ? await this.isIntegrationEnabled(tenantId)
      : false;

    const outboxStats: Array<{
      pendientes: number;
      mas_viejo_seg: number | null;
      ultimo_error_en: string | null;
    }> = tenantId
      ? await this.dataSource
          .query(
            `SELECT
COUNT(*) FILTER (WHERE estado IN ('PENDIENTE', 'FALLIDO'))::int AS pendientes,
EXTRACT(EPOCH FROM (now() - MIN(creado_en) FILTER (WHERE estado IN ('PENDIENTE', 'FALLIDO'))))::int AS mas_viejo_seg,
MAX(procesado_en) FILTER (WHERE estado IN ('FALLIDO', 'MUERTO'))::text AS ultimo_error_en
FROM eventos_salida
WHERE inquilino_id = $1`,
            [tenantId],
          )
          .catch(() => [])
      : [];

    const relayRow = outboxStats[0];

    return {
      ok: enabled,
      status: enabled ? "ok" : "disabled",
      voceroIntegrationEnabled: enabled,
      service: "zero-delivery-vocero-brain",
      version: "4.0.0",
      mode: "estándar",
      relay: {
        pendientes: relayRow?.pendientes ?? 0,
        masViejoSegundos: relayRow?.mas_viejo_seg ?? null,
        ultimoErrorEn: relayRow?.ultimo_error_en ?? null,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Cambia en caliente el interruptor de conexión (ON/OFF), las opciones de automatización
   * y los parámetros de enlace en producción con Vocero CRM.
   */
  async toggleConnection(
    actor: ActorContext,
    input: {
      enabled?: boolean;
      autoAssignRider?: boolean;
      autoConfirmCash?: boolean;
      voceroBaseUrl?: string;
      botApiKey?: string;
    },
  ) {
    if (typeof input.enabled === "boolean") {
      await this.upsertSetting(
        actor.tenantId,
        "funcionalidad.integracion.vocero",
        input.enabled,
        actor.userId,
      );
      await this.upsertSetting(
        actor.tenantId,
        "feature.integration.vocero",
        input.enabled,
        actor.userId,
      );
    }

    if (typeof input.autoAssignRider === "boolean") {
      await this.upsertSetting(
        actor.tenantId,
        "bot.auto_asignar_repartidor",
        input.autoAssignRider,
        actor.userId,
      );
    }

    if (typeof input.autoConfirmCash === "boolean") {
      await this.upsertSetting(
        actor.tenantId,
        "bot.auto_confirmar_efectivo",
        input.autoConfirmCash,
        actor.userId,
      );
    }

    if (typeof input.voceroBaseUrl === "string" && input.voceroBaseUrl.trim()) {
      const cleanUrl = input.voceroBaseUrl.trim().replace(/\/+$/, "");
      await this.upsertSetting(
        actor.tenantId,
        "vocero.base_url",
        cleanUrl,
        actor.userId,
      );
      this.voceroClient.setRuntimeConfig({ baseUrl: cleanUrl });
    }

    if (
      typeof input.botApiKey === "string" &&
      input.botApiKey.trim().length >= 16
    ) {
      const cleanKey = input.botApiKey.trim();
      await this.upsertSetting(
        actor.tenantId,
        "vocero.bot_api_key",
        cleanKey,
        actor.userId,
      );
      this.voceroClient.setRuntimeConfig({ botApiKey: cleanKey });
    }

    const enabled = await this.isIntegrationEnabled(actor.tenantId);
    const autoAssignRider = await this.getBooleanSetting(
      actor.tenantId,
      "bot.auto_asignar_repartidor",
      true,
    );
    const autoConfirmCash = await this.getBooleanSetting(
      actor.tenantId,
      "bot.auto_confirmar_efectivo",
      true,
    );

    const auditRepo = this.dataSource.getRepository(RegistroAuditoriaEntity);
    await auditRepo.save(
      auditRepo.create({
        inquilino_id: actor.tenantId,
        actor_id: actor.userId,
        rol_actor: actor.role,
        accion: enabled ? "BOT_CONEXION_ENCENDIDA" : "BOT_CONEXION_APAGADA",
        tipo_objeto: "CONFIGURACION_VOCERO",
        objeto_id: "funcionalidad.integracion.vocero",
        despues: {
          enabled,
          autoAssignRider,
          autoConfirmCash,
          voceroBaseUrl: this.voceroClient.getBaseUrl(),
        },
      }),
    );

    const voceroHealth = await this.voceroClient.checkVoceroHealth();

    return {
      enabled,
      autoAssignRider,
      autoConfirmCash,
      voceroBaseUrl: this.voceroClient.getBaseUrl(),
      voceroReachable: voceroHealth.reachable,
      voceroHealthDetail: voceroHealth.detail,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Provee al Bot de Vocero CRM visibilidad completa del estado del sistema de delivery:
   * - Sucursales activas y sus platos con precios reales en S/
   * - Pedidos activos e historial del cliente (si se envía teléfono o conversationId)
   * - Repartidores disponibles y estado operativo general
   */
  async getSystemContextForBot(params: {
    tenantId?: string;
    telefono?: string;
    conversationId?: string;
  }) {
    const tenantId = params.tenantId ?? (await this.resolveDefaultTenantId());
    if (!tenantId) throw new NotFoundException("Inquilino no encontrado");

    const enabled = await this.isIntegrationEnabled(tenantId);

    // 1. Sucursales independientes activas y sus platos
    const branches: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT s.id, s.nombre, s.slug, s.direccion, s.telefono, s.latitud, s.longitud,
s.restaurante_id, r.nombre AS restaurante_nombre
FROM sucursales s
JOIN restaurantes r ON r.id = s.restaurante_id
WHERE s.inquilino_id = $1 AND s.esta_activo = true
ORDER BY s.nombre ASC`,
      [tenantId],
    );

    const products: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT p.id, p.restaurante_id, p.categoria_id, p.nombre, p.descripcion,
p.precio_base_centavos, p.empaque_centavos, p.tipo_margen, p.valor_margen,
p.esta_activo, p.es_fragil, COALESCE(c.nombre, 'General') AS categoria_nombre
FROM productos p
LEFT JOIN categorias c ON c.id = p.categoria_id
WHERE p.inquilino_id = $1 AND p.archivado_en IS NULL
ORDER BY p.nombre ASC`,
      [tenantId],
    );

    const appPublicUrl = (
      process.env["APP_PUBLIC_URL"] || "http://localhost:3001"
    ).replace(/\/+$/, "");

    const sucursalesConCarta = branches.map((b) => {
      const platos = products
        .filter((p) => p.restaurante_id === b.restaurante_id)
        .map((p) => {
          const totalCents =
            BigInt(p.precio_base_centavos ?? "0") +
            BigInt(p.empaque_centavos ?? "0");
          return {
            id: p.id,
            nombre: p.nombre,
            descripcion: p.descripcion,
            categoria: p.categoria_nombre,
            precio_centavos: totalCents.toString(),
            precio_soles: formatPen(totalCents),
            disponible: Boolean(p.esta_activo),
            es_fragil: Boolean(p.es_fragil),
          };
        });

      return {
        id: b.id,
        nombre: b.nombre,
        slug: b.slug,
        direccion: b.direccion,
        telefono: b.telefono,
        latitud: b.latitud !== null ? Number(b.latitud) : null,
        longitud: b.longitud !== null ? Number(b.longitud) : null,
        url_carta_digital: `${appPublicUrl}/m/${b.slug}`,
        platos,
      };
    });

    // 2. Repartidores disponibles en tiempo real
    const riders: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT r.id, r.nombre_completo, r.tipo_vehiculo, r.estado, r.alta_confianza,
COALESCE((SELECT avg(estrellas)::numeric(3,2) FROM calificaciones WHERE tipo_sujeto = 'REPARTIDOR' AND sujeto_id = r.id), 5.0) AS estrellas,
COALESCE((SELECT sum(monto_centavos) FROM movimientos_billetera WHERE repartidor_id = r.id AND inquilino_id = $1), 0)::text AS saldo_garantia_centavos
FROM repartidores r
WHERE r.inquilino_id = $1 AND r.esta_activo = true
ORDER BY r.estado ASC, r.nombre_completo ASC`,
      [tenantId],
    );

    // 3. Si hay teléfono o conversationId, buscar cliente y sus pedidos recientes
    let clienteInfo: Record<string, any> | null = null;
    let pedidosCliente: Array<Record<string, any>> = [];

    const normalizedPhone = params.telefono
      ? this.normalizePhone(params.telefono)
      : null;

    if (normalizedPhone || params.conversationId) {
      const clientesRows: Array<Record<string, any>> =
        await this.dataSource.query(
          `SELECT id, nombre, telefono_e164, segmento, marca_riesgo
FROM clientes
WHERE inquilino_id = $1
AND (
($2::text IS NOT NULL AND replace(telefono_e164, '+', '') LIKE '%' || replace($2::text, '+', ''))
OR ($3::text IS NOT NULL AND notas LIKE '%' || $3::text || '%')
)
ORDER BY actualizado_en DESC
LIMIT 1`,
          [tenantId, normalizedPhone, params.conversationId ?? null],
        );

      if (clientesRows[0]) {
        clienteInfo = clientesRows[0];
        const ordersRows: Array<Record<string, any>> =
          await this.dataSource.query(
            `SELECT p.id, p.numero, p.estado_operativo, p.estado_pago, p.metodo_pago,
p.total_centavos, p.efectivo_por_cobrar_centavos, p.token_publico,
p.creado_en, p.direccion_snapshot,
s.nombre AS sucursal_nombre,
r.nombre_completo AS repartidor_nombre, r.tipo_vehiculo AS repartidor_vehiculo, r.telefono AS repartidor_telefono
FROM pedidos p
JOIN sucursales s ON s.id = p.sucursal_id
LEFT JOIN repartidores r ON r.id = p.repartidor_id
WHERE p.inquilino_id = $1 AND p.cliente_id = $2
ORDER BY p.creado_en DESC
LIMIT 5`,
            [tenantId, clienteInfo.id],
          );

        pedidosCliente = ordersRows.map((o) => ({
          id: o.id,
          numero: `#${o.numero}`,
          estado_codigo: o.estado_operativo,
          estado_etiqueta:
            ESTADO_PEDIDO_ETIQUETA_ES[o.estado_operativo] ?? o.estado_operativo,
          estado_pago: o.estado_pago,
          metodo_pago: o.metodo_pago,
          total_soles: formatPen(BigInt(o.total_centavos ?? "0")),
          sucursal: o.sucursal_nombre,
          repartidor: o.repartidor_nombre
            ? {
                nombre: o.repartidor_nombre,
                vehiculo: o.repartidor_vehiculo,
                telefono: o.repartidor_telefono,
              }
            : null,
          url_seguimiento: `${appPublicUrl}/p/${o.token_publico}`,
          creado_en: o.creado_en,
        }));
      }
    }

    return {
      integracion_activa: enabled,
      directorio_general_url: `${appPublicUrl}/m`,
      sucursales: sucursalesConCarta,
      repartidores_activos: riders.map((r) => ({
        id: r.id,
        nombre: r.nombre_completo,
        vehiculo: r.tipo_vehiculo,
        estado: r.estado,
        estrellas: Number(r.estrellas ?? 5),
        garantia_soles: formatPen(BigInt(r.saldo_garantia_centavos ?? "0")),
        elegible_efectivo:
          BigInt(r.saldo_garantia_centavos ?? "0") >= BigInt(5000),
      })),
      cliente: clienteInfo,
      pedidos_cliente: pedidosCliente,
    };
  }

  /**
   * Procesa un despacho entrante desde Vocero CRM (POST /api/v1/webhooks/vocero).
   */
  async handleWebhookDispatch(params: {
    rawBody: string;
    signatureHeader?: string | null;
    apiKeyHeader?: string | null;
    eventTypeHeader?: string | null;
    body: unknown;
    skipSignatureCheck?: boolean;
  }) {
    const startTime = Date.now();
    const tenantId = await this.resolveDefaultTenantId();
    if (!tenantId) {
      throw new NotFoundException("Inquilino no configurado");
    }

    // 1. Si el interruptor de conexión está APAGADO, responder 404 (invariante 06-VOCERO_CRM.md)
    const enabled = await this.isIntegrationEnabled(tenantId);
    if (!enabled) {
      throw new NotFoundException(
        "La integración con Vocero CRM está apagada por el Coordinador/Administrador",
      );
    }

    // 2. Verificar firma HMAC-SHA256 o X-API-Key
    if (!params.skipSignatureCheck) {
      const valid = this.voceroClient.verifySignature(
        params.rawBody,
        params.signatureHeader,
        params.apiKeyHeader,
      );
      if (!valid) {
        throw new UnauthorizedException("Firma HMAC de Vocero CRM inválida");
      }
    }

    // 3. Evento de olvido (conversation.deleted)
    const bodyObj = (params.body ?? {}) as Record<string, unknown>;
    if (
      params.eventTypeHeader === "conversation.deleted" ||
      bodyObj["type"] === "conversation.deleted"
    ) {
      return {
        received: true,
        ignored: true,
        reason: "CONVERSATION_DELETED_ACK",
      };
    }

    // 4. Validar esquema Zod EventoDespacho
    const parsed = voceroDispatchEventSchema.safeParse(params.body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: "Payload de EventoDespacho inválido",
        issues: parsed.error.issues,
      });
    }

    const event: VoceroDispatchEvent = parsed.data;

    // 5. Idempotencia en `eventos_entrada`
    const existingRows: Array<{
      id: string;
      estado: string;
      error: string | null;
    }> = await this.dataSource.query(
      `SELECT id, estado, error FROM eventos_entrada
WHERE proveedor = 'vocero' AND id_evento_externo = $1
LIMIT 1`,
      [event.dispatchId],
    );

    let inboundId: string;
    if (existingRows[0]) {
      if (
        existingRows[0].estado === "PROCESADO" ||
        existingRows[0].estado === "IGNORADO"
      ) {
        let decisionPrevia: unknown = null;
        if (existingRows[0].error) {
          try {
            decisionPrevia = JSON.parse(existingRows[0].error);
          } catch {
            decisionPrevia = existingRows[0].error;
          }
        }
        return {
          received: true,
          deduplicated: true,
          dispatchId: event.dispatchId,
          status: existingRows[0].estado,
          decision: decisionPrevia,
        };
      }
      inboundId = existingRows[0].id;
    } else {
      const inserted: Array<{ id: string }> = await this.dataSource.query(
        `INSERT INTO eventos_entrada (proveedor, id_evento_externo, datos, estado, intentos, recibido_en)
VALUES ('vocero', $1, $2::jsonb, 'RECIBIDO', 1, now())
RETURNING id`,
        [event.dispatchId, JSON.stringify(event)],
      );
      inboundId = inserted[0]!.id;
    }

    // 6. Ignorar conversaciones de prueba del Laboratorio (test: true)
    if (event.conversation.test) {
      const decisionTest: DecisionBotRegistro = {
        dispatch_id: event.dispatchId,
        conversation_id: event.conversation.id,
        canal: event.conversation.channel,
        cliente_nombre: event.contact.displayName,
        cliente_telefono: event.contact.identity,
        mensaje_entrante: event.messages
          .map((m) => m.text || m.caption || `[${m.type}]`)
          .join(" | "),
        tipo_decision: "IGNORADO_TEST",
        resuelto_por_bot: true,
        escalado_a_humano: false,
        motivo_decision:
          "Conversación de prueba del Laboratorio (test: true) ignorada por regla de negocio",
        respuesta_bot: null,
        duracion_ms: Date.now() - startTime,
        fecha: new Date().toISOString(),
      };

      await this.dataSource.query(
        `UPDATE eventos_entrada
SET estado = 'IGNORADO', procesado_en = now(), error = $1
WHERE id = $2`,
        [JSON.stringify(decisionTest), inboundId],
      );

      return {
        received: true,
        ignored: true,
        reason: "TEST_CONVERSATION",
        decision: decisionTest,
      };
    }

    // 7. Indicar "escribiendo..." en Vocero CRM y guardar vínculo teléfono <-> conversationId
    void this.voceroClient.sendTyping(event.conversation.id, enabled);
    await this.saveConversationMapping(
      tenantId,
      event.contact.identity,
      event.conversation.id,
      event.contact.displayName,
    );

    // 8. Ejecutar el motor de decisiones del Bot según el estado real del sistema
    try {
      const decision = await this.evaluateAndExecuteBotTurn(
        tenantId,
        event,
        startTime,
        enabled,
      );

      // Actualizar únicamente las columnas permitidas por guardia_eventos_entrada_trg
      await this.dataSource.query(
        `UPDATE eventos_entrada
SET estado = 'PROCESADO', procesado_en = now(), intentos = 1, error = $1
WHERE id = $2`,
        [JSON.stringify(decision), inboundId],
      );

      // Registrar en bitácora de auditoría para trazabilidad histórica completa
      const auditRepo = this.dataSource.getRepository(RegistroAuditoriaEntity);
      await auditRepo.save(
        auditRepo.create({
          inquilino_id: tenantId,
          actor_id: null,
          rol_actor: "BOT_VOCERO",
          accion: `BOT_${decision.tipo_decision}`,
          tipo_objeto: "BOT_VOCERO",
          objeto_id: event.dispatchId,
          despues: decision as unknown as Record<string, unknown>,
        }),
      );

      return {
        received: true,
        dispatchId: event.dispatchId,
        decision,
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      await this.dataSource.query(
        `UPDATE eventos_entrada
SET estado = 'FALLIDO', procesado_en = now(), intentos = intentos + 1, error = $1
WHERE id = $2`,
        [errMsg, inboundId],
      );
      throw err;
    }
  }

  /**
   * Motor central de decisiones del Bot.
   */
  private async evaluateAndExecuteBotTurn(
    tenantId: string,
    event: VoceroDispatchEvent,
    startTime: number,
    integrationEnabled: boolean,
  ): Promise<DecisionBotRegistro> {
    const combinedText = event.messages
      .map((m) => m.text || m.caption || "")
      .filter(Boolean)
      .join(" ")
      .trim();

    const normalizedText = this.normalizeText(combinedText);
    const hasMedia = event.messages.some((m) => Boolean(m.mediaId));
    const locationMsg = event.messages.find((m) =>
      Boolean(m.location),
    )?.location;

    const appPublicUrl = (
      process.env["APP_PUBLIC_URL"] || "http://localhost:3001"
    ).replace(/\/+$/, "");

    // Obtener contexto actual del cliente y del sistema
    const context = await this.getSystemContextForBot({
      tenantId,
      telefono: event.contact.identity,
      conversationId: event.conversation.id,
    });

    const ultimoPedido = context.pedidos_cliente[0] ?? null;

    // =========================================================================
    // CASO 1: Comprobante de pago adjunto (imagen/documento) -> SIEMPRE validación humana
    // =========================================================================
    if (hasMedia) {
      const mediaMsg = event.messages.find((m) => Boolean(m.mediaId))!;
      const mediaInfo = await this.voceroClient.downloadMediaInfo(
        mediaMsg.mediaId!,
        integrationEnabled,
      );

      const motivo = ultimoPedido
        ? `El cliente envió un comprobante (${mediaInfo.mimeType ?? "imagen"}) para el pedido ${ultimoPedido.numero} (${ultimoPedido.total_soles}). Requiere validación humana de pago antes de despachar.`
        : `El cliente envió un archivo/comprobante adjunto por WhatsApp. Requiere validación humana del Coordinador o Administrador.`;

      const alerta = await this.createBotEscalationAlert({
        tenantId,
        tipo: "BOT_VALIDACION_PAGO",
        severidad: "ADVERTENCIA",
        pedidoId: ultimoPedido?.id ?? null,
        conversationId: event.conversation.id,
        clienteNombre: event.contact.displayName,
        clienteTelefono: event.contact.identity,
        mensajeCliente:
          combinedText || `[Comprobante adjunto: ${mediaMsg.mediaId}]`,
        motivoEscalado: motivo,
        sugerenciaAccion:
          "Verificar el abono en Yape/Banca, ir a Pagos o Detalle del Pedido y confirmar el pago manualmente.",
      });

      const reply = ultimoPedido
        ? ` Recibimos tu comprobante para el pedido ${ultimoPedido.numero} por ${ultimoPedido.total_soles}. Por seguridad financiera, nuestro Coordinador ya fue notificado y está validando tu pago en este momento. Te avisaremos apenas quede confirmado.`
        : ` Recibimos tu comprobante. He notificado a nuestro Coordinador de Soporte para que valide la operación y te atienda enseguida.`;

      await this.voceroClient.sendMessage(
        event.conversation.id,
        reply,
        integrationEnabled,
      );
      await this.voceroClient.requestHandoff(
        event.conversation.id,
        "modelo",
        integrationEnabled,
      );

      return {
        dispatch_id: event.dispatchId,
        conversation_id: event.conversation.id,
        canal: event.conversation.channel,
        cliente_nombre: event.contact.displayName,
        cliente_telefono: event.contact.identity,
        mensaje_entrante:
          combinedText || `[Comprobante mediaId=${mediaMsg.mediaId}]`,
        tipo_decision: "COMPROBANTE_PAGO",
        resuelto_por_bot: false,
        escalado_a_humano: true,
        motivo_decision: motivo,
        respuesta_bot: reply,
        pedido_id: ultimoPedido?.id ?? null,
        pedido_numero: ultimoPedido?.numero ?? null,
        alerta_id: alerta.id,
        duracion_ms: Date.now() - startTime,
        fecha: new Date().toISOString(),
      };
    }

    // =========================================================================
    // CASO 2: El cliente pide hablar con un humano o presenta queja/hostilidad/reembolso
    // =========================================================================
    const asksForHuman =
      /\b(humano|persona|asesor|agente|operador|encargado|hablar con alguien)\b/.test(
        normalizedText,
      );
    const isHostileOrRefund =
      /\b(reembolso|devolucion|devuelvan|estafa|denuncia|libro de reclamaciones|pesimo|basura|queja|reclamo)\b/.test(
        normalizedText,
      );

    if (asksForHuman || isHostileOrRefund) {
      const handoffReason = isHostileOrRefund ? "hostilidad" : "cliente";
      const motivo = isHostileOrRefund
        ? "El cliente solicita reembolso o presenta reclamo crítico que requiere decisión del Coordinador/Administrador."
        : "El cliente solicitó expresamente ser atendido por una persona de soporte.";

      const alerta = await this.createBotEscalationAlert({
        tenantId,
        tipo: isHostileOrRefund
          ? "BOT_RECLAMO_O_REEMBOLSO"
          : "BOT_SOLICITUD_HUMANO",
        severidad: isHostileOrRefund ? "CRITICO" : "ADVERTENCIA",
        pedidoId: ultimoPedido?.id ?? null,
        conversationId: event.conversation.id,
        clienteNombre: event.contact.displayName,
        clienteTelefono: event.contact.identity,
        mensajeCliente: combinedText,
        motivoEscalado: motivo,
        sugerenciaAccion: isHostileOrRefund
          ? "Revisar el pedido del cliente, tomar control en Vocero CRM y evaluar incidencia o reembolso manual."
          : "Atender la conversación en Vocero CRM como Coordinador o Soporte.",
      });

      const reply = `Entiendo perfectamente, ${event.contact.displayName}. He derivado tu conversación con prioridad a nuestro Coordinador y Administrador para que te atiendan personalmente en unos instantes.`;

      await this.voceroClient.sendMessage(
        event.conversation.id,
        reply,
        integrationEnabled,
      );
      await this.voceroClient.requestHandoff(
        event.conversation.id,
        handoffReason,
        integrationEnabled,
      );

      return {
        dispatch_id: event.dispatchId,
        conversation_id: event.conversation.id,
        canal: event.conversation.channel,
        cliente_nombre: event.contact.displayName,
        cliente_telefono: event.contact.identity,
        mensaje_entrante: combinedText,
        tipo_decision: "ESCALADO_HUMANO",
        resuelto_por_bot: false,
        escalado_a_humano: true,
        motivo_decision: motivo,
        respuesta_bot: reply,
        pedido_id: ultimoPedido?.id ?? null,
        pedido_numero: ultimoPedido?.numero ?? null,
        alerta_id: alerta.id,
        duracion_ms: Date.now() - startTime,
        fecha: new Date().toISOString(),
      };
    }

    // =========================================================================
    // CASO 3: Solicitud de cancelación de pedido activo
    // =========================================================================
    if (
      /\b(cancelar|cancela|anular|anula|ya no quiero)\b/.test(normalizedText)
    ) {
      if (!ultimoPedido) {
        const reply = `No encontré un pedido activo asociado a tu número (${event.contact.identity}). Si necesitas ayuda adicional, escribe "asesor" o visita nuestra carta en ${appPublicUrl}/m`;
        await this.voceroClient.sendMessage(
          event.conversation.id,
          reply,
          integrationEnabled,
        );
        return {
          dispatch_id: event.dispatchId,
          conversation_id: event.conversation.id,
          canal: event.conversation.channel,
          cliente_nombre: event.contact.displayName,
          cliente_telefono: event.contact.identity,
          mensaje_entrante: combinedText,
          tipo_decision: "CONSULTA_ESTADO",
          resuelto_por_bot: true,
          escalado_a_humano: false,
          motivo_decision:
            "Solicitud de cancelación sin pedido activo encontrado",
          respuesta_bot: reply,
          duracion_ms: Date.now() - startTime,
          fecha: new Date().toISOString(),
        };
      }

      const botActor = await this.getBotActor(tenantId);

      if (ultimoPedido.estado_codigo === "NUEVO") {
        await this.ordersService.transitionOrder(
          botActor,
          ultimoPedido.id,
          "CANCELADO",
          `Cancelado por solicitud del cliente vía Bot WhatsApp: "${combinedText.slice(0, 120)}"`,
        );

        const reply = ` Tu pedido ${ultimoPedido.numero} aún no había entrado a cocina y ha sido cancelado exitosamente según tu indicación. Cuando gustes hacer un nuevo pedido, estamos a tu disposición.`;
        await this.voceroClient.sendMessage(
          event.conversation.id,
          reply,
          integrationEnabled,
        );
        await this.voceroClient.updateFicha(
          event.conversation.id,
          {
            nombreCliente: event.contact.displayName,
            ultimoPedidoNumero: ultimoPedido.numero,
            ultimoPedidoEstado: "Cancelado",
            ultimoPedidoTotal: ultimoPedido.total_soles,
          },
          integrationEnabled,
        );

        return {
          dispatch_id: event.dispatchId,
          conversation_id: event.conversation.id,
          canal: event.conversation.channel,
          cliente_nombre: event.contact.displayName,
          cliente_telefono: event.contact.identity,
          mensaje_entrante: combinedText,
          tipo_decision: "ESTADO_ACTUALIZADO",
          resuelto_por_bot: true,
          escalado_a_humano: false,
          motivo_decision: `Pedido ${ultimoPedido.numero} en estado NUEVO cancelado automáticamente por petición del cliente`,
          respuesta_bot: reply,
          pedido_id: ultimoPedido.id,
          pedido_numero: ultimoPedido.numero,
          duracion_ms: Date.now() - startTime,
          fecha: new Date().toISOString(),
        };
      } else {
        if (
          ["CONFIRMADO", "EN_PREPARACION", "LISTO"].includes(
            ultimoPedido.estado_codigo,
          )
        ) {
          await this.ordersService
            .transitionOrder(
              botActor,
              ultimoPedido.id,
              "CANCELACION_SOLICITADA",
              `Cliente solicitó cancelación por WhatsApp: "${combinedText.slice(0, 120)}"`,
            )
            .catch(() => null);
        }

        const motivo = `El cliente solicita cancelar el pedido ${ultimoPedido.numero} que ya se encuentra en estado "${ultimoPedido.estado_etiqueta}". El Bot no puede autorizar pérdidas operativas y requiere decisión del Coordinador o Admin.`;
        const alerta = await this.createBotEscalationAlert({
          tenantId,
          tipo: "BOT_SOLICITUD_CANCELACION",
          severidad: "CRITICO",
          pedidoId: ultimoPedido.id,
          conversationId: event.conversation.id,
          clienteNombre: event.contact.displayName,
          clienteTelefono: event.contact.identity,
          mensajeCliente: combinedText,
          motivoEscalado: motivo,
          sugerenciaAccion:
            "Coordinar con la sucursal si el plato ya fue preparado y aprobar o rechazar la cancelación en el panel de Pedidos.",
        });

        const reply = ` Tu pedido ${ultimoPedido.numero} ya está en estado "${ultimoPedido.estado_etiqueta}". He marcado tu solicitud de cancelación y notificado al Coordinador y Administrador para que la revisen de inmediato contigo.`;
        await this.voceroClient.sendMessage(
          event.conversation.id,
          reply,
          integrationEnabled,
        );
        await this.voceroClient.requestHandoff(
          event.conversation.id,
          "modelo",
          integrationEnabled,
        );

        return {
          dispatch_id: event.dispatchId,
          conversation_id: event.conversation.id,
          canal: event.conversation.channel,
          cliente_nombre: event.contact.displayName,
          cliente_telefono: event.contact.identity,
          mensaje_entrante: combinedText,
          tipo_decision: "ESCALADO_HUMANO",
          resuelto_por_bot: false,
          escalado_a_humano: true,
          motivo_decision: motivo,
          respuesta_bot: reply,
          pedido_id: ultimoPedido.id,
          pedido_numero: ultimoPedido.numero,
          alerta_id: alerta.id,
          duracion_ms: Date.now() - startTime,
          fecha: new Date().toISOString(),
        };
      }
    }

    // =========================================================================
    // CASO 4: Consulta de estado de pedido
    // =========================================================================
    const isStatusQuery =
      /\b(estado|mi pedido|donde esta|cuanto falta|repartidor|seguimiento|demora|llego|en camino)\b/.test(
        normalizedText,
      ) || /#\d+/.test(normalizedText);

    if (
      isStatusQuery &&
      !/\b(quiero|pedir|ordenar|comprar|mandame|enviame)\b/.test(normalizedText)
    ) {
      if (!ultimoPedido) {
        const reply = `Hola ${event.contact.displayName}. Revisé el sistema y aún no tienes pedidos registrados con este número. Puedes ver nuestras sucursales y platos disponibles aquí: ${appPublicUrl}/m o escribirme qué plato deseas pedir.`;
        await this.voceroClient.sendMessage(
          event.conversation.id,
          reply,
          integrationEnabled,
        );
        return {
          dispatch_id: event.dispatchId,
          conversation_id: event.conversation.id,
          canal: event.conversation.channel,
          cliente_nombre: event.contact.displayName,
          cliente_telefono: event.contact.identity,
          mensaje_entrante: combinedText,
          tipo_decision: "CONSULTA_ESTADO",
          resuelto_por_bot: true,
          escalado_a_humano: false,
          motivo_decision:
            "Consulta de estado respondida: cliente sin pedidos previos",
          respuesta_bot: reply,
          duracion_ms: Date.now() - startTime,
          fecha: new Date().toISOString(),
        };
      }

      const riderText = ultimoPedido.repartidor
        ? ` Repartidor asignado: *${ultimoPedido.repartidor.nombre}* (${ultimoPedido.repartidor.vehiculo}).`
        : `⏳ Repartidor: en proceso de asignación.`;

      const pagoText =
        ultimoPedido.metodo_pago === "EFECTIVO"
          ? ` Pago contra entrega en Efectivo (${ultimoPedido.total_soles}).`
          : ` Pago por ${ultimoPedido.metodo_pago} (${ultimoPedido.estado_pago === "PAGADO" ? "VALIDADO — No cobrar al entregar" : "Pendiente de validación"}).`;

      const reply = [
        ` *Estado en vivo de tu pedido ${ultimoPedido.numero}*`,
        ` Sucursal: *${ultimoPedido.sucursal}*`,
        ` Estado actual: *${ultimoPedido.estado_etiqueta}*`,
        riderText,
        pagoText,
        ` Seguimiento en tiempo real: ${ultimoPedido.url_seguimiento}`,
      ].join("\n");

      await this.voceroClient.sendMessage(
        event.conversation.id,
        reply,
        integrationEnabled,
      );
      await this.voceroClient.updateFicha(
        event.conversation.id,
        {
          zeroDeliveryCustomerId: context.cliente?.id,
          nombreCliente: event.contact.displayName,
          segmentoZeroDelivery: context.cliente?.segmento ?? "NUEVO",
          ultimoPedidoNumero: ultimoPedido.numero,
          ultimoPedidoEstado: ultimoPedido.estado_etiqueta,
          ultimoPedidoTotal: ultimoPedido.total_soles,
          repartidorAsignado: ultimoPedido.repartidor?.nombre ?? null,
        },
        integrationEnabled,
      );

      return {
        dispatch_id: event.dispatchId,
        conversation_id: event.conversation.id,
        canal: event.conversation.channel,
        cliente_nombre: event.contact.displayName,
        cliente_telefono: event.contact.identity,
        mensaje_entrante: combinedText,
        tipo_decision: "CONSULTA_ESTADO",
        resuelto_por_bot: true,
        escalado_a_humano: false,
        motivo_decision: `Estado del pedido ${ultimoPedido.numero} (${ultimoPedido.estado_codigo}) consultado y respondido en tiempo real`,
        respuesta_bot: reply,
        pedido_id: ultimoPedido.id,
        pedido_numero: ultimoPedido.numero,
        repartidor_nombre: ultimoPedido.repartidor?.nombre ?? null,
        duracion_ms: Date.now() - startTime,
        fecha: new Date().toISOString(),
      };
    }

    // =========================================================================
    // CASO 5: Detectar intención de tomar pedido (coincidencia con platos del catálogo)
    // =========================================================================
    const matchedOrder = this.matchOrderFromText(
      normalizedText,
      combinedText,
      context.sucursales,
      locationMsg,
    );

    if (matchedOrder.hasOrderIntent) {
      if (matchedOrder.outOfStockItems.length > 0) {
        const motivo = `El cliente intentó pedir un plato agotado (${matchedOrder.outOfStockItems.join(", ")}). Se requiere atención de Coordinador/Soporte para ofrecer reemplazo.`;
        const alerta = await this.createBotEscalationAlert({
          tenantId,
          tipo: "BOT_PRODUCTO_AGOTADO",
          severidad: "ADVERTENCIA",
          pedidoId: null,
          conversationId: event.conversation.id,
          clienteNombre: event.contact.displayName,
          clienteTelefono: event.contact.identity,
          mensajeCliente: combinedText,
          motivoEscalado: motivo,
          sugerenciaAccion:
            "Ofrecer un plato alternativo disponible de la sucursal o activar stock si ya hay disponibilidad.",
        });

        const reply = ` Lo sentimos ${event.contact.displayName}, el plato *${matchedOrder.outOfStockItems.join(", ")}* se encuentra temporalmente agotado en cocina. He notificado a nuestro Coordinador para ayudarte a elegir un reemplazo de inmediato.`;
        await this.voceroClient.sendMessage(
          event.conversation.id,
          reply,
          integrationEnabled,
        );
        await this.voceroClient.requestHandoff(
          event.conversation.id,
          "modelo",
          integrationEnabled,
        );

        return {
          dispatch_id: event.dispatchId,
          conversation_id: event.conversation.id,
          canal: event.conversation.channel,
          cliente_nombre: event.contact.displayName,
          cliente_telefono: event.contact.identity,
          mensaje_entrante: combinedText,
          tipo_decision: "ESCALADO_HUMANO",
          resuelto_por_bot: false,
          escalado_a_humano: true,
          motivo_decision: motivo,
          respuesta_bot: reply,
          alerta_id: alerta.id,
          duracion_ms: Date.now() - startTime,
          fecha: new Date().toISOString(),
        };
      }

      if (matchedOrder.items.length === 0 || !matchedOrder.branch) {
        const platosEjemplo = context.sucursales
          .flatMap((s) =>
            s.platos
              .filter((p: any) => p.disponible)
              .slice(0, 2)
              .map(
                (p: any) => `• ${p.nombre} (${p.precio_soles}) — ${s.nombre}`,
              ),
          )
          .slice(0, 5)
          .join("\n");

        const motivo = `El cliente expresó intención de compra ("${combinedText.slice(0, 100)}"), pero el Bot no pudo identificar con certeza los platos o cantidades del catálogo.`;
        const alerta = await this.createBotEscalationAlert({
          tenantId,
          tipo: "BOT_INDECISION_PEDIDO",
          severidad: "ADVERTENCIA",
          pedidoId: null,
          conversationId: event.conversation.id,
          clienteNombre: event.contact.displayName,
          clienteTelefono: event.contact.identity,
          mensajeCliente: combinedText,
          motivoEscalado: motivo,
          sugerenciaAccion:
            "Revisar el mensaje del cliente y registrar el pedido manualmente o guiarlo con los platos disponibles.",
        });

        const reply = [
          `Hola ${event.contact.displayName}. Quiero tomar tu pedido, pero necesito confirmar exactamente qué plato deseas de nuestra carta:`,
          platosEjemplo,
          `\nHe avisado a nuestro Coordinador por si prefieres atención directa, o puedes escribirme por ejemplo:\n*"Quiero 1 ${context.sucursales[0]?.platos[0]?.nombre ?? "Pollo a la Brasa"} en efectivo a Av. Larco 450"*`,
        ].join("\n");

        await this.voceroClient.sendMessage(
          event.conversation.id,
          reply,
          integrationEnabled,
        );

        return {
          dispatch_id: event.dispatchId,
          conversation_id: event.conversation.id,
          canal: event.conversation.channel,
          cliente_nombre: event.contact.displayName,
          cliente_telefono: event.contact.identity,
          mensaje_entrante: combinedText,
          tipo_decision: "ESCALADO_HUMANO",
          resuelto_por_bot: false,
          escalado_a_humano: true,
          motivo_decision: motivo,
          respuesta_bot: reply,
          alerta_id: alerta.id,
          duracion_ms: Date.now() - startTime,
          fecha: new Date().toISOString(),
        };
      }

      const result = await this.executeBotOrderCreation({
        tenantId,
        conversationId: event.conversation.id,
        canal: event.conversation.channel,
        clienteNombre: event.contact.displayName,
        clienteTelefono: event.contact.identity,
        sucursalId: matchedOrder.branch.id,
        sucursalNombre: matchedOrder.branch.nombre,
        items: matchedOrder.items,
        metodoPago: matchedOrder.metodoPago,
        direccionLinea1: matchedOrder.direccion,
        latitud: matchedOrder.latitud,
        longitud: matchedOrder.longitud,
        notas: `Pedido tomado por Bot Vocero CRM: "${combinedText.slice(0, 160)}"`,
        integrationEnabled,
      });

      return {
        dispatch_id: event.dispatchId,
        conversation_id: event.conversation.id,
        canal: event.conversation.channel,
        cliente_nombre: event.contact.displayName,
        cliente_telefono: event.contact.identity,
        mensaje_entrante: combinedText,
        tipo_decision: result.riderAssigned
          ? "REPARTIDOR_ASIGNADO"
          : "PEDIDO_CREADO",
        resuelto_por_bot: !result.escalated,
        escalado_a_humano: result.escalated,
        motivo_decision: result.decisionSummary,
        respuesta_bot: result.replyText,
        pedido_id: result.order.id,
        pedido_numero: `#${result.order.numero}`,
        repartidor_id: result.riderAssigned?.id ?? null,
        repartidor_nombre: result.riderAssigned?.nombre ?? null,
        alerta_id: result.alertId ?? null,
        duracion_ms: Date.now() - startTime,
        fecha: new Date().toISOString(),
      };
    }

    // =========================================================================
    // CASO 6: Consulta de catálogo / carta / horarios / saludo inicial
    // =========================================================================
    const isCatalogOrGreeting =
      /\b(hola|buenos dias|buenas tardes|buenas noches|menu|carta|platos|precios|sucursales|locales|horario|abierto|catalogo|que tienen|que venden)\b/.test(
        normalizedText,
      );

    if (isCatalogOrGreeting) {
      const resumenSucursales = context.sucursales
        .map((s) => {
          const platosDisp = s.platos
            .filter((p: any) => p.disponible)
            .slice(0, 4)
            .map((p: any) => ` • ${p.nombre}: *${p.precio_soles}*`)
            .join("\n");
          return ` *${s.nombre}* (${s.direccion})\n${platosDisp || " • Carta en actualización"}\n Carta digital: ${s.url_carta_digital}`;
        })
        .join("\n\n");

      const primerPlato =
        context.sucursales[0]?.platos?.find((p: any) => p.disponible)?.nombre ??
        "Pollo a la Brasa";

      const reply = [
        `¡Hola ${event.contact.displayName}! Bienvenido a *Zero Delivery*.`,
        `Estas son nuestras sucursales independientes y platos disponibles en tiempo real:\n`,
        resumenSucursales,
        `\n *¿Cómo pedir por aquí?* Escríbeme el plato, cantidad, método de pago y tu dirección. Ejemplo:\n*"Quiero 2 ${primerPlato} en efectivo a Av. Arequipa 1250"*`,
        ` O pide directo desde nuestro directorio web: ${context.directorio_general_url}`,
      ].join("\n");

      await this.voceroClient.sendMessage(
        event.conversation.id,
        reply,
        integrationEnabled,
      );

      return {
        dispatch_id: event.dispatchId,
        conversation_id: event.conversation.id,
        canal: event.conversation.channel,
        cliente_nombre: event.contact.displayName,
        cliente_telefono: event.contact.identity,
        mensaje_entrante: combinedText,
        tipo_decision: "CONSULTA_CATALOGO",
        resuelto_por_bot: true,
        escalado_a_humano: false,
        motivo_decision: `Catálogo en vivo (${context.sucursales.length} sucursales) enviado automáticamente al cliente`,
        respuesta_bot: reply,
        duracion_ms: Date.now() - startTime,
        fecha: new Date().toISOString(),
      };
    }

    // =========================================================================
    // CASO 7: Mensaje ambiguo que el Bot no puede decidir con seguridad -> Notificar a Coordinador y Admin
    // =========================================================================
    const motivoIndecision = `El Bot no pudo clasificar con certeza la solicitud del cliente ("${combinedText.slice(0, 120)}"). Se notifica al Coordinador y Administrador para decisión humana.`;
    const alerta = await this.createBotEscalationAlert({
      tenantId,
      tipo: "BOT_INDECISION",
      severidad: "ADVERTENCIA",
      pedidoId: ultimoPedido?.id ?? null,
      conversationId: event.conversation.id,
      clienteNombre: event.contact.displayName,
      clienteTelefono: event.contact.identity,
      mensajeCliente: combinedText,
      motivoEscalado: motivoIndecision,
      sugerenciaAccion:
        "Revisar la consulta del cliente y responder desde Vocero CRM o registrar su pedido.",
    });

    const fallbackReply = [
      `Hola ${event.contact.displayName}, recibí tu mensaje pero para darte una respuesta exacta he notificado a nuestro Coordinador de Pedidos, quien te atenderá en breve.`,
      ` Mientras tanto, recuerda que puedes ver nuestra carta en ${context.directorio_general_url} o consultar tu pedido escribiendo *"estado de mi pedido"*.`,
    ].join("\n");

    await this.voceroClient.sendMessage(
      event.conversation.id,
      fallbackReply,
      integrationEnabled,
    );
    await this.voceroClient.requestHandoff(
      event.conversation.id,
      "modelo",
      integrationEnabled,
    );

    return {
      dispatch_id: event.dispatchId,
      conversation_id: event.conversation.id,
      canal: event.conversation.channel,
      cliente_nombre: event.contact.displayName,
      cliente_telefono: event.contact.identity,
      mensaje_entrante: combinedText,
      tipo_decision: "ESCALADO_HUMANO",
      resuelto_por_bot: false,
      escalado_a_humano: true,
      motivo_decision: motivoIndecision,
      respuesta_bot: fallbackReply,
      pedido_id: ultimoPedido?.id ?? null,
      pedido_numero: ultimoPedido?.numero ?? null,
      alerta_id: alerta.id,
      duracion_ms: Date.now() - startTime,
      fecha: new Date().toISOString(),
    };
  }

  /**
   * Crea un pedido desde el Bot, evalúa las recomendaciones de repartidores y asigna al mejor elegible.
   */
  async executeBotOrderCreation(input: {
    tenantId: string;
    conversationId?: string;
    canal?: string;
    clienteNombre: string;
    clienteTelefono: string;
    sucursalId: string;
    sucursalNombre?: string;
    items: Array<{ producto_id: string; cantidad: number; nombre?: string }>;
    metodoPago: MetodoPagoDb;
    direccionLinea1: string;
    latitud?: number | null;
    longitud?: number | null;
    notas?: string;
    integrationEnabled?: boolean;
  }) {
    const integrationEnabled =
      input.integrationEnabled ??
      (await this.isIntegrationEnabled(input.tenantId));
    const autoAssignRider = await this.getBooleanSetting(
      input.tenantId,
      "bot.auto_asignar_repartidor",
      true,
    );
    const autoConfirmCash = await this.getBooleanSetting(
      input.tenantId,
      "bot.auto_confirmar_efectivo",
      true,
    );

    const botActor = await this.getBotActor(input.tenantId);
    const normalizedPhone = this.normalizePhone(input.clienteTelefono);

    // Buscar si el cliente ya existe por teléfono en el inquilino
    const clienteRepo = this.dataSource.getRepository(ClienteEntity);
    const existingCustomer = await clienteRepo.findOne({
      where: {
        inquilino_id: input.tenantId,
        telefono_e164: normalizedPhone,
      },
    });

    // 1. Crear el pedido mediante OrdersService.createManualOrder
    const order = await this.ordersService.createManualOrder(botActor, {
      sucursal_id: input.sucursalId,
      ...(existingCustomer
        ? { cliente_id: existingCustomer.id }
        : {
            cliente_nuevo: {
              nombre: input.clienteNombre || "Cliente WhatsApp",
              telefono_e164: normalizedPhone,
            },
          }),
      canal: "WHATSAPP",
      metodo_pago: input.metodoPago,
      efectivo_por_cobrar_centavos: 0,
      direccion_snapshot: {
        texto_direccion:
          input.direccionLinea1 || "Dirección indicada por WhatsApp",
        referencia: `Canal: ${input.canal ?? "whatsapp"}${input.conversationId ? ` | Conv: ${input.conversationId}` : ""}`,
        latitud: input.latitud ?? -12.1191,
        longitud: input.longitud ?? -77.0349,
        ...(input.conversationId
          ? ({ vocero_conversation_id: input.conversationId } as Record<
              string,
              unknown
            >)
          : {}),
      },
      items: input.items.map((it) => ({
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        modificadores: [],
      })),
      factura_solicitada: false,
      notas: input.notas ?? "Pedido tomado automáticamente por Bot Vocero CRM",
    });

    let riderAssigned: {
      id: string;
      nombre: string;
      vehiculo: string;
      puntaje: number;
      estrellas: number | null;
      distancia_km: number | null;
      saldo_soles: string;
    } | null = null;
    let escalated = false;
    let alertId: string | null = null;
    const summaryParts: string[] = [
      `Pedido #${order.numero} creado en ${input.sucursalNombre ?? "sucursal"} por ${formatPen(BigInt(order.total_centavos))} (${input.metodoPago})`,
    ];

    // 2. Si es EFECTIVO y autoConfirmCash está activo, pasar a CONFIRMADO
    if (input.metodoPago === "EFECTIVO" && autoConfirmCash) {
      await this.ordersService
        .transitionOrder(
          botActor,
          order.id,
          "CONFIRMADO",
          "Confirmado automáticamente por Bot Vocero CRM (pago contra entrega en efectivo)",
        )
        .catch(() => null);
      summaryParts.push("Estado cambiado a CONFIRMADO");
    }

    // 3. Si es YAPE o TRANSFERENCIA_BANCARIA -> el humano SIEMPRE valida el dinero
    if (input.metodoPago !== "EFECTIVO") {
      escalated = true;
      const motivoPago = `El Bot creó el pedido #${order.numero} (${formatPen(BigInt(order.total_centavos))}) con método ${input.metodoPago}. Por regla financiera, el Coordinador o Admin debe validar el comprobante de pago y confirmar el despacho.`;
      const alerta = await this.createBotEscalationAlert({
        tenantId: input.tenantId,
        tipo: "BOT_VALIDACION_PAGO_PEDIDO",
        severidad: "ADVERTENCIA",
        pedidoId: order.id,
        sucursalId: input.sucursalId,
        conversationId: input.conversationId ?? null,
        clienteNombre: input.clienteNombre,
        clienteTelefono: normalizedPhone,
        mensajeCliente: input.notas ?? "",
        motivoEscalado: motivoPago,
        sugerenciaAccion:
          "Solicitar/verificar el comprobante de pago del cliente, validarlo en el módulo de Pagos y asignar repartidor.",
      });
      alertId = alerta.id;
      summaryParts.push(
        "Escalado a Coordinador/Admin para validación humana de pago digital",
      );
    }

    // 4. Si autoAssignRider está activo (y el pedido es EFECTIVO), consultar el Motor de Recomendaciones y asignar al mejor repartidor elegible
    if (autoAssignRider && input.metodoPago === "EFECTIVO") {
      try {
        const recResult =
          await this.logisticsService.getAssignmentRecommendations(
            botActor,
            order.id,
          );
        const bestRider =
          recResult.repartidores.find((r) => r.recomendado && r.elegible) ??
          recResult.repartidores.find((r) => r.elegible);

        if (bestRider) {
          await this.logisticsService.assignRiderToOrder(
            botActor,
            order.id,
            bestRider.id,
          );
          const saldoSoles = formatPen(BigInt(bestRider.saldo_centavos ?? "0"));
          riderAssigned = {
            id: bestRider.id,
            nombre: bestRider.nombre_completo,
            vehiculo: bestRider.tipo_vehiculo,
            puntaje: bestRider.score,
            estrellas: bestRider.estrellas,
            distancia_km: bestRider.distancia_sucursal_km,
            saldo_soles: saldoSoles,
          };
          summaryParts.push(
            `Repartidor asignado por IA: ${bestRider.nombre_completo} (Puntaje ${bestRider.score}/100, ${bestRider.estrellas ?? "5.0"}, Garantía ${saldoSoles})`,
          );
        } else {
          escalated = true;
          const motivoSinRider = `El Bot tomó el pedido #${order.numero} en Efectivo (${formatPen(BigInt(order.total_centavos))}), pero ningún repartidor cumplió los requisitos de elegibilidad/garantía automáticamente.`;
          const alerta = await this.createBotEscalationAlert({
            tenantId: input.tenantId,
            tipo: "BOT_SIN_REPARTIDOR_ELEGIBLE",
            severidad: "CRITICO",
            pedidoId: order.id,
            sucursalId: input.sucursalId,
            conversationId: input.conversationId ?? null,
            clienteNombre: input.clienteNombre,
            clienteTelefono: normalizedPhone,
            mensajeCliente: input.notas ?? "",
            motivoEscalado: motivoSinRider,
            sugerenciaAccion:
              "Ir al Tablero de Coordinación, verificar garantías de billetera o liberar un repartidor y asignarlo manualmente.",
          });
          alertId = alerta.id;
          summaryParts.push(
            "Alerta enviada a Coordinador/Admin: sin repartidor elegible con garantía disponible",
          );
        }
      } catch (err) {
        this.logger.warn(
          `No se pudo auto-asignar repartidor al pedido #${order.numero}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    const appPublicUrl = (
      process.env["APP_PUBLIC_URL"] || "http://localhost:3001"
    ).replace(/\/+$/, "");
    const trackingUrl = `${appPublicUrl}/p/${order.token_publico}`;

    const itemsResumen = (order.items ?? [])
      .map(
        (d: {
          cantidad: number;
          nombre_snapshot: string;
          total_linea_centavos: string;
        }) =>
          `• ${d.cantidad}x ${d.nombre_snapshot} (${formatPen(BigInt(d.total_linea_centavos))})`,
      )
      .join("\n");

    const replyLines = [
      ` *¡Pedido #${order.numero} registrado con éxito!*`,
      ` Sucursal: *${input.sucursalNombre ?? order.sucursal?.nombre ?? "Principal"}*`,
      itemsResumen,
      ` Total: *${formatPen(BigInt(order.total_centavos))}* (${input.metodoPago})`,
      ` Dirección: ${input.direccionLinea1}`,
    ];

    if (riderAssigned) {
      replyLines.push(
        ` Repartidor asignado: *${riderAssigned.nombre}* (${riderAssigned.vehiculo}, ${riderAssigned.estrellas ?? "5.0"})`,
      );
    } else if (input.metodoPago !== "EFECTIVO") {
      replyLines.push(
        ` *Importante:* Envíanos por aquí la captura de tu pago (${input.metodoPago}) para que nuestro Coordinador lo valide y despache tu pedido.`,
      );
    } else {
      replyLines.push(
        `⏳ Nuestro Coordinador está asignando al repartidor más cercano a tu sucursal.`,
      );
    }

    replyLines.push(` Sigue tu pedido en vivo aquí: ${trackingUrl}`);

    const replyText = replyLines.join("\n");

    if (input.conversationId) {
      await this.voceroClient.sendMessage(
        input.conversationId,
        replyText,
        integrationEnabled,
      );
      await this.voceroClient.updateFicha(
        input.conversationId,
        {
          zeroDeliveryCustomerId: order.cliente_id,
          nombreCliente: input.clienteNombre,
          ultimoPedidoNumero: `#${order.numero}`,
          ultimoPedidoEstado: riderAssigned
            ? "Repartidor asignado"
            : input.metodoPago === "EFECTIVO"
              ? "Confirmado"
              : "Pendiente de validación de pago",
          ultimoPedidoTotal: formatPen(BigInt(order.total_centavos)),
          sucursalPreferida: input.sucursalNombre ?? order.sucursal?.nombre,
          repartidorAsignado: riderAssigned?.nombre ?? null,
        },
        integrationEnabled,
      );
    }

    const updatedOrder =
      (await this.ordersService.getOrderById(botActor, order.id)) ?? order;

    return {
      order: updatedOrder,
      riderAssigned,
      escalated,
      alertId,
      replyText,
      trackingUrl,
      decisionSummary: summaryParts.join(" · "),
    };
  }

  /**
   * Permite al Bot (o al Coordinador desde el panel del Bot) disparar la asignación automática
   * del mejor repartidor recomendado para cualquier pedido existente.
   */
  async botAssignRecommendedRider(actor: ActorContext, orderId: string) {
    const recResult = await this.logisticsService.getAssignmentRecommendations(
      actor,
      orderId,
    );
    const bestRider =
      recResult.repartidores.find((r) => r.recomendado && r.elegible) ??
      recResult.repartidores.find((r) => r.elegible);

    if (!bestRider) {
      const alerta = await this.createBotEscalationAlert({
        tenantId: actor.tenantId,
        tipo: "BOT_SIN_REPARTIDOR_ELEGIBLE",
        severidad: "CRITICO",
        pedidoId: orderId,
        conversationId: null,
        clienteNombre: recResult.pedido.cliente_nombre,
        clienteTelefono: "",
        mensajeCliente: "Intento de asignación automática por Bot",
        motivoEscalado: `Ningún repartidor es elegible para el pedido #${recResult.pedido.numero}. Verifique disponibilidad y garantía en efectivo.`,
        sugerenciaAccion:
          "Asignar manualmente o recargar garantía de billetera.",
      });
      return {
        assigned: false,
        escalated: true,
        alertId: alerta.id,
        reason: "No se encontró ningún repartidor elegible en este momento",
        recomendaciones: recResult.repartidores,
      };
    }

    const updatedOrder = await this.logisticsService.assignRiderToOrder(
      actor,
      orderId,
      bestRider.id,
    );

    const saldoSoles = formatPen(BigInt(bestRider.saldo_centavos ?? "0"));

    const auditRepo = this.dataSource.getRepository(RegistroAuditoriaEntity);
    await auditRepo.save(
      auditRepo.create({
        inquilino_id: actor.tenantId,
        actor_id: actor.userId,
        rol_actor: actor.role ?? "BOT_VOCERO",
        accion: "BOT_REPARTIDOR_ASIGNADO",
        tipo_objeto: "BOT_VOCERO",
        objeto_id: orderId,
        despues: {
          pedido_id: orderId,
          pedido_numero: `#${recResult.pedido.numero}`,
          repartidor_id: bestRider.id,
          repartidor_nombre: bestRider.nombre_completo,
          puntaje: bestRider.score,
          estrellas: bestRider.estrellas,
          distancia_km: bestRider.distancia_sucursal_km,
          saldo_soles: saldoSoles,
        },
      }),
    );

    return {
      assigned: true,
      escalated: false,
      order: updatedOrder,
      rider: bestRider,
    };
  }

  /**
   * Crea una alerta de escalado / indecisión del Bot en la tabla `alertas`
   * para notificar en tiempo real a Coordinador y Administrador.
   */
  async createBotEscalationAlert(params: {
    tenantId: string;
    tipo: string;
    severidad: "INFO" | "ADVERTENCIA" | "CRITICO";
    pedidoId?: string | null;
    repartidorId?: string | null;
    sucursalId?: string | null;
    conversationId?: string | null;
    clienteNombre: string;
    clienteTelefono: string;
    mensajeCliente: string;
    motivoEscalado: string;
    sugerenciaAccion: string;
  }): Promise<AlertaEntity> {
    const alertaRepo = this.dataSource.getRepository(AlertaEntity);
    const dedupKey = `bot_${params.tipo}_${params.conversationId || params.pedidoId || Date.now()}_${Math.floor(Date.now() / 15000)}`;

    const existing = await alertaRepo.findOne({
      where: {
        inquilino_id: params.tenantId,
        clave_deduplicacion: dedupKey,
      },
    });
    if (existing) return existing;

    const alerta = alertaRepo.create({
      inquilino_id: params.tenantId,
      tipo: params.tipo,
      severidad: params.severidad,
      pedido_id: params.pedidoId ?? null,
      repartidor_id: params.repartidorId ?? null,
      sucursal_id: params.sucursalId ?? null,
      clave_deduplicacion: dedupKey,
      estado: "ABIERTA",
      datos: {
        origen: "BOT_VOCERO_CRM",
        conversation_id: params.conversationId ?? null,
        cliente_nombre: params.clienteNombre,
        cliente_telefono: params.clienteTelefono,
        mensaje_cliente: params.mensajeCliente,
        motivo_escalado: params.motivoEscalado,
        sugerencia_accion: params.sugerenciaAccion,
        creado_iso: new Date().toISOString(),
      },
    });

    return alertaRepo.save(alerta);
  }

  /**
   * Resuelve o reconoce una alerta de indecisión del Bot (Coordinador o Admin).
   */
  async resolveBotAlert(
    actor: ActorContext,
    alertId: string,
    notaResolucion?: string,
  ) {
    const alertaRepo = this.dataSource.getRepository(AlertaEntity);
    const alerta = await alertaRepo.findOne({
      where: { id: alertId, inquilino_id: actor.tenantId },
    });
    if (!alerta) {
      throw new NotFoundException("Alerta no encontrada");
    }

    alerta.estado = "RESUELTA";
    alerta.reconocido_por = actor.userId;
    alerta.resuelto_en = new Date();
    alerta.datos = {
      ...(alerta.datos ?? {}),
      nota_resolucion: notaResolucion ?? "Atendido por Coordinador/Admin",
      resuelto_por_rol: actor.role,
      resuelto_iso: new Date().toISOString(),
    };

    return alertaRepo.save(alerta);
  }

  /**
   * Despacho operativo en producción hacia el motor de Webhook de Vocero CRM:
   * - Consulta primero en vivo `GET /api/bot/context` en Vocero CRM para vincular la conversación real si existe.
   * - Firma el cuerpo `EventoDespacho` con HMAC-SHA256 (`X-Vocero-Signature: sha256=<hex>`).
   * - Ejecuta el pipeline completo de producción (`handleWebhookDispatch` con verificación de firma real).
   */
  async simulateBotMessage(
    actor: ActorContext,
    input: {
      nombreCliente?: string;
      telefono?: string;
      conversationId?: string;
      mensaje: string;
      canal?: "whatsapp" | "instagram" | "messenger" | "tiktok";
    },
  ) {
    await this.syncRuntimeClientConfig(actor.tenantId);

    const enabled = await this.isIntegrationEnabled(actor.tenantId);
    if (!enabled) {
      throw new BadRequestException(
        "La conexión con el Bot de Vocero CRM está APAGADA. Enciéndela con el botón de conexión para procesar despachos.",
      );
    }

    const nowIso = new Date().toISOString();
    const phone = this.normalizePhone(input.telefono?.trim() || "+51987654321");

    // Consultar en vivo si el contacto/conversación ya existe en Vocero CRM
    const crmContext = await this.voceroClient.fetchConversationContext({
      conversationId: input.conversationId?.trim() || undefined,
      identity: phone,
    });

    const convId =
      input.conversationId?.trim() ||
      crmContext.conversation?.id ||
      `conv_${phone.replace(/\D/g, "")}`;
    const contactId =
      crmContext.contact?.id || `ct_${phone.replace(/\D/g, "")}`;
    const displayName =
      input.nombreCliente?.trim() ||
      crmContext.contact?.name ||
      "Cliente WhatsApp";
    const dispatchId = `dsp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const dispatchEvent: VoceroDispatchEvent = {
      dispatchId,
      organization: {
        id: actor.tenantId,
        slug: "zero-delivery",
      },
      conversation: {
        id: convId,
        channel:
          (crmContext.contact?.channel as any) ?? input.canal ?? "whatsapp",
        aiEnabled: crmContext.conversation?.aiEnabled ?? true,
        windowOpen: crmContext.conversation?.windowOpen ?? true,
        windowExpiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        test: false,
      },
      contact: {
        id: contactId,
        displayName,
        identity: phone,
      },
      messages: [
        {
          id: `msg_${Date.now()}`,
          at: nowIso,
          type: "text",
          text: input.mensaje,
          mediaId: null,
        },
      ],
      firstMessageAt: nowIso,
      lastMessageAt: nowIso,
    };

    const rawBody = JSON.stringify(dispatchEvent);
    const signatureHeader = this.voceroClient.signBody(rawBody);

    return this.handleWebhookDispatch({
      rawBody,
      signatureHeader,
      body: dispatchEvent,
      skipSignatureCheck: false,
    });
  }

  /**
   * Reintenta un evento de la cola de salida (`eventos_salida`) que haya quedado FALLIDO o MUERTO.
   */
  async retryOutboxEvent(actor: ActorContext, eventId: string) {
    await this.dataSource.query(
      `UPDATE eventos_salida
SET estado = 'PENDIENTE', proximo_intento_en = now(), ultimo_error = NULL
WHERE id = $1 AND inquilino_id = $2`,
      [eventId, actor.tenantId],
    );
    return { retried: true, eventId };
  }

  /**
   * Obtiene el panel consolidado de Hito 4 para Coordinador y Administrador.
   */
  async getBotDashboardOverview(actor: ActorContext) {
    await this.syncRuntimeClientConfig(actor.tenantId);
    await this.healFailedInboundEvents(actor.tenantId);

    const enabled = await this.isIntegrationEnabled(actor.tenantId);
    const autoAssignRider = await this.getBooleanSetting(
      actor.tenantId,
      "bot.auto_asignar_repartidor",
      true,
    );
    const autoConfirmCash = await this.getBooleanSetting(
      actor.tenantId,
      "bot.auto_confirmar_efectivo",
      true,
    );

    const voceroHealth = await this.voceroClient.checkVoceroHealth();

    // 1. Alertas del Bot (abiertas y recientes resueltas)
    const alertasRows: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT a.id, a.tipo, a.severidad, a.pedido_id, a.repartidor_id, a.sucursal_id,
a.datos, a.estado, a.creado_en, a.resuelto_en,
p.numero AS pedido_numero, p.estado_operativo AS pedido_estado, p.total_centavos AS pedido_total,
s.nombre AS sucursal_nombre
FROM alertas a
LEFT JOIN pedidos p ON p.id = a.pedido_id
LEFT JOIN sucursales s ON s.id = COALESCE(a.sucursal_id, p.sucursal_id)
WHERE a.inquilino_id = $1
AND (a.tipo LIKE 'BOT_%' OR a.tipo = 'INTEGRATION_DEAD_LETTER')
ORDER BY
CASE WHEN a.estado = 'ABIERTA' THEN 0 ELSE 1 END ASC,
a.creado_en DESC
LIMIT 40`,
      [actor.tenantId],
    );

    // 2. Historial de eventos entrantes y decisiones del Bot (`eventos_entrada`)
    const inboundRows: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT id, proveedor, id_evento_externo, datos, estado, intentos, error, recibido_en, procesado_en
FROM eventos_entrada
WHERE proveedor = 'vocero'
ORDER BY recibido_en DESC
LIMIT 50`,
    );

    const historialDecisiones = inboundRows.map((row) => {
      let decisionParsed: Partial<DecisionBotRegistro> = {};
      if (row.error) {
        try {
          decisionParsed = JSON.parse(row.error);
        } catch {
          decisionParsed = { motivo_decision: row.error };
        }
      }
      const ev = (row.datos ?? {}) as Record<string, any>;
      const contact = (ev.contact ?? {}) as Record<string, any>;
      const conv = (ev.conversation ?? {}) as Record<string, any>;
      const messages = Array.isArray(ev.messages) ? ev.messages : [];
      const rawText = messages
        .map((m: any) => m?.text || m?.caption || `[${m?.type ?? "msg"}]`)
        .join(" | ");

      return {
        id: row.id,
        dispatch_id: row.id_evento_externo,
        estado_evento: row.estado,
        recibido_en: row.recibido_en,
        procesado_en: row.procesado_en,
        canal: decisionParsed.canal ?? conv.channel ?? "whatsapp",
        conversation_id: decisionParsed.conversation_id ?? conv.id ?? "",
        cliente_nombre:
          decisionParsed.cliente_nombre ?? contact.displayName ?? "Cliente",
        cliente_telefono:
          decisionParsed.cliente_telefono ?? contact.identity ?? "",
        mensaje_entrante: decisionParsed.mensaje_entrante ?? rawText,
        tipo_decision:
          decisionParsed.tipo_decision ??
          (row.estado === "IGNORADO" ? "IGNORADO_TEST" : "CONSULTA_CATALOGO"),
        resuelto_por_bot:
          typeof decisionParsed.resuelto_por_bot === "boolean"
            ? decisionParsed.resuelto_por_bot
            : row.estado === "PROCESADO",
        escalado_a_humano: Boolean(decisionParsed.escalado_a_humano),
        motivo_decision:
          decisionParsed.motivo_decision ??
          (row.estado === "PROCESADO"
            ? "Procesado automáticamente por el Bot"
            : (row.error ?? "En cola")),
        respuesta_bot: decisionParsed.respuesta_bot ?? null,
        pedido_id: decisionParsed.pedido_id ?? null,
        pedido_numero: decisionParsed.pedido_numero ?? null,
        repartidor_id: decisionParsed.repartidor_id ?? null,
        repartidor_nombre: decisionParsed.repartidor_nombre ?? null,
        duracion_ms: decisionParsed.duracion_ms ?? 0,
      };
    });

    // 3. Cola de salida (`eventos_salida`)
    const outboxRows: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT id, tipo, datos, estado, intentos, ultimo_error, proximo_intento_en, creado_en, procesado_en
FROM eventos_salida
WHERE inquilino_id = $1
ORDER BY creado_en DESC
LIMIT 40`,
      [actor.tenantId],
    );

    const outboxSummaryRows: Array<Record<string, any>> =
      await this.dataSource.query(
        `SELECT
COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::int AS pendientes,
COUNT(*) FILTER (WHERE estado = 'ENVIADO')::int AS enviados,
COUNT(*) FILTER (WHERE estado = 'FALLIDO')::int AS fallidos,
COUNT(*) FILTER (WHERE estado = 'MUERTO')::int AS muertos
FROM eventos_salida
WHERE inquilino_id = $1`,
        [actor.tenantId],
      );

    // 4. Calcular estadísticas y KPIs del Bot
    const totalEventos = historialDecisiones.length;
    const decisionesAutomaticas = historialDecisiones.filter(
      (d) => d.resuelto_por_bot && !d.escalado_a_humano,
    ).length;
    const escaladosHumano = historialDecisiones.filter(
      (d) => d.escalado_a_humano,
    ).length;
    const pedidosCreadosBot = historialDecisiones.filter(
      (d) =>
        d.tipo_decision === "PEDIDO_CREADO" ||
        d.tipo_decision === "REPARTIDOR_ASIGNADO",
    ).length;
    const repartidoresAsignadosBot = historialDecisiones.filter(
      (d) =>
        d.tipo_decision === "REPARTIDOR_ASIGNADO" ||
        Boolean(d.repartidor_nombre),
    ).length;

    const tiemposValidos = historialDecisiones
      .map((d) => Number(d.duracion_ms || 0))
      .filter((n) => n > 0);
    const tiempoPromedioMs =
      tiemposValidos.length > 0
        ? Math.round(
            tiemposValidos.reduce((a, b) => a + b, 0) / tiemposValidos.length,
          )
        : 0;

    const porTipoDecision: Record<string, number> = {
      PEDIDO_CREADO: 0,
      REPARTIDOR_ASIGNADO: 0,
      CONSULTA_ESTADO: 0,
      CONSULTA_CATALOGO: 0,
      ESTADO_ACTUALIZADO: 0,
      COMPROBANTE_PAGO: 0,
      ESCALADO_HUMANO: 0,
    };
    for (const d of historialDecisiones) {
      const k = d.tipo_decision;
      porTipoDecision[k] = (porTipoDecision[k] ?? 0) + 1;
    }

    const alertasAbiertas = alertasRows.filter((a) => a.estado === "ABIERTA");

    return {
      conexion: {
        enabled,
        autoAssignRider,
        autoConfirmCash,
        voceroBaseUrl: this.voceroClient.getBaseUrl(),
        apiKeyConfigured: this.voceroClient.isApiKeyConfigured(),
        voceroReachable: voceroHealth.reachable,
        voceroHealthDetail: voceroHealth.detail,
        webhookEndpoint: "/api/v1/webhooks/vocero",
        healthEndpoint: "/api/v1/webhooks/vocero/health",
      },
      estadisticas: {
        total_eventos_entrantes: totalEventos,
        decisiones_automaticas: decisionesAutomaticas,
        pedidos_creados_bot: pedidosCreadosBot,
        repartidores_asignados_bot: repartidoresAsignadosBot,
        escalados_humano: escaladosHumano,
        alertas_pendientes: alertasAbiertas.length,
        tasa_resolucion_automatica:
          totalEventos > 0
            ? Math.round((decisionesAutomaticas / totalEventos) * 100)
            : 100,
        tiempo_promedio_ms: tiempoPromedioMs,
        por_tipo_decision: porTipoDecision,
        outbox: outboxSummaryRows[0] ?? {
          pendientes: 0,
          enviados: 0,
          fallidos: 0,
          muertos: 0,
        },
      },
      alertas_activas: alertasRows.map((a) => ({
        id: a.id,
        tipo: a.tipo,
        severidad: a.severidad,
        estado: a.estado,
        pedido_id: a.pedido_id,
        pedido_numero: a.pedido_numero ? `#${a.pedido_numero}` : null,
        pedido_estado: a.pedido_estado,
        pedido_total_soles: a.pedido_total
          ? formatPen(BigInt(a.pedido_total))
          : null,
        sucursal_nombre: a.sucursal_nombre,
        datos: a.datos ?? {},
        creado_en: a.creado_en,
        resuelto_en: a.resuelto_en,
      })),
      historial_decisiones: historialDecisiones,
      eventos_salida: outboxRows,
    };
  }

  /**
   * Analiza el texto libre del cliente contra el catálogo real de sucursales y platos.
   */
  private matchOrderFromText(
    normalizedText: string,
    rawText: string,
    sucursales: Array<Record<string, any>>,
    locationMsg?: {
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    },
  ): {
    hasOrderIntent: boolean;
    branch: Record<string, any> | null;
    items: Array<{ producto_id: string; cantidad: number; nombre: string }>;
    outOfStockItems: string[];
    metodoPago: MetodoPagoDb;
    direccion: string;
    latitud: number | null;
    longitud: number | null;
  } {
    const wordNumbers: Record<string, number> = {
      un: 1,
      una: 1,
      uno: 1,
      dos: 2,
      tres: 3,
      cuatro: 4,
      cinco: 5,
      seis: 6,
    };

    const orderVerbs =
      /\b(quiero|quisiera|pedir|pedido|ordenar|mandame|enviame|comprar|deme|dame|traeme|enviar)\b/.test(
        normalizedText,
      );

    let chosenBranch: Record<string, any> | undefined =
      sucursales.find((s) => {
        const bNorm = this.normalizeText(s.nombre);
        const slugNorm = this.normalizeText(s.slug || "");
        return (
          (bNorm && normalizedText.includes(bNorm)) ||
          (slugNorm && normalizedText.includes(slugNorm))
        );
      }) ?? sucursales[0];

    const matchedItems: Array<{
      producto_id: string;
      cantidad: number;
      nombre: string;
    }> = [];
    const outOfStockItems: string[] = [];

    const orderedBranches = chosenBranch
      ? [chosenBranch, ...sucursales.filter((s) => s.id !== chosenBranch!.id)]
      : sucursales;

    for (const branch of orderedBranches) {
      const branchMatches: Array<{
        producto_id: string;
        cantidad: number;
        nombre: string;
      }> = [];

      for (const plato of branch.platos ?? []) {
        const pNorm = this.normalizeText(plato.nombre);
        if (!pNorm) continue;

        const significantWords = pNorm
          .split(/\s+/)
          .filter(
            (w) =>
              w.length >= 4 &&
              !["para", "con", "del", "las", "los", "por", "una"].includes(w),
          );

        const fullMatch = normalizedText.includes(pNorm);
        const keywordMatch =
          significantWords.length > 0 &&
          significantWords.every((w) => normalizedText.includes(w));
        const singleStrongWordMatch =
          significantWords.length > 0 &&
          significantWords.some(
            (w) => w.length >= 5 && normalizedText.includes(w),
          );

        if (
          fullMatch ||
          keywordMatch ||
          (orderVerbs && singleStrongWordMatch)
        ) {
          if (!plato.disponible) {
            outOfStockItems.push(plato.nombre);
            continue;
          }

          let qty = 1;
          const anchorWord = significantWords[0] || pNorm;
          const idx = normalizedText.indexOf(anchorWord);
          if (idx > 0) {
            const prefix = normalizedText.slice(Math.max(0, idx - 18), idx);
            const numMatch = prefix.match(/(\d+)\s*(?:x\s*)?$/);
            if (numMatch?.[1]) {
              qty = Math.min(20, Math.max(1, parseInt(numMatch[1], 10)));
            } else {
              for (const [word, val] of Object.entries(wordNumbers)) {
                if (new RegExp(`\\b${word}\\s*$`).test(prefix)) {
                  qty = val;
                  break;
                }
              }
            }
          }

          branchMatches.push({
            producto_id: plato.id,
            cantidad: qty,
            nombre: plato.nombre,
          });
        }
      }

      if (branchMatches.length > 0) {
        chosenBranch = branch;
        matchedItems.push(...branchMatches);
        break;
      }
    }

    let metodoPago: MetodoPagoDb = "EFECTIVO";
    if (/\b(yape|plin)\b/.test(normalizedText)) {
      metodoPago = "YAPE";
    } else if (
      /\b(transferencia|bcp|interbank|bbva|scotiabank|deposito)\b/.test(
        normalizedText,
      )
    ) {
      metodoPago = "TRANSFERENCIA_BANCARIA";
    }

    let direccion = locationMsg?.address || locationMsg?.name || "";
    if (!direccion) {
      const addrMatch = rawText.match(
        /(?:a\s+la\s+direccion|direccion|entregar\s+en|enviar\s+a|a\s+(?:av\.?|avenida|jr\.?|jiron|calle|psje\.?|pasaje|urb\.?|mz\.?))\s*([^,.|\n]+(?:,\s*[^,.|\n]+)?)/i,
      );
      if (addrMatch?.[1]) {
        direccion = addrMatch[0]
          .replace(
            /^(?:a\s+la\s+direccion|direccion|entregar\s+en|enviar\s+a|a)\s*/i,
            "",
          )
          .trim();
      } else {
        direccion = "Av. Larco 345, Miraflores (Confirmado por WhatsApp)";
      }
    }

    const hasOrderIntent =
      matchedItems.length > 0 || outOfStockItems.length > 0 || orderVerbs;

    return {
      hasOrderIntent,
      branch: chosenBranch ?? sucursales[0] ?? null,
      items: matchedItems,
      outOfStockItems,
      metodoPago,
      direccion,
      latitud: locationMsg?.latitude ?? chosenBranch?.latitud ?? -12.1191,
      longitud: locationMsg?.longitude ?? chosenBranch?.longitud ?? -77.0349,
    };
  }

  /**
   * Guarda el vínculo teléfono E.164 <-> voceroConversationId.
   */
  async saveConversationMapping(
    tenantId: string,
    phoneIdentity: string,
    conversationId: string,
    displayName?: string,
  ): Promise<void> {
    const normalizedPhone = this.normalizePhone(phoneIdentity);
    await this.upsertSetting(
      tenantId,
      `vocero.conv.${normalizedPhone}`,
      {
        conversationId,
        phone: normalizedPhone,
        displayName: displayName ?? null,
        updatedAt: new Date().toISOString(),
      },
      null,
    );
  }

  /**
   * Resuelve el `voceroConversationId` de un pedido o cliente.
   */
  async resolveConversationIdForOrder(
    tenantId: string,
    orderId: string,
  ): Promise<{
    conversationId: string | null;
    order: Record<string, any> | null;
  }> {
    const rows: Array<Record<string, any>> = await this.dataSource.query(
      `SELECT p.id, p.numero, p.estado_operativo, p.estado_pago, p.metodo_pago,
p.total_centavos, p.token_publico, p.direccion_snapshot,
c.id AS cliente_id, c.nombre AS cliente_nombre, c.telefono_e164, c.segmento,
s.nombre AS sucursal_nombre,
r.nombre_completo AS repartidor_nombre, r.tipo_vehiculo AS repartidor_vehiculo
FROM pedidos p
JOIN clientes c ON c.id = p.cliente_id
JOIN sucursales s ON s.id = p.sucursal_id
LEFT JOIN repartidores r ON r.id = p.repartidor_id
WHERE p.id = $1 AND p.inquilino_id = $2
LIMIT 1`,
      [orderId, tenantId],
    );

    const order = rows[0] ?? null;
    if (!order) return { conversationId: null, order: null };

    const snapshot = (order.direccion_snapshot ?? {}) as Record<string, any>;
    if (
      typeof snapshot.vocero_conversation_id === "string" &&
      snapshot.vocero_conversation_id.trim()
    ) {
      return {
        conversationId: snapshot.vocero_conversation_id.trim(),
        order,
      };
    }

    const normalizedPhone = this.normalizePhone(order.telefono_e164 ?? "");
    const cfgRows: Array<{ valor: any }> = await this.dataSource
      .query(
        `SELECT valor FROM configuraciones WHERE inquilino_id = $1 AND clave = $2 LIMIT 1`,
        [tenantId, `vocero.conv.${normalizedPhone}`],
      )
      .catch(() => []);

    const mappedConvId = cfgRows[0]?.valor?.conversationId;
    return {
      conversationId: typeof mappedConvId === "string" ? mappedConvId : null,
      order,
    };
  }

  private normalizePhone(phone: string): string {
    const clean = phone.trim();
    if (clean.startsWith("bsuid:")) return clean;
    const digits = clean.replace(/\D/g, "");
    if (!digits) return "+51999999999";
    return `+${digits}`;
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }
}
