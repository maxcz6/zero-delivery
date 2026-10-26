import { z } from "zod";

/**
 * Contrato oficial de integración con Vocero CRM (EventoDespacho)
 * Fuente: docs/roles/06-VOCERO_CRM.md
 */

export const voceroMessageSchema = z.object({
  id: z.string(),
  at: z.string(),
  type: z.string(), // "text", "image", "audio", "document", etc.
  text: z.string().nullable().optional(),
  mediaId: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
});

export const voceroDispatchEventSchema = z.object({
  dispatchId: z.string().min(1, "El dispatchId es obligatorio"),
  organization: z.object({
    id: z.string(),
    slug: z.string(),
  }),
  conversation: z.object({
    id: z.string(),
    channel: z.enum(["whatsapp", "instagram", "messenger", "tiktok"]),
    aiEnabled: z.boolean().default(true),
    windowOpen: z.boolean().default(true),
    windowExpiresAt: z.string().nullable().optional(),
    test: z.boolean().optional().default(false), // Las de laboratorio se ignoran
  }),
  contact: z.object({
    id: z.string(),
    displayName: z.string(),
    identity: z.string(), // Teléfono E.164
  }),
  messages: z.array(voceroMessageSchema).min(1, "Debe contener al menos un mensaje"),
  firstMessageAt: z.string(),
  lastMessageAt: z.string(),
});

export type VoceroDispatchEvent = z.infer<typeof voceroDispatchEventSchema>;
export type VoceroMessage = z.infer<typeof voceroMessageSchema>;
