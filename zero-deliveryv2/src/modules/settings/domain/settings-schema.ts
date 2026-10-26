import { z } from "zod";

/**
 * Esquema tipado de parámetros configurables por tenant (Sección 16 del Spec).
 * Todo lo marcado PLACEHOLDER corresponde a decisiones pendientes (DECISION-01 a DECISION-09).
 */

export const tenantSettingsSchema = z.object({
  // TODO(DECISION-05): Tiempos de aceptación y umbrales de alerta
  "order.acceptance_timeout_minutes": z.number().int().positive().default(5),
  "order.prep_delay_threshold_minutes": z.number().int().positive().default(30),
  "order.no_rider_threshold_minutes": z.number().int().positive().default(10),

  // Aprobado (15 min), acción posterior pendiente: TODO(DECISION-07)
  "rider.pickup_wait_minutes": z.number().int().positive().default(15),

  // TODO(DECISION-02): Edad mínima y garantía mínima para efectivo
  "rider.min_age_for_cash_without_guarantee": z.number().int().min(18).default(35),
  "rider.allow_multiple_orders": z.boolean().default(false),
  "guarantee.min_cents": z.number().int().min(0).default(0),

  // Aprobado: máximo 2 intentos de entrega
  "delivery.max_attempts": z.number().int().min(1).max(5).default(2),

  // Corte de liquidación diaria en America/Lima
  "settlement.cutoff_time": z.string().regex(/^\d{2}:\d{2}$/).default("23:00"),

  // Segmentación de clientes Top
  "customer.top_min_orders": z.number().int().min(1).default(10),

  // TODO(DECISION-04): Visibilidad de reportes por rol
  "reports.branch_manager_can_view_sales": z.boolean().default(false),
  "reports.coordinator_can_view_funnel": z.boolean().default(false),

  // Permisos finos de Empleado (SUPPORT_AGENT)
  "support.can_assign_rider": z.boolean().default(true),
  "support.can_create_advance": z.boolean().default(false),

  // TODO(DECISION-09): Feature flags de integraciones externas (Vocero CRM y WhatsApp)
  "feature.integration.vocero": z.boolean().default(false),
  "feature.integration.whatsapp": z.boolean().default(false),

  "locale.timezone": z.literal("America/Lima").default("America/Lima"),
  "locale.currency": z.literal("PEN").default("PEN"),
});

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;
export type SettingKey = keyof TenantSettings;

export const DEFAULT_TENANT_SETTINGS: TenantSettings = tenantSettingsSchema.parse({});

export const PLACEHOLDER_SETTING_KEYS: ReadonlySet<SettingKey> = new Set([
  "order.acceptance_timeout_minutes",
  "order.prep_delay_threshold_minutes",
  "order.no_rider_threshold_minutes",
  "rider.min_age_for_cash_without_guarantee",
  "rider.allow_multiple_orders",
  "guarantee.min_cents",
  "settlement.cutoff_time",
  "customer.top_min_orders",
  "reports.branch_manager_can_view_sales",
  "reports.coordinator_can_view_funnel",
  "support.can_create_advance",
]);
