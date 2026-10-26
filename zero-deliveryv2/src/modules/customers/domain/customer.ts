import { AppError } from "@/shared/errors";

export type CustomerSegment = "NEW" | "RECURRING" | "TOP";
export type CustomerRiskFlag = "NONE" | "CAUTION" | "BLOCKED";

/**
 * Calcula el segmento del cliente según cantidad de pedidos entregados y umbral configurable.
 * TODO(DECISION): customer.top_min_orders (default 10, PLACEHOLDER).
 */
export function computeCustomerSegment(
  deliveredOrdersCount: number,
  topMinOrders = 10,
): CustomerSegment {
  if (deliveredOrdersCount >= topMinOrders) {
    return "TOP";
  }
  if (deliveredOrdersCount >= 2) {
    return "RECURRING";
  }
  return "NEW";
}

/**
 * Valida la asignación manual del indicador de seguridad (risk_flag).
 * Regla 7.9: prohibida la recopilación externa ("doxeo"); solo indicador manual con motivo y autor.
 */
export function validateRiskFlagUpdate(params: {
  riskFlag: CustomerRiskFlag;
  reason?: string | null;
  actorId: string;
}): {
  riskFlag: CustomerRiskFlag;
  riskReason: string | null;
  riskSetBy: string | null;
  riskSetAt: Date | null;
} {
  if (params.riskFlag === "NONE") {
    return {
      riskFlag: "NONE",
      riskReason: null,
      riskSetBy: null,
      riskSetAt: null,
    };
  }
  const cleanReason = params.reason?.trim() ?? "";
  if (cleanReason.length < 3) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Debes indicar un motivo obligatorio para marcar una alerta de seguridad en el cliente.",
      422,
    );
  }
  return {
    riskFlag: params.riskFlag,
    riskReason: cleanReason,
    riskSetBy: params.actorId,
    riskSetAt: new Date(),
  };
}
