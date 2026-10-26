/**
 * Reglas 7.6 y 7.7 — Intentos de entrega (máximo 2) y espera en el restaurante (15 min).
 */

export function evaluateSecondAttemptAuthorization(params: {
  currentAttemptsCount: number;
  maxAttempts?: number;
  authorizedByCoordinatorId?: string | null;
}): {
  canRetry: boolean;
  mustMoveToPendingResolution: boolean;
  reason?: string;
} {
  const maxAttempts = params.maxAttempts ?? 2;

  if (params.currentAttemptsCount >= maxAttempts) {
    return {
      canRetry: false,
      mustMoveToPendingResolution: true,
      reason: "MAX_ATTEMPTS_REACHED",
    };
  }

  if (params.currentAttemptsCount === 1 && !params.authorizedByCoordinatorId) {
    return {
      canRetry: false,
      mustMoveToPendingResolution: false,
      reason: "SECOND_ATTEMPT_REQUIRES_COORDINATOR_AUTHORIZATION",
    };
  }

  return {
    canRetry: true,
    mustMoveToPendingResolution: false,
  };
}

/**
 * Regla 7.7 (DECISION-07): Calcula si el repartidor superó el umbral de espera en el local (15 min).
 * En el MVP solo dispara alerta al Coordinador; no reasigna ni compensa automáticamente.
 */
export function hasExceededPickupWaitThreshold(params: {
  riderAtPickupSince: Date;
  now?: Date;
  pickupWaitMinutes?: number;
}): { exceeded: boolean; elapsedMinutes: number } {
  const now = params.now ?? new Date();
  const limitMinutes = params.pickupWaitMinutes ?? 15;
  const elapsedMinutes = Math.floor(
    (now.getTime() - params.riderAtPickupSince.getTime()) / (60 * 1000),
  );
  return {
    exceeded: elapsedMinutes >= limitMinutes,
    elapsedMinutes,
  };
}

/**
 * Regla 7.10: Enlace profundo a Google Maps sin necesidad de API key.
 */
export function buildGoogleMapsDeepLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}
