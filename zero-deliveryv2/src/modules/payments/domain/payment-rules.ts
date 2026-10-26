import { AppError } from "@/shared/errors";
import type { Cents } from "@/shared/money";
import type { PaymentMethod, PaymentStatus } from "@/modules/orders/domain/release-gate";

export type PaymentCorrectionEvent = {
  type: "CORRECTED";
  paymentId: string;
  actorId: string;
  reason: string;
  before: {
    status: PaymentStatus;
    amountCents: Cents;
    method: PaymentMethod;
    reference?: string | null;
  };
  after: {
    status: PaymentStatus;
    amountCents: Cents;
    method: PaymentMethod;
    reference?: string | null;
  };
};

/**
 * Regla 7.3 y CA-11:
 * Toda corrección de pago exige `reason` obligatorio, conserva el registro original
 * y genera un asiento inmutable en `payment_events` con los valores `before` y `after`.
 */
export function buildPaymentCorrectionEvent(params: {
  paymentId: string;
  actorId: string;
  reason: string;
  before: PaymentCorrectionEvent["before"];
  after: PaymentCorrectionEvent["after"];
}): PaymentCorrectionEvent {
  const cleanReason = params.reason.trim();
  if (cleanReason.length < 4) {
    throw new AppError(
      "VALIDATION_ERROR",
      "La corrección de un pago exige indicar un motivo detallado.",
      422,
    );
  }
  return {
    type: "CORRECTED",
    paymentId: params.paymentId,
    actorId: params.actorId,
    reason: cleanReason,
    before: { ...params.before },
    after: { ...params.after },
  };
}
