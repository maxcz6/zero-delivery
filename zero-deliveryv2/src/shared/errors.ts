export type ErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "BRANCH_CLOSED"
  | "MIN_ORDER_NOT_MET"
  | "CUSTOMER_BLOCKED"
  | "PRODUCT_HAS_HISTORY_ARCHIVED"
  | "INVALID_STATE_TRANSITION"
  | "VERSION_CONFLICT"
  | "RESTAURANT_PAYOUT_NOT_CONFIRMED"
  | "RELEASE_GATE_FAILED"
  | "RIDER_NOT_ELIGIBLE"
  | "MAX_DELIVERY_ATTEMPTS_REACHED"
  | "IMMUTABLE_LEDGER_VIOLATION"
  | "VOCERO_CRM_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
