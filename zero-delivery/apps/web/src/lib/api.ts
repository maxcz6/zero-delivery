import { formatPen } from "@zero-delivery/shared-types";

/**
 * La app llama a la API por el proxy de Next (misma origen) para que la cookie
 * HttpOnly zd_session viaje como first-party sin problemas de CORS.
 */
export const API_BASE = "/api/v1";

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    details !== undefined && (this.details = details);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    // Sin caché HTTP: una sesión distinta nunca debe reutilizar respuestas del rol anterior.
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : `Error ${res.status} al comunicar con la API`;
    throw new ApiError(message, res.status, body);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
};

/** TypeORM serializa bigint como string: normaliza a entero de céntimos. */
export function toCents(value: string | number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

/** Única forma permitida de renderizar dinero en la UI. */
export function money(value: string | number | bigint | null | undefined): string {
  return formatPen(toCents(value));
}
