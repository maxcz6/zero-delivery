import { NextResponse } from "next/server";
import { DEFAULT_TENANT_SETTINGS } from "@/modules/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "zero-delivery",
    version: "0.1.0",
    locale: DEFAULT_TENANT_SETTINGS["locale.timezone"],
    currency: DEFAULT_TENANT_SETTINGS["locale.currency"],
    features: {
      voceroCrmIntegration: DEFAULT_TENANT_SETTINGS["feature.integration.vocero"],
      whatsappIntegration: DEFAULT_TENANT_SETTINGS["feature.integration.whatsapp"],
    },
  });
}
