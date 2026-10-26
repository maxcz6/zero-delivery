export type AlertType =
  | "NEW_ORDER"
  | "ACCEPTANCE_TIMEOUT"
  | "PREP_DELAY"
  | "NO_RIDER"
  | "PICKUP_WAIT_EXCEEDED"
  | "DELIVERY_FAILED"
  | "INTEGRATION_DEAD_LETTER";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export function buildAlertDedupeKey(params: {
  type: AlertType;
  orderId?: string;
  riderId?: string;
  branchId?: string;
  extra?: string;
}): string {
  return [
    params.type,
    params.orderId ?? "-",
    params.riderId ?? "-",
    params.branchId ?? "-",
    params.extra ?? "-",
  ].join(":");
}
