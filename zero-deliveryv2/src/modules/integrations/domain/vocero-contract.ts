import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/**
 * Contrato de interoperabilidad entre Vocero CRM (`../vocero-crm`) y Zero Delivery.
 * Espeja exactamente `src/server/brains/contract.ts` y `docs/openapi.json` de Vocero CRM 2.1.
 */

export const VOCERO_SIGNATURE_PREFIX = "sha256=";

export const voceroLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional(),
});

export const voceroEventMessageSchema = z.object({
  id: z.string().min(1),
  at: z.string().min(1),
  type: z.string().min(1),
  text: z.string().nullable(),
  mediaId: z.string().nullable(),
  mimeType: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  fileName: z.string().optional(),
  location: voceroLocationSchema.optional(),
  contacts: z.array(z.object({ name: z.string() })).optional(),
});

export const voceroDispatchEventSchema = z.object({
  dispatchId: z.string().min(1),
  organization: z.object({
    id: z.string().min(1),
    slug: z.string().nullable(),
  }),
  conversation: z.object({
    id: z.string().min(1),
    channel: z.enum(["whatsapp", "instagram", "messenger", "tiktok"]),
    aiEnabled: z.boolean(),
    windowOpen: z.boolean(),
    windowExpiresAt: z.string().nullable(),
    test: z.literal(true).optional(),
  }),
  contact: z.object({
    id: z.string().min(1),
    displayName: z.string(),
    identity: z.string().min(1),
  }),
  messages: z.array(voceroEventMessageSchema).min(1),
  firstMessageAt: z.string(),
  lastMessageAt: z.string(),
});

export type VoceroDispatchEvent = z.infer<typeof voceroDispatchEventSchema>;

/**
 * Calcula la firma `X-Vocero-Signature: sha256=<hex>` sobre el cuerpo crudo tal como lo hace Vocero CRM.
 */
export function signVoceroPayload(rawBody: string, secret: string): string {
  const hex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return `${VOCERO_SIGNATURE_PREFIX}${hex}`;
}

/**
 * Verifica en tiempo constante la cabecera `X-Vocero-Signature` enviada por Vocero CRM.
 */
export function verifyVoceroSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!signatureHeader || !secret || !signatureHeader.startsWith(VOCERO_SIGNATURE_PREFIX)) {
    return false;
  }
  const receivedHex = signatureHeader.slice(VOCERO_SIGNATURE_PREFIX.length);
  if (!/^[0-9a-f]{64}$/i.test(receivedHex)) {
    return false;
  }
  const expectedHex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(receivedHex.toLowerCase(), "hex");
  const b = Buffer.from(expectedHex.toLowerCase(), "hex");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
