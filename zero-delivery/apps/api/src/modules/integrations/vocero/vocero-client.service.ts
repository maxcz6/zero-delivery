import { Injectable, Logger } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

export interface VoceroFichaPayload {
  zeroDeliveryCustomerId?: string;
  nombreCliente?: string;
  segmentoZeroDelivery?: string;
  ultimoPedidoNumero?: string;
  ultimoPedidoEstado?: string;
  ultimoPedidoTotal?: string;
  sucursalPreferida?: string;
  repartidorAsignado?: string | null;
  [key: string]: unknown;
}

export interface VoceroSendResult {
  ok: boolean;
  status?: number;
  messageId?: string;
  errorReason?: string;
}

export interface VoceroContextResult {
  found: boolean;
  contact?: {
    id: string;
    name: string;
    identity: string;
    channel: string;
    phone: string | null;
    ficha: Record<string, unknown>;
  };
  conversation?: {
    id: string;
    aiEnabled: boolean;
    handoffAt: string | null;
    windowOpen: boolean;
    windowRemainingMs: number;
  };
  lead?: {
    id: string;
    stageName: string;
    nextStages: string[];
  } | null;
  status?: number;
  errorReason?: string;
}

@Injectable()
export class VoceroClientService {
  private readonly logger = new Logger(VoceroClientService.name);

  private runtimeBaseUrl: string | null = null;
  private runtimeBotApiKey: string | null = null;

  setRuntimeConfig(config: { baseUrl?: string | null; botApiKey?: string | null }): void {
    if (typeof config.baseUrl === "string" && config.baseUrl.trim().length > 0) {
      this.runtimeBaseUrl = config.baseUrl.trim().replace(/\/+$/, "");
    }
    if (typeof config.botApiKey === "string" && config.botApiKey.trim().length >= 16) {
      this.runtimeBotApiKey = config.botApiKey.trim();
    }
  }

  getBaseUrl(): string {
    return (
      this.runtimeBaseUrl ||
      process.env["VOCERO_BASE_URL"]?.trim() ||
      process.env["CRM_BASE_URL"]?.trim() ||
      "http://localhost:3000"
    ).replace(/\/+$/, "");
  }

  getCandidateBaseUrls(): string[] {
    const primary = this.getBaseUrl();
    const candidates = [primary];
    if (primary.includes("host.docker.internal")) {
      candidates.push(primary.replace("host.docker.internal", "localhost"));
    } else if (primary.includes("localhost")) {
      candidates.push(primary.replace("localhost", "host.docker.internal"));
    }
    return Array.from(new Set(candidates));
  }

  getBotApiKey(): string {
    return (
      this.runtimeBotApiKey ||
      process.env["VOCERO_BOT_API_KEY"]?.trim() ||
      process.env["BOT_API_KEY"]?.trim() ||
      "zero-delivery-vocero-shared-bot-key-dev"
    );
  }

  isApiKeyConfigured(): boolean {
    const key = this.getBotApiKey();
    return typeof key === "string" && key.length >= 16;
  }

  /**
   * Firma HMAC-SHA256 idéntica a vocero-crm/src/server/brains/contract.ts (`sha256=<hex>`)
   */
  signBody(rawBody: string, secret?: string): string {
    const key = secret ?? this.getBotApiKey();
    const hex = createHmac("sha256", key).update(rawBody, "utf8").digest("hex");
    return `sha256=${hex}`;
  }

  /**
   * Comparación en tiempo constante de la firma HMAC-SHA256 o X-API-Key directa.
   */
  verifySignature(
    rawBody: string,
    signatureHeader?: string | null,
    apiKeyHeader?: string | null
  ): boolean {
    const secret = this.getBotApiKey();
    if (!secret || secret.length < 16) return false;

    // 1. Verificar firma HMAC-SHA256 (X-Vocero-Signature: sha256=...)
    if (signatureHeader && signatureHeader.trim().length > 0) {
      const normalizedSig = signatureHeader.trim().startsWith("sha256=")
        ? signatureHeader.trim()
        : `sha256=${signatureHeader.trim()}`;
      const expected = Buffer.from(this.signBody(rawBody, secret), "utf8");
      const received = Buffer.from(normalizedSig, "utf8");
      if (expected.length === received.length && timingSafeEqual(expected, received)) {
        return true;
      }
    }

    // 2. Respaldo para llamadas autenticadas por X-API-Key o Bearer
    if (apiKeyHeader && apiKeyHeader.trim().length > 0) {
      const rawKey = apiKeyHeader.trim().replace(/^Bearer\s+/i, "");
      const expectedKey = Buffer.from(secret, "utf8");
      const receivedKey = Buffer.from(rawKey, "utf8");
      if (
        expectedKey.length === receivedKey.length &&
        timingSafeEqual(expectedKey, receivedKey)
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Consulta la salud de la instancia de Vocero CRM (/api/health) y registra el pulso
   * del cerebro externo en Vocero CRM (/api/bot/profile).
   */
  async checkVoceroHealth(): Promise<{
    reachable: boolean;
    url: string;
    status?: number;
    detail?: string;
    botAuthValid?: boolean;
  }> {
    const candidates = this.getCandidateBaseUrls();
    let lastError = "No alcanzable";

    for (const candidateUrl of candidates) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetch(`${candidateUrl}/api/health`, {
          method: "GET",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        if (res.ok) {
          // Si este candidato respondió y no teníamos runtimeBaseUrl fija, adoptarlo
          if (!this.runtimeBaseUrl && candidateUrl !== this.getBaseUrl()) {
            this.runtimeBaseUrl = candidateUrl;
          }

          // Enviar pulso autenticado a /api/bot/profile para que Vocero CRM marque `markBotSeen()`
          let botAuthValid = false;
          try {
            const profRes = await fetch(`${candidateUrl}/api/bot/profile`, {
              method: "GET",
              headers: {
                Accept: "application/json",
                "X-API-Key": this.getBotApiKey(),
              },
              signal: controller.signal,
            });
            botAuthValid = profRes.status !== 401 && profRes.status !== 403;
          } catch {
            // ignore
          }

          return {
            reachable: true,
            url: candidateUrl,
            status: res.status,
            botAuthValid,
            detail: botAuthValid
              ? "Conectado en producción con Vocero CRM (API Key autenticada)"
              : "Vocero CRM alcanzable (verificar BOT_API_KEY en Vocero CRM)",
          };
        }
        lastError = `HTTP ${res.status}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "No alcanzable";
      } finally {
        clearTimeout(timer);
      }
    }

    return {
      reachable: false,
      url: this.getBaseUrl(),
      botAuthValid: false,
      detail: lastError,
    };
  }

  /**
   * Consulta el contexto conversacional real en Vocero CRM (`GET /api/bot/context`).
   * Permite resolver el `conversationId` y `contactId` reales de producción en Vocero CRM.
   */
  async fetchConversationContext(params: {
    identity?: string;
    conversationId?: string;
  }): Promise<VoceroContextResult> {
    const query = new URLSearchParams();
    if (params.conversationId) {
      query.set("conversationId", params.conversationId);
    } else if (params.identity) {
      query.set("identity", params.identity);
    } else {
      return { found: false, errorReason: "MISSING_QUERY" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/bot/context?${query.toString()}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-Key": this.getBotApiKey(),
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        return {
          found: false,
          status: res.status,
          errorReason: `VOCERO_CONTEXT_HTTP_${res.status}`,
        };
      }

      const data = (await res.json()) as Record<string, any>;
      return {
        found: true,
        status: res.status,
        contact: data["contact"],
        conversation: data["conversation"],
        lead: data["lead"] ?? null,
      };
    } catch (err) {
      return {
        found: false,
        errorReason: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Indica a Vocero CRM que marque leído y muestre "escribiendo..." en WhatsApp.
   */
  async sendTyping(conversationId: string, enabled = true): Promise<void> {
    if (!enabled || !conversationId) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      await fetch(`${this.getBaseUrl()}/api/bot/typing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.getBotApiKey(),
        },
        body: JSON.stringify({ conversationId }),
        signal: controller.signal,
      });
    } catch {
      // No-op: el indicador de escritura nunca aborta el flujo
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Envía un mensaje al cliente a través de Vocero CRM (POST /api/bot/messages).
   */
  async sendMessage(
    conversationId: string,
    text: string,
    integrationEnabled = true
  ): Promise<VoceroSendResult> {
    if (!integrationEnabled) {
      return { ok: false, errorReason: "INTEGRATION_DISABLED_NOOP" };
    }
    if (!conversationId) {
      return { ok: false, errorReason: "MISSING_CONVERSATION_ID" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/bot/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.getBotApiKey(),
        },
        body: JSON.stringify({ conversationId, text }),
        signal: controller.signal,
      });

      const bodyText = await res.text().catch(() => "");
      if (res.ok) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(bodyText) as Record<string, unknown>;
        } catch {
          // ignore
        }
        return {
          ok: true,
          status: res.status,
          messageId: typeof parsed.messageId === "string" ? parsed.messageId : undefined,
        };
      }

      return {
        ok: false,
        status: res.status,
        errorReason: `VOCERO_HTTP_${res.status}:${bodyText.slice(0, 240)}`,
      };
    } catch (err) {
      this.logger.warn(
        `No se pudo contactar a Vocero CRM (${this.getBaseUrl()}/api/bot/messages): ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return {
        ok: false,
        errorReason: `VOCERO_NETWORK_ERROR:${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Actualiza la ficha del cliente en Vocero CRM (PUT /api/bot/ficha).
   * Regla 7.1: Nunca envía margen, payout, garantía ni deuda.
   */
  async updateFicha(
    conversationId: string,
    ficha: VoceroFichaPayload,
    integrationEnabled = true
  ): Promise<VoceroSendResult> {
    if (!integrationEnabled || !conversationId) {
      return { ok: false, errorReason: "INTEGRATION_DISABLED_OR_NO_CONV" };
    }

    // Sanitizar campos prohibidos por regla 7.1
    const safeFicha: Record<string, unknown> = { ...ficha };
    delete safeFicha["margen"];
    delete safeFicha["margen_centavos"];
    delete safeFicha["payout"];
    delete safeFicha["garantia"];
    delete safeFicha["deuda"];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/bot/ficha`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.getBotApiKey(),
        },
        body: JSON.stringify({ conversationId, ficha: safeFicha }),
        signal: controller.signal,
      });

      if (res.ok) {
        return { ok: true, status: res.status };
      }
      const bodyText = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        errorReason: `VOCERO_HTTP_${res.status}:${bodyText.slice(0, 200)}`,
      };
    } catch (err) {
      return {
        ok: false,
        errorReason: `VOCERO_NETWORK_ERROR:${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Solicita handoff a humano en Vocero CRM (POST /api/bot/handoff).
   * Motivos oficiales: 'cliente' | 'modelo' | 'error' | 'ventana' | 'hostilidad'
   */
  async requestHandoff(
    conversationId: string,
    reason: "cliente" | "modelo" | "error" | "ventana" | "hostilidad" | string,
    integrationEnabled = true
  ): Promise<VoceroSendResult> {
    if (!integrationEnabled || !conversationId) {
      return { ok: false, errorReason: "INTEGRATION_DISABLED_OR_NO_CONV" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${this.getBaseUrl()}/api/bot/handoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": this.getBotApiKey(),
        },
        body: JSON.stringify({ conversationId, reason }),
        signal: controller.signal,
      });

      if (res.ok) {
        return { ok: true, status: res.status };
      }
      const bodyText = await res.text().catch(() => "");
      return {
        ok: false,
        status: res.status,
        errorReason: `VOCERO_HTTP_${res.status}:${bodyText.slice(0, 200)}`,
      };
    } catch (err) {
      return {
        ok: false,
        errorReason: `VOCERO_NETWORK_ERROR:${err instanceof Error ? err.message : String(err)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Descarga metadatos/binario de un adjunto desde Vocero CRM (GET /api/bot/media/:mediaId).
   */
  async downloadMediaInfo(
    mediaId: string,
    integrationEnabled = true
  ): Promise<{
    ok: boolean;
    mimeType?: string;
    sizeBytes?: number;
    errorReason?: string;
  }> {
    if (!integrationEnabled || !mediaId) {
      return { ok: false, errorReason: "INTEGRATION_DISABLED_OR_NO_MEDIA" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        `${this.getBaseUrl()}/api/bot/media/${encodeURIComponent(mediaId)}`,
        {
          method: "GET",
          headers: { "X-API-Key": this.getBotApiKey() },
          signal: controller.signal,
        }
      );

      if (!res.ok) {
        return { ok: false, errorReason: `VOCERO_MEDIA_HTTP_${res.status}` };
      }

      const mimeType = res.headers.get("content-type") ?? "application/octet-stream";
      const buf = await res.arrayBuffer();
      return {
        ok: true,
        mimeType,
        sizeBytes: buf.byteLength,
      };
    } catch (err) {
      return {
        ok: false,
        errorReason: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
