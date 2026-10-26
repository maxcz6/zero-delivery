import type { Role } from "@/modules/identity/domain/permissions";

export const ORDER_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "RIDER_ASSIGNED",
  "RIDER_AT_PICKUP",
  "ON_THE_WAY",
  "DELIVERED",
  "REJECTED",
  "CANCELLATION_REQUESTED",
  "CANCELLED",
  "DELIVERY_FAILED",
  "RETURN_PENDING",
  "RETURNED_TO_RESTAURANT",
  "PENDING_RESOLUTION",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type GuardId =
  | "BRANCH_OPEN_AND_ITEMS_AVAILABLE"
  | "CAN_ASSIGN_RIDER"
  | "IS_ASSIGNED_RIDER"
  | "EVALUATE_RELEASE_GATE"
  | "CASH_COLLECTION_RECORDED"
  | "SECOND_ATTEMPT_AUTHORIZED"
  | "ATTEMPTS_REACHED_MAX"
  | "PHYSICAL_RETURN_CONFIRMED"
  | "RESOLUTION_PROVIDED";

export type Transition = {
  from: OrderStatus;
  to: OrderStatus;
  roles: (Role | "SYSTEM")[];
  guards: GuardId[];
  requiresReason?: boolean;
  audit: true;
};

const CANCELLABLE_PRE_DISPATCH_STATUSES: OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "RIDER_ASSIGNED",
  "RIDER_AT_PICKUP",
];

/**
 * Tabla declarativa de transiciones de estado del pedido (Sección 8 del Spec).
 * TODO(DECISION-06): Catálogo final propuesto pendiente de firma formal, implementado como dato.
 */
export const ORDER_TRANSITIONS: readonly Transition[] = [
  {
    from: "NEW",
    to: "CONFIRMED",
    roles: ["BRANCH_MANAGER", "COORDINATOR", "ADMIN"],
    guards: ["BRANCH_OPEN_AND_ITEMS_AVAILABLE"],
    audit: true,
  },
  {
    from: "NEW",
    to: "REJECTED",
    roles: ["BRANCH_MANAGER", "COORDINATOR", "ADMIN"],
    guards: [],
    requiresReason: true,
    audit: true,
  },
  {
    from: "CONFIRMED",
    to: "PREPARING",
    roles: ["BRANCH_MANAGER", "ADMIN"],
    guards: [],
    audit: true,
  },
  {
    from: "PREPARING",
    to: "READY",
    roles: ["BRANCH_MANAGER", "ADMIN"],
    guards: [],
    audit: true,
  },
  {
    from: "READY",
    to: "RIDER_ASSIGNED",
    roles: ["COORDINATOR", "SUPPORT_AGENT", "ADMIN"],
    guards: ["CAN_ASSIGN_RIDER"],
    audit: true,
  },
  {
    from: "RIDER_ASSIGNED",
    to: "RIDER_AT_PICKUP",
    roles: ["RIDER", "ADMIN"],
    guards: ["IS_ASSIGNED_RIDER"],
    audit: true,
  },
  {
    from: "RIDER_AT_PICKUP",
    to: "ON_THE_WAY",
    roles: ["RIDER", "ADMIN"],
    guards: ["IS_ASSIGNED_RIDER", "EVALUATE_RELEASE_GATE"],
    audit: true,
  },
  {
    from: "ON_THE_WAY",
    to: "DELIVERED",
    roles: ["RIDER", "ADMIN"],
    guards: ["IS_ASSIGNED_RIDER", "CASH_COLLECTION_RECORDED"],
    audit: true,
  },
  {
    from: "ON_THE_WAY",
    to: "DELIVERY_FAILED",
    roles: ["RIDER", "ADMIN"],
    guards: ["IS_ASSIGNED_RIDER"],
    requiresReason: true,
    audit: true,
  },
  {
    from: "DELIVERY_FAILED",
    to: "RIDER_ASSIGNED",
    roles: ["COORDINATOR", "ADMIN"],
    guards: ["SECOND_ATTEMPT_AUTHORIZED", "CAN_ASSIGN_RIDER"],
    audit: true,
  },
  {
    from: "DELIVERY_FAILED",
    to: "RETURN_PENDING",
    roles: ["RIDER", "COORDINATOR", "ADMIN"],
    guards: [],
    audit: true,
  },
  {
    from: "DELIVERY_FAILED",
    to: "PENDING_RESOLUTION",
    roles: ["SYSTEM", "COORDINATOR", "ADMIN"],
    guards: ["ATTEMPTS_REACHED_MAX"],
    audit: true,
  },
  {
    from: "RETURN_PENDING",
    to: "RETURNED_TO_RESTAURANT",
    roles: ["BRANCH_MANAGER", "COORDINATOR", "ADMIN"],
    guards: ["PHYSICAL_RETURN_CONFIRMED"],
    audit: true,
  },
  {
    from: "RETURNED_TO_RESTAURANT",
    to: "PENDING_RESOLUTION",
    roles: ["COORDINATOR", "ADMIN"],
    guards: [],
    audit: true,
  },
  {
    from: "PENDING_RESOLUTION",
    to: "CANCELLED",
    roles: ["COORDINATOR", "ADMIN"],
    guards: ["RESOLUTION_PROVIDED"],
    requiresReason: true,
    audit: true,
  },
  {
    from: "PENDING_RESOLUTION",
    to: "RIDER_ASSIGNED",
    roles: ["COORDINATOR", "ADMIN"],
    guards: ["SECOND_ATTEMPT_AUTHORIZED", "CAN_ASSIGN_RIDER"],
    audit: true,
  },
  ...CANCELLABLE_PRE_DISPATCH_STATUSES.map(
    (fromStatus): Transition => ({
      from: fromStatus,
      to: "CANCELLATION_REQUESTED",
      roles: ["SUPPORT_AGENT", "COORDINATOR", "ADMIN"],
      guards: [],
      requiresReason: true,
      audit: true,
    }),
  ),
  {
    from: "CANCELLATION_REQUESTED",
    to: "CANCELLED",
    roles: ["COORDINATOR", "ADMIN"],
    guards: [],
    requiresReason: true,
    audit: true,
  },
  ...CANCELLABLE_PRE_DISPATCH_STATUSES.map(
    (prevStatus): Transition => ({
      from: "CANCELLATION_REQUESTED",
      to: prevStatus,
      roles: ["COORDINATOR", "ADMIN"],
      guards: [],
      audit: true,
    }),
  ),
];

export type TransitionEvaluation =
  | {
      ok: true;
      idempotent: boolean;
      transition: Transition | null;
      isAdminOverride: boolean;
    }
  | {
      ok: false;
      errorCode: "INVALID_STATE_TRANSITION" | "FORBIDDEN" | "VALIDATION_ERROR";
      message: string;
    };

/**
 * Valida si una transición de estado (from -> to) es válida para el rol dado.
 * Incluye soporte de idempotencia (from === to) y override administrativo con motivo obligatorio.
 */
export function evaluateStateTransition(params: {
  from: OrderStatus;
  to: OrderStatus;
  actorRole: Role | "SYSTEM";
  reason?: string | null;
  allowAdminEmergencyOverride?: boolean;
}): TransitionEvaluation {
  // Regla 8: Transición repetida (misma de->a) es idempotente
  if (params.from === params.to) {
    return {
      ok: true,
      idempotent: true,
      transition: null,
      isAdminOverride: false,
    };
  }

  const matched = ORDER_TRANSITIONS.find((t) => t.from === params.from && t.to === params.to);

  if (!matched) {
    // Regla 8: Cualquier estado -> cualquiera (corrección de error) solo ADMIN con motivo obligatorio
    if (params.actorRole === "ADMIN" && params.allowAdminEmergencyOverride) {
      if (!params.reason || params.reason.trim().length < 3) {
        return {
          ok: false,
          errorCode: "VALIDATION_ERROR",
          message: "El override administrativo de estado exige un motivo obligatorio.",
        };
      }
      return {
        ok: true,
        idempotent: false,
        transition: {
          from: params.from,
          to: params.to,
          roles: ["ADMIN"],
          guards: [],
          requiresReason: true,
          audit: true,
        },
        isAdminOverride: true,
      };
    }

    return {
      ok: false,
      errorCode: "INVALID_STATE_TRANSITION",
      message: `Transición no permitida de ${params.from} a ${params.to}.`,
    };
  }

  if (!matched.roles.includes(params.actorRole)) {
    return {
      ok: false,
      errorCode: "FORBIDDEN",
      message: `El rol ${params.actorRole} no está autorizado para ejecutar ${params.from} -> ${params.to}.`,
    };
  }

  if (matched.requiresReason && (!params.reason || params.reason.trim().length < 3)) {
    return {
      ok: false,
      errorCode: "VALIDATION_ERROR",
      message: `La transición ${params.from} -> ${params.to} exige indicar un motivo obligatorio.`,
    };
  }

  return {
    ok: true,
    idempotent: false,
    transition: matched,
    isAdminOverride: false,
  };
}
