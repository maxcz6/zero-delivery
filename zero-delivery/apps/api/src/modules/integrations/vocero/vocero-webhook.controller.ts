import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  Req,
  UseGuards,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
  HttpCode,
} from "@nestjs/common";
import { Request } from "express";
import { ActorContext, MetodoPagoDb } from "@zero-delivery/shared-types";
import { AuthGuard } from "../../../common/guards/auth.guard";
import { CurrentActor } from "../../../common/decorators/current-actor.decorator";
import { VoceroBotService } from "./vocero-bot.service";
import { VoceroClientService } from "./vocero-client.service";
import { OutboxProcessorService } from "./outbox-processor.service";

@Controller()
export class VoceroWebhookController {
  constructor(
    private readonly voceroBotService: VoceroBotService,
    private readonly voceroClient: VoceroClientService,
    private readonly outboxProcessor: OutboxProcessorService
  ) {}

  /**
   * Healthcheck del conector Vocero CRM (GET /api/v1/webhooks/vocero/health).
   */
  @Get("webhooks/vocero/health")
  async getWebhookHealth() {
    return this.voceroBotService.getWebhookHealth();
  }

  /**
   * Recepción del Webhook de despacho desde Vocero CRM (POST /api/v1/webhooks/vocero).
   */
  @Post("webhooks/vocero")
  @HttpCode(200)
  async handleVoceroWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers("x-vocero-signature") voceroSig?: string,
    @Headers("x-signature") altSig?: string,
    @Headers("x-api-key") apiKey?: string,
    @Headers("x-vocero-event") eventType?: string,
    @Body() body?: unknown
  ) {
    const rawBody = req.rawBody
      ? req.rawBody.toString("utf8")
      : JSON.stringify(body ?? {});

    return this.voceroBotService.handleWebhookDispatch({
      rawBody,
      signatureHeader: voceroSig ?? altSig ?? null,
      apiKeyHeader: apiKey ?? null,
      eventTypeHeader: eventType ?? null,
      body,
    });
  }

  // ===========================================================================
  // ENDPOINTS PARA QUE EL BOT DEL CRM VEA Y MODIFIQUE EL SISTEMA DE DELIVERY
  // ===========================================================================

  private async assertBotApiKeyAndEnabled(
    apiKeyHeader?: string,
    authHeader?: string
  ): Promise<string> {
    const tenantId = await this.voceroBotService.resolveDefaultTenantId();
    if (!tenantId) {
      throw new NotFoundException("Inquilino no encontrado");
    }

    const enabled = await this.voceroBotService.isIntegrationEnabled(tenantId);
    if (!enabled) {
      throw new NotFoundException(
        "La conexión con Vocero CRM está apagada en este momento"
      );
    }

    const keyCandidate = apiKeyHeader || authHeader || "";
    if (!this.voceroClient.verifySignature("", null, keyCandidate)) {
      throw new UnauthorizedException("X-API-Key de Bot Vocero inválida");
    }

    return tenantId;
  }

  @Get("integrations/vocero/bot/context")
  async getBotContext(
    @Headers("x-api-key") apiKey?: string,
    @Headers("authorization") authHeader?: string,
    @Query("telefono") telefono?: string,
    @Query("conversationId") conversationId?: string
  ) {
    const tenantId = await this.assertBotApiKeyAndEnabled(apiKey, authHeader);
    const data = await this.voceroBotService.getSystemContextForBot({
      tenantId,
      telefono,
      conversationId,
    });
    return { ok: true, data };
  }

  @Post("integrations/vocero/bot/order")
  async createOrderFromBot(
    @Headers("x-api-key") apiKey?: string,
    @Headers("authorization") authHeader?: string,
    @Body()
    body?: {
      conversationId?: string;
      canal?: string;
      cliente_nombre: string;
      cliente_telefono: string;
      sucursal_id: string;
      items: Array<{ producto_id: string; cantidad: number }>;
      metodo_pago?: MetodoPagoDb;
      direccion_linea1: string;
      latitud?: number;
      longitud?: number;
      notas?: string;
    }
  ) {
    const tenantId = await this.assertBotApiKeyAndEnabled(apiKey, authHeader);
    const result = await this.voceroBotService.executeBotOrderCreation({
      tenantId,
      conversationId: body?.conversationId,
      canal: body?.canal ?? "whatsapp",
      clienteNombre: body?.cliente_nombre || "Cliente WhatsApp",
      clienteTelefono: body?.cliente_telefono || "+51999999999",
      sucursalId: body?.sucursal_id || "",
      items: body?.items ?? [],
      metodoPago: body?.metodo_pago ?? "EFECTIVO",
      direccionLinea1: body?.direccion_linea1 || "Dirección por confirmar",
      latitud: body?.latitud ?? null,
      longitud: body?.longitud ?? null,
      notas: body?.notas,
    });
    return { ok: true, data: result };
  }

  @Post("integrations/vocero/bot/assign-rider")
  async assignRiderFromBot(
    @Headers("x-api-key") apiKey?: string,
    @Headers("authorization") authHeader?: string,
    @Body() body?: { pedido_id: string }
  ) {
    const tenantId = await this.assertBotApiKeyAndEnabled(apiKey, authHeader);
    const botActor = await this.voceroBotService.getBotActor(tenantId);
    const result = await this.voceroBotService.botAssignRecommendedRider(
      botActor,
      body?.pedido_id || ""
    );
    return { ok: true, data: result };
  }

  @Post("integrations/vocero/bot/escalate")
  async escalateFromBot(
    @Headers("x-api-key") apiKey?: string,
    @Headers("authorization") authHeader?: string,
    @Body()
    body?: {
      conversationId?: string;
      pedido_id?: string;
      cliente_nombre?: string;
      cliente_telefono?: string;
      mensaje_cliente?: string;
      motivo: string;
      severidad?: "INFO" | "ADVERTENCIA" | "CRITICO";
      sugerencia_accion?: string;
    }
  ) {
    const tenantId = await this.assertBotApiKeyAndEnabled(apiKey, authHeader);
    const alerta = await this.voceroBotService.createBotEscalationAlert({
      tenantId,
      tipo: "BOT_INDECISION",
      severidad: body?.severidad ?? "ADVERTENCIA",
      pedidoId: body?.pedido_id ?? null,
      conversationId: body?.conversationId ?? null,
      clienteNombre: body?.cliente_nombre || "Cliente CRM",
      clienteTelefono: body?.cliente_telefono || "",
      mensajeCliente: body?.mensaje_cliente || "",
      motivoEscalado: body?.motivo || "El Bot solicitó intervención humana",
      sugerenciaAccion:
        body?.sugerencia_accion ||
        "Revisar la conversación en Vocero CRM y tomar decisión manual.",
    });

    if (body?.conversationId) {
      await this.voceroClient.requestHandoff(
        body.conversationId,
        "modelo",
        true
      );
    }

    return { ok: true, data: alerta };
  }

  // ===========================================================================
  // ENDPOINTS DE GESTIÓN PARA ADMINISTRADOR Y COORDINADOR (PANEL WEB HITO 4)
  // ===========================================================================

  private assertCoordinatorOrAdmin(actor: ActorContext): void {
    const allowed = [
      "ADMIN",
      "COORDINATOR",
      "SUPPORT_AGENT",
      "ADMIN_SISTEMA",
      "COORDINADOR",
      "AGENTE_SOPORTE",
    ];
    if (!allowed.includes(actor.role)) {
      throw new ForbiddenException(
        "Solo el Administrador, Coordinador o Soporte pueden acceder al Centro de Control del Bot"
      );
    }
  }

  @Get("integrations/vocero/overview")
  @UseGuards(AuthGuard)
  async getOverview(@CurrentActor() actor: ActorContext) {
    this.assertCoordinatorOrAdmin(actor);
    const data = await this.voceroBotService.getBotDashboardOverview(actor);
    return { ok: true, data };
  }

  @Get("integrations/vocero/system-state")
  @UseGuards(AuthGuard)
  async getSystemStateForDashboard(
    @CurrentActor() actor: ActorContext,
    @Query("telefono") telefono?: string
  ) {
    this.assertCoordinatorOrAdmin(actor);
    const data = await this.voceroBotService.getSystemContextForBot({
      tenantId: actor.tenantId,
      telefono,
    });
    return { ok: true, data };
  }

  @Patch("integrations/vocero/toggle")
  @UseGuards(AuthGuard)
  async toggleConnection(
    @CurrentActor() actor: ActorContext,
    @Body()
    body: {
      enabled?: boolean;
      autoAssignRider?: boolean;
      autoConfirmCash?: boolean;
      voceroBaseUrl?: string;
      botApiKey?: string;
    }
  ) {
    this.assertCoordinatorOrAdmin(actor);
    const data = await this.voceroBotService.toggleConnection(actor, body);
    return { ok: true, data };
  }

  @Post("integrations/vocero/alerts/:alertId/resolve")
  @UseGuards(AuthGuard)
  async resolveAlert(
    @CurrentActor() actor: ActorContext,
    @Param("alertId") alertId: string,
    @Body() body?: { nota?: string }
  ) {
    this.assertCoordinatorOrAdmin(actor);
    const data = await this.voceroBotService.resolveBotAlert(
      actor,
      alertId,
      body?.nota
    );
    return { ok: true, data };
  }

  @Post("integrations/vocero/outbox/:eventId/retry")
  @UseGuards(AuthGuard)
  async retryOutbox(
    @CurrentActor() actor: ActorContext,
    @Param("eventId") eventId: string
  ) {
    this.assertCoordinatorOrAdmin(actor);
    const data = await this.voceroBotService.retryOutboxEvent(actor, eventId);
    await this.outboxProcessor.processPendingBatch();
    return { ok: true, data };
  }

  @Post("integrations/vocero/outbox/flush")
  @UseGuards(AuthGuard)
  async flushOutbox(@CurrentActor() actor: ActorContext) {
    this.assertCoordinatorOrAdmin(actor);
    const processed = await this.outboxProcessor.processPendingBatch();
    return { ok: true, data: { processed } };
  }

  @Post("integrations/vocero/orders/:orderId/auto-assign")
  @UseGuards(AuthGuard)
  async autoAssignOrderRider(
    @CurrentActor() actor: ActorContext,
    @Param("orderId") orderId: string
  ) {
    this.assertCoordinatorOrAdmin(actor);
    const data = await this.voceroBotService.botAssignRecommendedRider(
      actor,
      orderId
    );
    return { ok: true, data };
  }

  @Post(["integrations/vocero/dispatch", "integrations/vocero/simulate"])
  @UseGuards(AuthGuard)
  async dispatchBotTurn(
    @CurrentActor() actor: ActorContext,
    @Body()
    body: {
      nombreCliente?: string;
      telefono?: string;
      conversationId?: string;
      mensaje: string;
      canal?: "whatsapp" | "instagram" | "messenger" | "tiktok";
    }
  ) {
    this.assertCoordinatorOrAdmin(actor);
    const data = await this.voceroBotService.simulateBotMessage(actor, body);
    return { ok: true, data };
  }
}
