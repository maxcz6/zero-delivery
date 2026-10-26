import { describe, expect, it } from "vitest";
import {
  canAssignRider,
  evaluateSecondAttemptAuthorization,
  type RiderEligibilityCandidate,
} from "@/modules/logistics";
import {
  calculateGuaranteeBalance,
  calculateSettlementNet,
  validateWalletEntryInvariant,
} from "@/modules/wallet";

function makeRider(overrides?: Partial<RiderEligibilityCandidate>): RiderEligibilityCandidate {
  return {
    id: "rider-1",
    isActive: true,
    status: "AVAILABLE",
    vehicleType: "MOTO",
    birthDate: "2000-05-10", // 26 años en 2026 (< 35)
    highTrust: false,
    guaranteeBalanceCents: 10000, // S/ 100.00
    ...overrides,
  };
}

describe("Elegibilidad de Repartidor (`canAssignRider`) (CA-06, CA-09)", () => {
  const refDate = new Date("2026-10-26T12:00:00Z");

  it("bloquea pedido en efectivo si el repartidor menor de 35 años no tiene garantía suficiente", () => {
    const rider = makeRider({ guaranteeBalanceCents: 3000 }); // S/ 30.00
    const res = canAssignRider(
      rider,
      {
        paymentMethod: "CASH",
        cashToCollectCents: 5000, // S/ 50.00
        requiresCarForFragile: false,
      },
      undefined,
      refDate,
    );
    expect(res.ok).toBe(false);
    expect(res.blockedForCashOnly).toBe(true);
    expect(res.reasons[0]).toContain("INSUFFICIENT_GUARANTEE");
  });

  it("permite al mismo repartidor sin garantía llevar un pedido YA PAGADO (YAPE)", () => {
    const rider = makeRider({ guaranteeBalanceCents: 0 });
    const res = canAssignRider(
      rider,
      {
        paymentMethod: "YAPE",
        cashToCollectCents: 0,
        requiresCarForFragile: false,
      },
      undefined,
      refDate,
    );
    expect(res.ok).toBe(true);
  });

  it("exime de garantía en efectivo a repartidores de 35 años o más o con highTrust = true", () => {
    const seniorRider = makeRider({
      birthDate: "1985-01-15", // 41 años
      guaranteeBalanceCents: 0,
    });
    const resSenior = canAssignRider(
      seniorRider,
      { paymentMethod: "CASH", cashToCollectCents: 8000, requiresCarForFragile: false },
      undefined,
      refDate,
    );
    expect(resSenior.ok).toBe(true);
    expect(resSenior.cashExemptionUsed).toBe("AGE_MIN_MET");

    const trustedRider = makeRider({
      highTrust: true,
      guaranteeBalanceCents: 0,
    });
    const resTrusted = canAssignRider(
      trustedRider,
      { paymentMethod: "CASH", cashToCollectCents: 8000, requiresCarForFragile: false },
      undefined,
      refDate,
    );
    expect(resTrusted.ok).toBe(true);
    expect(resTrusted.cashExemptionUsed).toBe("HIGH_TRUST_PROFILE");
  });

  it("bloquea siempre pedidos en efectivo si el repartidor tiene deuda (guarantee_balance < 0), incluso si tiene >= 35 años", () => {
    const indebtedSenior = makeRider({
      birthDate: "1980-01-01",
      guaranteeBalanceCents: -1500, // Debe S/ 15.00
    });
    const res = canAssignRider(
      indebtedSenior,
      { paymentMethod: "CASH", cashToCollectCents: 2000, requiresCarForFragile: false },
      undefined,
      refDate,
    );
    expect(res.ok).toBe(false);
    expect(res.reasons[0]).toContain("RIDER_HAS_DEBT");
  });

  it("exige vehículo CAR cuando el pedido contiene un producto frágil que requiere carro", () => {
    const motoRider = makeRider({ vehicleType: "MOTO" });
    const res = canAssignRider(
      motoRider,
      { paymentMethod: "YAPE", cashToCollectCents: 0, requiresCarForFragile: true },
      undefined,
      refDate,
    );
    expect(res.ok).toBe(false);
    expect(res.reasons).toContain("VEHICLE_MUST_BE_CAR_FOR_FRAGILE_ORDER");
  });
});

describe("Intentos de Entrega y Libro Mayor de Billetera (`wallet`) (CA-07, CA-10)", () => {
  it("exige autorización del Coordinador para el 2.º intento e impide un 3.er intento", () => {
    expect(
      evaluateSecondAttemptAuthorization({
        currentAttemptsCount: 1,
        authorizedByCoordinatorId: null,
      }).canRetry,
    ).toBe(false);

    expect(
      evaluateSecondAttemptAuthorization({
        currentAttemptsCount: 1,
        authorizedByCoordinatorId: "coord-1",
      }).canRetry,
    ).toBe(true);

    const afterSecond = evaluateSecondAttemptAuthorization({
      currentAttemptsCount: 2,
      authorizedByCoordinatorId: "coord-1",
    });
    expect(afterSecond.canRetry).toBe(false);
    expect(afterSecond.mustMoveToPendingResolution).toBe(true);
  });

  it("calcula el saldo de garantía exactamente desde los asientos del ledger y detecta deuda", () => {
    const entries = [
      { amountCents: 10000 }, // Depósito inicial S/ 100.00
      { amountCents: -6000 }, // Cobro efectivo pedido 1 (-S/ 60.00)
      { amountCents: -5500 }, // Cobro efectivo pedido 2 (-S/ 55.00)
    ];
    const balance = calculateGuaranteeBalance(entries);
    expect(balance.balanceCents).toBe(-1500);
    expect(balance.hasDebt).toBe(true);
  });

  it("valida signos e invariantes de asientos en wallet_entries y liquidación diaria", () => {
    expect(() =>
      validateWalletEntryInvariant({
        type: "CASH_COLLECTED",
        amountCents: 4500, // Inválido: debe ser negativo
        orderId: "ord-1",
        actorId: "rider-1",
      }),
    ).toThrow();

    const settlement = calculateSettlementNet({
      cashCollectedCents: 12000,
      cashReceivedCents: 10000, // Entregó S/ 20 menos
      advancesDeductedCents: 1500, // Adelanto gasolina S/ 15
      riderFeeReferenceCents: 4000,
      riderFeePayableCents: 4000,
    });
    // net = 4000 - 1500 - (12000 - 10000) = 500 (S/ 5.00)
    expect(settlement.netCents).toBe(500);
    expect(settlement.unremittedCashShortfallCents).toBe(2000);
  });
});
