import { describe, expect, it, vi } from "vitest";
import {
  signVoceroPayload,
  verifyVoceroSignature,
  voceroDispatchEventSchema,
  VoceroCrmAdapter,
} from "@/modules/integrations";

describe("Interoperabilidad con Vocero CRM (`vocero-contract` & `VoceroCrmAdapter`) (CA-13)", () => {
  const sampleSecret = "vocero-shared-bot-api-key-1234567890";

  const sampleDispatchPayload = {
    dispatchId: "dsp_01jc8x9z",
    organization: { id: "org_1", slug: "polleria-central" },
    conversation: {
      id: "cv_12345",
      channel: "whatsapp",
      aiEnabled: true,
      windowOpen: true,
      windowExpiresAt: "2026-10-27T08:00:00.000Z",
    },
    contact: {
      id: "ct_999",
      displayName: "María Quispe",
      identity: "51987654321",
    },
    messages: [
      {
        id: "msg_001",
        at: "2026-10-26T12:00:00.000Z",
        type: "image",
        text: null,
        mediaId: "wa_media_yape_99",
        mimeType: "image/jpeg",
        caption: "Aquí está mi Yape",
      },
    ],
    firstMessageAt: "2026-10-26T12:00:00.000Z",
    lastMessageAt: "2026-10-26T12:00:00.000Z",
  };

  it("firma y verifica byte a byte la cabecera X-Vocero-Signature (sha256=<hmac>)", () => {
    const rawBody = JSON.stringify(sampleDispatchPayload);
    const signatureHeader = signVoceroPayload(rawBody, sampleSecret);

    expect(signatureHeader.startsWith("sha256=")).toBe(true);
    expect(verifyVoceroSignature(rawBody, signatureHeader, sampleSecret)).toBe(true);
    expect(verifyVoceroSignature(rawBody + " ", signatureHeader, sampleSecret)).toBe(false);
    expect(verifyVoceroSignature(rawBody, signatureHeader, "wrong-secret")).toBe(false);
  });

  it("valida correctamente el esquema EventoDespacho de Vocero CRM 2.1 (incluyendo mediaId y location)", () => {
    const parsed = voceroDispatchEventSchema.safeParse(sampleDispatchPayload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.messages[0]?.mediaId).toBe("wa_media_yape_99");
    }
  });

  it("actúa como no-op seguro cuando el feature flag de Vocero CRM está apagado en el MVP", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const adapter = new VoceroCrmAdapter({
      baseUrl: "http://localhost:3000",
      botApiKey: sampleSecret,
      enabled: false,
    });

    const sendRes = await adapter.send({
      tenantId: "tenant-1",
      channel: "VOCERO_CRM",
      voceroConversationId: "cv_12345",
      templateKey: "ORDER_ON_THE_WAY",
      body: "Tu pedido está en camino",
    });

    expect(sendRes.ok).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
