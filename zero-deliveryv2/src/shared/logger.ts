/**
 * Logger estructurado en JSON con redacción automática de datos personales (PII) y secretos.
 * Regla de Sección 15: nunca registrar teléfonos, direcciones ni tokens en los logs.
 */

const REDACTED_KEYS = new Set([
  "phone",
  "phonee164",
  "phone_e164",
  "address",
  "addresstext",
  "address_text",
  "addresssnapshot",
  "address_snapshot",
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "secret",
  "authorization",
  "x-api-key",
]);

export function redactSensitiveFields(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveFields);
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redactSensitiveFields(value);
    }
  }
  return result;
}

export const logger = {
  info(msg: string, meta?: Record<string, unknown>): void {
    console.log(
      JSON.stringify({
        level: "info",
        time: new Date().toISOString(),
        msg,
        ...(meta ? (redactSensitiveFields(meta) as Record<string, unknown>) : {}),
      }),
    );
  },
  warn(msg: string, meta?: Record<string, unknown>): void {
    console.warn(
      JSON.stringify({
        level: "warn",
        time: new Date().toISOString(),
        msg,
        ...(meta ? (redactSensitiveFields(meta) as Record<string, unknown>) : {}),
      }),
    );
  },
  error(msg: string, meta?: Record<string, unknown>): void {
    console.error(
      JSON.stringify({
        level: "error",
        time: new Date().toISOString(),
        msg,
        ...(meta ? (redactSensitiveFields(meta) as Record<string, unknown>) : {}),
      }),
    );
  },
};
