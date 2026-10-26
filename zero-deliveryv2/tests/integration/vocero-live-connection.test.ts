import { describe, it, expect } from "vitest";
import { VoceroCrmAdapter } from "@/modules/integrations/infra/vocero-crm.adapter";
import {
  signVoceroPayload,
  verifyVoceroSignature,
  voceroDispatchEventSchema,
} from "@/modules/integrations/domain/vocero-contract";

const VOCERO_URL = process.env.VOCERO_BASE_URL ?? "http://localhost:3000";
const ZERO_URL = process.env.APP_BASE_URL ?? "http://localhost:3001";
const BOT_API_KEY = process.env.VOCERO_BOT_API_KEY ?? "zero-delivery-vocero-shared-bot-key-dev";

describe("Live Integration: Zero Delivery <-> Vocero CRM", () => {
  it("Vocero CRM está arriba y saludable en http://localhost:3000/api/health", async () => {
    const res = await fetch(`${VOCERO_URL}/api/health`);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { ok?: boolean; version?: string };
    expect(data.ok).toBe(true);
    expect(data.version).toBe("2.1.0");
  });

  it("Vocero CRM Bot API rechaza llamadas sin API Key (401 Unauthorized)", async () => {
    const res = await fetch(`${VOCERO_URL}/api/bot/context?waId=51999999999`);
    expect(res.status).toBe(401);

    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("unauthorized");
  });

  it("Vocero CRM Bot API rechaza llamadas con API Key errónea (401 Unauthorized)", async () => {
    const res = await fetch(`${VOCERO_URL}/api/bot/context?waId=51999999999`, {
      headers: {
        "X-API-Key": "clave_incorrecta_invalida_123456",
      },
    });
    expect(res.status).toBe(401);

    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("unauthorized");
  });

  it("Vocero CRM Bot API valida la autenticación con la BOT_API_KEY compartida de Zero Delivery", async () => {
    const res = await fetch(`${VOCERO_URL}/api/bot/context?waId=51999999999`, {
      headers: {
        "X-API-Key": BOT_API_KEY,
      },
    });

    // Con la clave correcta, pasa el gate de autenticación 401
    // (Devuelve 409 si la instancia nueva aún no tiene org, o 200/404 si ya está poblada)
    expect(res.status).not.toBe(401);
  });

  it("Zero Delivery responde con el contrato de salud esperado por Vocero CRM (BRAIN_HEALTH_URL)", async () => {
    const res = await fetch(`${ZERO_URL}/api/webhooks/vocero/health`);
    expect(res.status).toBe(200);

    const data = (await res.json()) as { ok: boolean; service: string };
    expect(data.ok).toBe(true);
    expect(data.service).toBe("zero-delivery");
  });

  it("Zero Delivery Webhook mantiene el endpoint protegido tras Feature Flag en MVP (404 seguro)", async () => {
    const rawPayload = JSON.stringify({
      dispatchId: "dsp_test_fake_1",
      messages: [],
    });

    const res = await fetch(`${ZERO_URL}/api/webhooks/vocero`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: rawPayload,
    });

    // Con feature flag apagado en el contenedor en vivo, responde 404 seguro
    expect(res.status).toBe(404);
  });

  it("El contrato HMAC-SHA256 firma y verifica en tiempo constante entre ambos sistemas", () => {
    const payload = JSON.stringify({
      dispatchId: "dsp_12345",
      organization: { id: "org_1", slug: "polleria" },
      conversation: {
        id: "cv_1",
        channel: "whatsapp",
        aiEnabled: true,
        windowOpen: true,
        windowExpiresAt: null,
      },
      contact: {
        id: "ct_1",
        displayName: "Juan Perez",
        identity: "51987654321",
      },
      messages: [
        {
          id: "msg_1",
          at: new Date().toISOString(),
          type: "text",
          text: "Hola, deseo hacer un pedido",
          mediaId: null,
        },
      ],
      firstMessageAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
    });

    // Valida esquema de evento Vocero
    const parsed = voceroDispatchEventSchema.safeParse(JSON.parse(payload));
    expect(parsed.success).toBe(true);

    // Firma tal como la genera Vocero CRM
    const signature = signVoceroPayload(payload, BOT_API_KEY);
    expect(signature.startsWith("sha256=")).toBe(true);

    // Verificación exacta por Zero Delivery
    expect(verifyVoceroSignature(payload, signature, BOT_API_KEY)).toBe(true);
    expect(verifyVoceroSignature(payload, "sha256=firma_falsa_64caracteres_0123456789abcdef0123456789abcdef0123456789abcdef", BOT_API_KEY)).toBe(false);
  });

  it("El adaptador VoceroCrmAdapter ejecuta llamadas tipadas contra Vocero CRM en código", async () => {
    const adapter = new VoceroCrmAdapter({
      baseUrl: VOCERO_URL,
      botApiKey: BOT_API_KEY,
      enabled: true,
    });

    // Probamos enviar un mensaje a una conversación en Vocero CRM
    // Vocero CRM procesa la llamada y responde con código tipado
    const result = await adapter.send({
      tenantId: "tn_test",
      channel: "VOCERO_CRM",
      templateKey: "ORDER_STATUS_UPDATE",
      body: "Tu pedido #1001 está en camino",
      voceroConversationId: "cv_inexistente_test",
    });

    expect(result).toBeDefined();
    expect(typeof result.ok).toBe("boolean");
    // Al no existir la conversación, ok es false pero estructurado con el código devuelto por Vocero
    if (!result.ok) {
      expect(result.errorReason).toContain("VOCERO_HTTP_");
    }
  });
});
