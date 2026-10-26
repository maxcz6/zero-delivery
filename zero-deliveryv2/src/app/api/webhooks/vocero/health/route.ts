import { NextResponse } from "next/server";
import { DEFAULT_TENANT_SETTINGS } from "@/modules/settings";

export const dynamic = "force-dynamic";

/**
 * Healthcheck para `BRAIN_HEALTH_URL` de Vocero CRM (`../vocero-crm`).
 * Vocero CRM consulta este endpoint antes de permitir encender el interruptor de despacho.
 */
export async function GET() {
  const enabled =
    process.env.FEATURE_INTEGRATION_VOCERO === "true" ||
    DEFAULT_TENANT_SETTINGS["feature.integration.vocero"];

  return NextResponse.json({
    ok: true,
    service: "zero-delivery",
    voceroIntegrationEnabled: enabled,
  });
}
