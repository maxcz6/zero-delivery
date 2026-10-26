import type { Cents } from "@/shared/money";

export type PaymentMethod = "CASH" | "YAPE" | "BANK_TRANSFER";
export type PaymentStatus = "PENDING" | "PAID" | "REJECTED" | "REFUNDED";
export type PayoutStatus = "PENDING" | "CONFIRMED";

export type ReleaseFailure =
  | "RIDER_NOT_ASSIGNED"
  | "RIDER_NOT_ELIGIBLE"
  | "PREPAID_PAYMENT_NOT_VALIDATED"
  | "RESTAURANT_PAYOUT_NOT_CONFIRMED"
  | "HANDOFF_NOT_REGISTERED";

export type ReleaseGateInput = {
  order: {
    id: string;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    restaurantPayoutStatus: PayoutStatus;
    riderId: string | null;
    handoffAt: Date | null;
    cashToCollectCents: Cents;
  };
  payment: {
    status: PaymentStatus;
    validatedBy: string | null;
    validatedAt: Date | null;
  } | null;
  payout: {
    status: PayoutStatus;
    confirmedBy: string | null;
    confirmedAt: Date | null;
  } | null;
  rider: {
    id: string;
    isEligible: boolean;
  } | null;
  handoff: {
    handoffAt: Date | null;
    handoffBy: string | null;
  };
};

export type ReleaseGateResult = {
  ok: boolean;
  failures: ReleaseFailure[];
};

/**
 * Regla 7.2.4: El Encargado SOLO puede registrar el handoff físico después de que
 * el pago al restaurante esté confirmado (restaurant_payout.status = CONFIRMED).
 */
export function canRegisterHandoff(payoutStatus: PayoutStatus): {
  ok: boolean;
  reason?: "RESTAURANT_PAYOUT_NOT_CONFIRMED";
} {
  if (payoutStatus !== "CONFIRMED") {
    return { ok: false, reason: "RESTAURANT_PAYOUT_NOT_CONFIRMED" };
  }
  return { ok: true };
}

/**
 * Regla 7.2 — Guarda de Despacho Crítica (`evaluateReleaseGate`).
 * Un pedido solo puede pasar a `ON_THE_WAY` si TODAS las condiciones se cumplen:
 *  1. Hay repartidor asignado y elegible para ese pedido.
 *  2. Si el método es YAPE o BANK_TRANSFER: payment_status = PAID (validado por humano autorizado).
 *  3. El pago al restaurante está confirmado (restaurant_payout.status = CONFIRMED).
 *  4. El Encargado registró el handoff físico al repartidor (handoffAt != null).
 */
export function evaluateReleaseGate(input: ReleaseGateInput): ReleaseGateResult {
  const failures: ReleaseFailure[] = [];

  // 1. Repartidor asignado y elegible
  if (!input.order.riderId || !input.rider || input.rider.id !== input.order.riderId) {
    failures.push("RIDER_NOT_ASSIGNED");
  } else if (!input.rider.isEligible) {
    failures.push("RIDER_NOT_ELIGIBLE");
  }

  // 2. Pago anticipado validado por humano (subir imagen no basta)
  if (input.order.paymentMethod === "YAPE" || input.order.paymentMethod === "BANK_TRANSFER") {
    const isPaidAndHumanValidated =
      input.order.paymentStatus === "PAID" &&
      input.payment?.status === "PAID" &&
      Boolean(input.payment.validatedBy) &&
      Boolean(input.payment.validatedAt);

    if (!isPaidAndHumanValidated) {
      failures.push("PREPAID_PAYMENT_NOT_VALIDATED");
    }
  }

  // 3. Pago al restaurante confirmado
  const isPayoutConfirmed =
    input.order.restaurantPayoutStatus === "CONFIRMED" &&
    input.payout?.status === "CONFIRMED" &&
    Boolean(input.payout.confirmedBy) &&
    Boolean(input.payout.confirmedAt);

  if (!isPayoutConfirmed) {
    failures.push("RESTAURANT_PAYOUT_NOT_CONFIRMED");
  }

  // 4. Handoff físico registrado por el Encargado
  const isHandoffRegistered =
    Boolean(input.order.handoffAt) &&
    Boolean(input.handoff.handoffAt) &&
    Boolean(input.handoff.handoffBy);

  if (!isHandoffRegistered) {
    failures.push("HANDOFF_NOT_REGISTERED");
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}
