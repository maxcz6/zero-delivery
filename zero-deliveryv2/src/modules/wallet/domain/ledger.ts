import { assertIntegerCents, assertNonNegativeCents, type Cents } from "@/shared/money";
import { AppError } from "@/shared/errors";

export type WalletEntryType =
  | "GUARANTEE_DEPOSIT"
  | "GUARANTEE_WITHDRAWAL"
  | "CASH_COLLECTED"
  | "CASH_SETTLED"
  | "ADJUSTMENT";

export type WalletLedgerEntry = {
  type: WalletEntryType;
  amountCents: Cents; // Con signo (+ aumenta garantía disponible, - disminuye)
  orderId?: string | null;
  advanceId?: string | null;
  settlementId?: string | null;
  reason?: string | null;
  actorId: string;
};

/**
 * Valida las invariantes del libro mayor de solo-inserción (Sección 10 y SQL wallet_sign_chk).
 */
export function validateWalletEntryInvariant(entry: WalletLedgerEntry): void {
  assertIntegerCents(entry.amountCents, "amountCents");

  switch (entry.type) {
    case "GUARANTEE_DEPOSIT":
    case "CASH_SETTLED":
      if (entry.amountCents <= 0) {
        throw new AppError(
          "VALIDATION_ERROR",
          `El asiento ${entry.type} debe tener un importe positivo (> 0).`,
          422,
        );
      }
      if (entry.type === "CASH_SETTLED" && !entry.settlementId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "El asiento CASH_SETTLED requiere settlementId.",
          422,
        );
      }
      break;

    case "GUARANTEE_WITHDRAWAL":
    case "CASH_COLLECTED":
      if (entry.amountCents >= 0) {
        throw new AppError(
          "VALIDATION_ERROR",
          `El asiento ${entry.type} debe tener un importe negativo (< 0).`,
          422,
        );
      }
      if (entry.type === "CASH_COLLECTED" && !entry.orderId) {
        throw new AppError(
          "VALIDATION_ERROR",
          "El asiento CASH_COLLECTED requiere orderId.",
          422,
        );
      }
      break;

    case "ADJUSTMENT":
      if (entry.amountCents === 0) {
        throw new AppError("VALIDATION_ERROR", "Un ajuste no puede tener importe 0.", 422);
      }
      if (!entry.reason || entry.reason.trim().length < 3) {
        throw new AppError(
          "VALIDATION_ERROR",
          "Todo ajuste manual de garantía exige un motivo obligatorio.",
          422,
        );
      }
      break;
  }
}

/**
 * Calcula el saldo de garantía disponible exclusivamente como la suma del libro mayor.
 * `guarantee_balance(rider) = SUM(wallet_entries.amount_cents)`
 */
export function calculateGuaranteeBalance(entries: Pick<WalletLedgerEntry, "amountCents">[]): {
  balanceCents: Cents;
  hasDebt: boolean;
} {
  const balanceCents = entries.reduce((sum, e) => {
    assertIntegerCents(e.amountCents, "entry.amountCents");
    return sum + e.amountCents;
  }, 0);

  return {
    balanceCents,
    hasDebt: balanceCents < 0,
  };
}

/**
 * Sección 10 (DECISION-03) — Cálculo de liquidación diaria:
 * `net_cents = rider_fee_payable - advances_deducted - (cash_collected - cash_received)`
 * Si `rider_fee_payable_cents !== rider_fee_reference_cents`, exige `rider_fee_override_reason`.
 */
export function calculateSettlementNet(params: {
  cashCollectedCents: Cents;
  cashReceivedCents: Cents;
  advancesDeductedCents: Cents;
  riderFeeReferenceCents: Cents;
  riderFeePayableCents: Cents;
  riderFeeOverrideReason?: string | null;
}): {
  netCents: Cents;
  unremittedCashShortfallCents: Cents;
} {
  assertNonNegativeCents(params.cashCollectedCents, "cashCollectedCents");
  assertNonNegativeCents(params.cashReceivedCents, "cashReceivedCents");
  assertNonNegativeCents(params.advancesDeductedCents, "advancesDeductedCents");
  assertNonNegativeCents(params.riderFeeReferenceCents, "riderFeeReferenceCents");
  assertNonNegativeCents(params.riderFeePayableCents, "riderFeePayableCents");

  if (
    params.riderFeePayableCents !== params.riderFeeReferenceCents &&
    (!params.riderFeeOverrideReason || params.riderFeeOverrideReason.trim().length < 3)
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Modificar el pago de referencia del repartidor exige indicar un motivo obligatorio.",
      422,
    );
  }

  const cashDiff = params.cashCollectedCents - params.cashReceivedCents;
  const netCents = params.riderFeePayableCents - params.advancesDeductedCents - cashDiff;

  return {
    netCents,
    unremittedCashShortfallCents: Math.max(0, cashDiff),
  };
}
