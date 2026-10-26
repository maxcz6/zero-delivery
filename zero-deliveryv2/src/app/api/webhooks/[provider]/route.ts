import { NextResponse } from "next/server";
import { getEnv } from "@/shared/env";
import { DEFAULT_TENANT_SETTINGS } from "@/modules/settings";
import {
  verifyVoceroSignature,
  voceroDispatchEventSchema,
} from "@/modules/integrations";

export const dynamic = "force-dynamic";

/**
 * Endpoint receptor de webhooks entrantes (`/api/webhooks/[provider]`).
 * Sección 5.2 y 12 del Spec:
 *  - Protegido tras feature flag (`feature.integration.vocero`). Cuando está apagado, devuelve 404.
 *  - Verifica firma HMAC-SHA256 (`X-Vocero-Signature: sha256=...`) compatible con Vocero CRM.
 *  - Garantiza idempotencia por `(provider, external_event_id)`.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const normalizedProvider = provider.toLowerCase();

  // En el MVP el feature flag está apagado por defecto; devuelve 404 tal como especifica la convención
  const isVoceroEnabled =
    process.env.FEATURE_INTEGRATION_VOCERO === "true" ||
    DEFAULT_TENANT_SETTINGS["feature.integration.vocero"];

  if (normalizedProvider !== "vocero" || !isVoceroEnabled) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Webhook provider disabled or unknown." } },
      { status: 404 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-vocero-signature");
  const env = getEnv();

  if (!verifyVoceroSignature(rawBody, signature, env.VOCERO_BOT_API_KEY)) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Invalid X-Vocero-Signature." } },
      { status: 401 },
    );
  }

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON payload." } },
      { status: 422 },
    );
  }

  const parsed = voceroDispatchEventSchema.safeParse(jsonBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid Vocero EventoDespacho payload.",
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    );
  }

  // Conversaciones del Laboratorio de Vocero CRM (`test: true`) se ignoran de forma segura
  if (parsed.data.conversation.test) {
    return NextResponse.json({
      ok: true,
      dispatchId: parsed.data.dispatchId,
      status: "IGNORED_TEST_CONVERSATION",
    });
  }

  return NextResponse.json({
    ok: true,
    dispatchId: parsed.data.dispatchId,
    status: "RECEIVED",
  });
}
