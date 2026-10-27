import { z } from "zod";

/**
 * Contrato oficial de integración con Vocero CRM (EventoDespacho)
 * Fuente: docs/roles/06-VOCERO_CRM.md y vocero-crm/src/server/brains/contract.ts
 */

export const voceroMessageSchema = z.object({
  id: z.string(),
  at: z.string(),
  type: z.string(), // "text", "image", "audio", "document", "location", "contacts", etc.
  text: z.string().nullable().optional(),
  mediaId: z.string().nullable().optional(),
  mimeType: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  fileName: z.string().nullable().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string().optional(),
      address: z.string().optional(),
    })
    .optional(),
  contacts: z
    .array(
      z.object({
        name: z.string(),
      })
    )
    .optional(),
});

export const voceroDispatchEventSchema = z.object({
  dispatchId: z.string().min(1, "El dispatchId es obligatorio"),
  organization: z.object({
    id: z.string(),
    slug: z.string().nullable().optional(),
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
    identity: z.string(), // Teléfono E.164 o bsuid:<id>
  }),
  messages: z.array(voceroMessageSchema).min(1, "Debe contener al menos un mensaje"),
  firstMessageAt: z.string(),
  lastMessageAt: z.string(),
});

export type VoceroDispatchEvent = z.infer<typeof voceroDispatchEventSchema>;
export type VoceroMessage = z.infer<typeof voceroMessageSchema>;

export type TipoDecisionBot =
  | "PEDIDO_CREADO"
  | "REPARTIDOR_ASIGNADO"
  | "CONSULTA_ESTADO"
  | "CONSULTA_CATALOGO"
  | "ESTADO_ACTUALIZADO"
  | "COMPROBANTE_PAGO"
  | "ESCALADO_HUMANO"
  | "IGNORADO_TEST";

export interface DecisionBotRegistro {
  dispatch_id: string;
  conversation_id: string;
  canal: string;
  cliente_nombre: string;
  cliente_telefono: string;
  mensaje_entrante: string;
  tipo_decision: TipoDecisionBot;
  resuelto_por_bot: boolean;
  escalado_a_humano: boolean;
  motivo_decision: string;
  respuesta_bot: string | null;
  pedido_id?: string | null;
  pedido_numero?: string | null;
  repartidor_id?: string | null;
  repartidor_nombre?: string | null;
  alerta_id?: string | null;
  duracion_ms: number;
  fecha: string;
}
