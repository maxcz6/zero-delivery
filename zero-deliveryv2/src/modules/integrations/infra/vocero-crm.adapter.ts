import type {
  CrmCustomerSyncPayload,
  CrmOrderSyncPayload,
  CrmPort,
  NotificationPort,
  OutboundMessage,
  SendResult,
} from "../domain/ports";
import { ES_PE } from "@/shared/i18n/es-PE";
import { formatPenCents } from "@/shared/money";
import type { OrderStatus } from "@/modules/orders/domain/transitions";

export type VoceroCrmConfig = {
  baseUrl: string;
  botApiKey: string;
  enabled: boolean;
};

/**
 * Adaptador oficial para comunicarse con Vocero CRM (`../vocero-crm`) a través de su contrato `/api/bot/*`.
 * Respeta las invariantes de Vocero CRM 2.1:
 *  - Autenticación por `X-API-Key: <BOT_API_KEY>`.
 *  - El token de WhatsApp nunca sale de Vocero CRM.
 *  - Si `enabled === false` (feature.integration.vocero apagado en MVP), actúa como no-op seguro.
 */
export class VoceroCrmAdapter implements CrmPort, NotificationPort {
  private readonly config: VoceroCrmConfig;

  constructor(config: VoceroCrmConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ""),
    };
  }

  private get headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "X-API-Key": this.config.botApiKey,
    };
  }

  public async send(msg: OutboundMessage): Promise<SendResult> {
    if (!this.config.enabled || !msg.voceroConversationId) {
      return { ok: true, externalMessageId: "noop_disabled_or_no_conversation" };
    }

    const res = await fetch(`${this.config.baseUrl}/api/bot/messages`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        conversationId: msg.voceroConversationId,
        text: msg.body,
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as { messageId?: string };
      return { ok: true, externalMessageId: data.messageId };
    }

    // Vocero CRM devuelve 409 tipados: ai_paused, window_closed, message_limit, sandbox_violation
    const errorPayload = await res.text();
    return {
      ok: false,
      errorReason: `VOCERO_HTTP_${res.status}:${errorPayload}`,
    };
  }

  public async upsertCustomer(customer: CrmCustomerSyncPayload): Promise<void> {
    if (!this.config.enabled || !customer.voceroConversationId) {
      return;
    }

    await fetch(`${this.config.baseUrl}/api/bot/ficha`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify({
        conversationId: customer.voceroConversationId,
        ficha: {
          zeroDeliveryCustomerId: customer.customerId,
          nombreCliente: customer.name,
          segmentoZeroDelivery: customer.segment,
        },
      }),
    });
  }

  public async pushOrder(order: CrmOrderSyncPayload): Promise<void> {
    if (!this.config.enabled || !order.voceroConversationId) {
      return;
    }

    await fetch(`${this.config.baseUrl}/api/bot/ficha`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify({
        conversationId: order.voceroConversationId,
        ficha: {
          ultimoPedidoNumero: `#${order.orderNumber}`,
          ultimoPedidoEstado: ES_PE.orderStatus[order.status],
          ultimoPedidoTotal: formatPenCents(order.totalCents),
        },
      }),
    });
  }

  public async pushOrderStatus(params: {
    orderId: string;
    orderNumber: number;
    status: OrderStatus;
    voceroConversationId?: string;
  }): Promise<void> {
    if (!this.config.enabled || !params.voceroConversationId) {
      return;
    }

    const statusLabel = ES_PE.orderStatus[params.status];
    await fetch(`${this.config.baseUrl}/api/bot/ficha`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify({
        conversationId: params.voceroConversationId,
        ficha: {
          ultimoPedidoNumero: `#${params.orderNumber}`,
          ultimoPedidoEstado: statusLabel,
        },
      }),
    });
  }

  public async requestHumanHandoff(params: {
    voceroConversationId: string;
    reason: "cliente" | "modelo" | "error" | "ventana" | "hostilidad";
  }): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    await fetch(`${this.config.baseUrl}/api/bot/handoff`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        conversationId: params.voceroConversationId,
        reason: params.reason,
      }),
    });
  }

  /**
   * Descarga un comprobante de pago (ej. captura de Yape) enviado por WhatsApp a Vocero CRM
   * usando `GET /api/bot/media/{mediaId}` sin que el token de WhatsApp salga de Vocero CRM.
   */
  public async downloadInboundMedia(
    mediaId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const res = await fetch(
      `${this.config.baseUrl}/api/bot/media/${encodeURIComponent(mediaId)}`,
      {
        method: "GET",
        headers: {
          "X-API-Key": this.config.botApiKey,
        },
      },
    );
    if (!res.ok) {
      throw new Error(`Error al descargar media ${mediaId} desde Vocero CRM: HTTP ${res.status}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
    };
  }
}
