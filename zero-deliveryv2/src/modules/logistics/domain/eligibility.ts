import type { Cents } from "@/shared/money";
import { calculateAgeYears } from "@/shared/time";
import type { PaymentMethod } from "@/modules/orders/domain/release-gate";

export type VehicleType = "MOTO" | "CAR";
export type RiderStatus = "AVAILABLE" | "BUSY" | "ON_THE_WAY" | "OFFLINE";

export type RiderEligibilityCandidate = {
  id: string;
  isActive: boolean;
  status: RiderStatus;
  vehicleType: VehicleType;
  birthDate: string; // YYYY-MM-DD
  highTrust: boolean;
  guaranteeBalanceCents: Cents;
};

export type OrderEligibilityRequirements = {
  paymentMethod: PaymentMethod;
  cashToCollectCents: Cents;
  requiresCarForFragile: boolean;
};

export type RiderEligibilitySettings = {
  allowMultipleOrders: boolean;
  minAgeForCashWithoutGuarantee: number; // default 35 (TODO(DECISION-02))
  minGuaranteeCents: Cents; // default 0 (TODO(DECISION-02))
};

export const DEFAULT_RIDER_ELIGIBILITY_SETTINGS: RiderEligibilitySettings = {
  allowMultipleOrders: false,
  minAgeForCashWithoutGuarantee: 35,
  minGuaranteeCents: 0,
};

export type CashExemptionReason = "AGE_MIN_MET" | "HIGH_TRUST_PROFILE" | null;

export type RiderEligibilityDecision = {
  ok: boolean;
  reasons: string[];
  cashExemptionUsed: CashExemptionReason;
  blockedForCashOnly: boolean;
};

/**
 * Regla 7.5 (CA-06, CA-09) — Elegibilidad del repartidor para un pedido (`canAssignRider`).
 */
export function canAssignRider(
  rider: RiderEligibilityCandidate,
  order: OrderEligibilityRequirements,
  settings: RiderEligibilitySettings = DEFAULT_RIDER_ELIGIBILITY_SETTINGS,
  referenceDate: Date = new Date(),
): RiderEligibilityDecision {
  const reasons: string[] = [];
  let cashExemptionUsed: CashExemptionReason = null;
  let blockedForCashOnly = false;

  if (!rider.isActive) {
    reasons.push("RIDER_INACTIVE");
  }

  const statusAllowed =
    rider.status === "AVAILABLE" || (rider.status === "BUSY" && settings.allowMultipleOrders);
  if (!statusAllowed) {
    reasons.push("RIDER_NOT_AVAILABLE");
  }

  if (order.requiresCarForFragile && rider.vehicleType !== "CAR") {
    reasons.push("VEHICLE_MUST_BE_CAR_FOR_FRAGILE_ORDER");
  }

  // Reglas financieras solo aplican si el pedido es en EFECTIVO (CASH)
  if (order.paymentMethod === "CASH") {
    // Si tiene deuda (guarantee_balance < 0): bloquear siempre
    if (rider.guaranteeBalanceCents < 0) {
      reasons.push(`RIDER_HAS_DEBT:${rider.guaranteeBalanceCents}`);
      blockedForCashOnly = true;
    } else {
      const age = calculateAgeYears(rider.birthDate, referenceDate);
      if (age >= settings.minAgeForCashWithoutGuarantee) {
        cashExemptionUsed = "AGE_MIN_MET";
      } else if (rider.highTrust) {
        cashExemptionUsed = "HIGH_TRUST_PROFILE";
      } else {
        const requiredCents = Math.max(settings.minGuaranteeCents, order.cashToCollectCents);
        if (rider.guaranteeBalanceCents < requiredCents) {
          reasons.push(
            `INSUFFICIENT_GUARANTEE:balance=${rider.guaranteeBalanceCents},required=${requiredCents}`,
          );
          blockedForCashOnly = true;
        }
      }
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
    cashExemptionUsed,
    blockedForCashOnly: blockedForCashOnly && reasons.length === 1,
  };
}
