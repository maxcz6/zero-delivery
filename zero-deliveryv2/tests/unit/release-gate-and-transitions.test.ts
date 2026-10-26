import { describe, expect, it } from "vitest";
import {
  canRegisterHandoff,
  evaluateReleaseGate,
  evaluateStateTransition,
  type ReleaseGateInput,
} from "@/modules/orders";

function makeValidReleaseInput(): ReleaseGateInput {
  const now = new Date();
  return {
    order: {
      id: "ord-1",
      paymentMethod: "YAPE",
      paymentStatus: "PAID",
      restaurantPayoutStatus: "CONFIRMED",
      riderId: "rider-1",
      handoffAt: now,
      cashToCollectCents: 0,
    },
    payment: {
      status: "PAID",
      validatedBy: "user-coord",
      validatedAt: now,
    },
    payout: {
      status: "CONFIRMED",
      confirmedBy: "user-coord",
      confirmedAt: now,
    },
    rider: {
      id: "rider-1",
      isEligible: true,
    },
    handoff: {
      handoffAt: now,
      handoffBy: "user-manager",
    },
  };
}

describe("Regla de Liberación (`evaluateReleaseGate`) y Handoff (CA-02, CA-03, CA-04)", () => {
  it("aprueba la salida a ON_THE_WAY cuando se cumplen las 4 condiciones", () => {
    const res = evaluateReleaseGate(makeValidReleaseInput());
    expect(res.ok).toBe(true);
    expect(res.failures).toEqual([]);
  });

  it("bloquea el despacho si el pago Yape aún está PENDING o no tiene validador humano (CA-03)", () => {
    const input = makeValidReleaseInput();
    input.order.paymentStatus = "PENDING";
    input.payment = { status: "PENDING", validatedBy: null, validatedAt: null };

    const res = evaluateReleaseGate(input);
    expect(res.ok).toBe(false);
    expect(res.failures).toContain("PREPAID_PAYMENT_NOT_VALIDATED");
  });

  it("permite pago PENDING en pedidos en EFECTIVO (CASH) siempre que el pago al restaurante y handoff estén confirmados", () => {
    const input = makeValidReleaseInput();
    input.order.paymentMethod = "CASH";
    input.order.paymentStatus = "PENDING";
    input.order.cashToCollectCents = 4500;
    input.payment = { status: "PENDING", validatedBy: null, validatedAt: null };

    const res = evaluateReleaseGate(input);
    expect(res.ok).toBe(true);
  });

  it("impide registrar el handoff físico si el pago al restaurante no está CONFIRMED", () => {
    expect(canRegisterHandoff("PENDING")).toEqual({
      ok: false,
      reason: "RESTAURANT_PAYOUT_NOT_CONFIRMED",
    });
    expect(canRegisterHandoff("CONFIRMED")).toEqual({ ok: true });
  });

  it("acumula todos los fallos si faltan repartidor, pago al restaurante y handoff (CA-04)", () => {
    const input = makeValidReleaseInput();
    input.order.riderId = null;
    input.rider = null;
    input.order.restaurantPayoutStatus = "PENDING";
    input.order.handoffAt = null;

    const res = evaluateReleaseGate(input);
    expect(res.ok).toBe(false);
    expect(res.failures).toEqual(
      expect.arrayContaining([
        "RIDER_NOT_ASSIGNED",
        "RESTAURANT_PAYOUT_NOT_CONFIRMED",
        "HANDOFF_NOT_REGISTERED",
      ]),
    );
  });
});

describe("Máquina de Estados del Pedido (`evaluateStateTransition`)", () => {
  it("es idempotente cuando from === to", () => {
    const res = evaluateStateTransition({
      from: "PREPARING",
      to: "PREPARING",
      actorRole: "BRANCH_MANAGER",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.idempotent).toBe(true);
    }
  });

  it("exige motivo obligatorio al rechazar un pedido (NEW -> REJECTED)", () => {
    const withoutReason = evaluateStateTransition({
      from: "NEW",
      to: "REJECTED",
      actorRole: "BRANCH_MANAGER",
    });
    expect(withoutReason.ok).toBe(false);

    const withReason = evaluateStateTransition({
      from: "NEW",
      to: "REJECTED",
      actorRole: "BRANCH_MANAGER",
      reason: "Horno en mantenimiento",
    });
    expect(withReason.ok).toBe(true);
  });

  it("impide a SUPPORT_AGENT autorizar una cancelación (solo puede solicitarla)", () => {
    const requestRes = evaluateStateTransition({
      from: "PREPARING",
      to: "CANCELLATION_REQUESTED",
      actorRole: "SUPPORT_AGENT",
      reason: "Cliente llamó para cancelar",
    });
    expect(requestRes.ok).toBe(true);

    const authorizeRes = evaluateStateTransition({
      from: "CANCELLATION_REQUESTED",
      to: "CANCELLED",
      actorRole: "SUPPORT_AGENT",
      reason: "Intento sin permiso",
    });
    expect(authorizeRes.ok).toBe(false);
    if (!authorizeRes.ok) {
      expect(authorizeRes.errorCode).toBe("FORBIDDEN");
    }
  });
});
