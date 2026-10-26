import { AppError } from "@/shared/errors";

export const ROLES = [
  "ADMIN",
  "COORDINATOR",
  "BRANCH_MANAGER",
  "SUPPORT_AGENT",
  "RIDER",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSION_KEYS = [
  "user.manage",
  "settings.global.manage",
  "restaurant.manage",
  "branch.toggle",
  "branch.schedule.edit",
  "product.create",
  "product.availability.edit",
  "product.price.edit",
  "order.create_manual",
  "order.view",
  "order.accept_reject",
  "order.start_prepare",
  "order.mark_ready",
  "order.handoff_to_rider",
  "order.assign_rider",
  "order.note.add",
  "order.cancel.request",
  "order.cancel.authorize",
  "order.address_change.manage",
  "payment.validate",
  "payout.restaurant.confirm",
  "payment.correct",
  "refund.manage",
  "rider.manage",
  "delivery.update_own",
  "delivery.second_attempt.authorize",
  "return.confirm_physical",
  "return.resolve",
  "wallet.view_own",
  "wallet.view_any",
  "wallet.adjust",
  "advance.create",
  "settlement.confirm",
  "incident.loss.decide",
  "customer.history.view",
  "customer.risk_flag.set",
  "report.global_financial",
  "report.operational",
  "report.branch_sales",
  "report.funnel",
  "audit.view",
  "audit.delete",
  "ledger.delete",
  "export.global_financial",
  "export.operational",
  "export.branch_sales",
  "export.funnel",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type ActorContext = {
  tenantId: string;
  userId: string;
  role: Role;
  branchIds: string[];
  riderId?: string;
  requestId: string;
};

export type ResourceRef = {
  tenantId?: string;
  branchId?: string;
  assignedRiderId?: string;
};

export type PermissionSettings = {
  "support.can_assign_rider": boolean;
  "support.can_create_advance": boolean;
  "reports.branch_manager_can_view_sales": boolean;
  "reports.coordinator_can_view_funnel": boolean;
};

export const DEFAULT_PERMISSION_SETTINGS: PermissionSettings = {
  "support.can_assign_rider": true,
  "support.can_create_advance": false, // PLACEHOLDER (DECISION)
  "reports.branch_manager_can_view_sales": false, // PENDIENTE (DECISION-04)
  "reports.coordinator_can_view_funnel": false, // PENDIENTE (DECISION-04)
};

export type Decision = {
  allowed: boolean;
  reason?: string;
};

function hasBranchAccess(actor: ActorContext, resource?: ResourceRef): boolean {
  if (!resource?.branchId) {
    return actor.branchIds.length > 0;
  }
  return actor.branchIds.includes(resource.branchId);
}

function isOwnRiderAssignment(actor: ActorContext, resource?: ResourceRef): boolean {
  if (!resource?.assignedRiderId) {
    return Boolean(actor.riderId);
  }
  return Boolean(actor.riderId && actor.riderId === resource.assignedRiderId);
}

/**
 * Única fuente de verdad de autorización (RBAC + alcance de sucursal/asignación + settings).
 * Implementa la Matriz de la Sección 6 de ZERO_DELIVERY_MVP_BUILD_SPEC.md.
 */
export function can(
  actor: ActorContext,
  action: PermissionKey,
  resource?: ResourceRef,
  settings: PermissionSettings = DEFAULT_PERMISSION_SETTINGS,
): Decision {
  // 0. Aislamiento estricto por tenant
  if (resource?.tenantId && resource.tenantId !== actor.tenantId) {
    return { allowed: false, reason: "TENANT_MISMATCH" };
  }

  // 1. Prohibiciones absolutas (nadie puede borrar auditoría ni ledger)
  if (action === "audit.delete" || action === "ledger.delete") {
    return { allowed: false, reason: "IMMUTABLE_RESOURCE_NOBODY_ALLOWED" };
  }

  // 2. Permisos de exportación: exactamente iguales al permiso de lectura del reporte (CA-14)
  if (action === "export.global_financial") {
    return can(actor, "report.global_financial", resource, settings);
  }
  if (action === "export.operational") {
    return can(actor, "report.operational", resource, settings);
  }
  if (action === "export.branch_sales") {
    return can(actor, "report.branch_sales", resource, settings);
  }
  if (action === "export.funnel") {
    return can(actor, "report.funnel", resource, settings);
  }

  const { role } = actor;

  switch (action) {
    case "user.manage":
    case "settings.global.manage":
    case "restaurant.manage":
    case "report.global_financial":
    case "audit.view":
      return role === "ADMIN"
        ? { allowed: true }
        : { allowed: false, reason: "ADMIN_ONLY" };

    case "branch.toggle":
    case "order.cancel.authorize":
    case "payment.correct":
    case "refund.manage":
    case "rider.manage":
    case "delivery.second_attempt.authorize":
    case "return.resolve":
    case "wallet.adjust":
    case "settlement.confirm":
    case "incident.loss.decide":
    case "customer.risk_flag.set":
      return role === "ADMIN" || role === "COORDINATOR"
        ? { allowed: true }
        : { allowed: false, reason: "ADMIN_OR_COORDINATOR_ONLY" };

    case "branch.schedule.edit":
    case "product.create":
    case "product.availability.edit":
    case "product.price.edit":
    case "order.accept_reject":
    case "return.confirm_physical":
      if (role === "ADMIN" || role === "COORDINATOR") {
        return { allowed: true };
      }
      if (role === "BRANCH_MANAGER") {
        return hasBranchAccess(actor, resource)
          ? { allowed: true }
          : { allowed: false, reason: "OUT_OF_BRANCH_SCOPE" };
      }
      return { allowed: false, reason: "ROLE_NOT_AUTHORIZED" };

    case "order.start_prepare":
    case "order.mark_ready":
    case "order.handoff_to_rider":
      if (role === "ADMIN") {
        return { allowed: true };
      }
      if (role === "BRANCH_MANAGER") {
        return hasBranchAccess(actor, resource)
          ? { allowed: true }
          : { allowed: false, reason: "OUT_OF_BRANCH_SCOPE" };
      }
      return { allowed: false, reason: "BRANCH_MANAGER_OR_ADMIN_ONLY" };

    case "order.create_manual":
    case "order.cancel.request":
    case "order.address_change.manage":
    case "payment.validate":
    case "payout.restaurant.confirm":
    case "wallet.view_any":
    case "customer.history.view":
      return role === "ADMIN" || role === "COORDINATOR" || role === "SUPPORT_AGENT"
        ? { allowed: true }
        : { allowed: false, reason: "STAFF_ONLY" };

    case "order.assign_rider":
      if (role === "ADMIN" || role === "COORDINATOR") {
        return { allowed: true };
      }
      if (role === "SUPPORT_AGENT") {
        return settings["support.can_assign_rider"]
          ? { allowed: true }
          : { allowed: false, reason: "DISABLED_BY_SETTING_SUPPORT_CAN_ASSIGN_RIDER" };
      }
      return { allowed: false, reason: "ROLE_NOT_AUTHORIZED" };

    case "advance.create":
      if (role === "ADMIN" || role === "COORDINATOR") {
        return { allowed: true };
      }
      if (role === "SUPPORT_AGENT") {
        return settings["support.can_create_advance"]
          ? { allowed: true }
          : { allowed: false, reason: "DISABLED_BY_SETTING_SUPPORT_CAN_CREATE_ADVANCE" };
      }
      return { allowed: false, reason: "ROLE_NOT_AUTHORIZED" };

    case "order.view":
      if (role === "ADMIN" || role === "COORDINATOR" || role === "SUPPORT_AGENT") {
        return { allowed: true };
      }
      if (role === "BRANCH_MANAGER") {
        return hasBranchAccess(actor, resource)
          ? { allowed: true }
          : { allowed: false, reason: "OUT_OF_BRANCH_SCOPE" };
      }
      if (role === "RIDER") {
        return isOwnRiderAssignment(actor, resource)
          ? { allowed: true }
          : { allowed: false, reason: "NOT_ASSIGNED_TO_RIDER" };
      }
      return { allowed: false, reason: "ROLE_NOT_AUTHORIZED" };

    case "order.note.add":
      return { allowed: true };

    case "delivery.update_own":
      if (role === "ADMIN") {
        return { allowed: true };
      }
      if (role === "RIDER") {
        return isOwnRiderAssignment(actor, resource)
          ? { allowed: true }
          : { allowed: false, reason: "NOT_ASSIGNED_TO_RIDER" };
      }
      return { allowed: false, reason: "RIDER_OR_ADMIN_ONLY" };

    case "wallet.view_own":
      return role === "RIDER"
        ? { allowed: true }
        : { allowed: false, reason: "RIDER_ONLY" };

    case "report.operational":
      if (role === "ADMIN" || role === "COORDINATOR" || role === "RIDER") {
        return { allowed: true };
      }
      if (role === "BRANCH_MANAGER") {
        return hasBranchAccess(actor, resource)
          ? { allowed: true }
          : { allowed: false, reason: "OUT_OF_BRANCH_SCOPE" };
      }
      return { allowed: false, reason: "ROLE_NOT_AUTHORIZED" };

    case "report.branch_sales":
      if (role === "ADMIN" || role === "COORDINATOR") {
        return { allowed: true };
      }
      if (role === "BRANCH_MANAGER") {
        if (!settings["reports.branch_manager_can_view_sales"]) {
          return { allowed: false, reason: "DISABLED_BY_SETTING_BRANCH_SALES" };
        }
        return hasBranchAccess(actor, resource)
          ? { allowed: true }
          : { allowed: false, reason: "OUT_OF_BRANCH_SCOPE" };
      }
      return { allowed: false, reason: "ROLE_NOT_AUTHORIZED" };

    case "report.funnel":
      if (role === "ADMIN") {
        return { allowed: true };
      }
      if (role === "COORDINATOR") {
        return settings["reports.coordinator_can_view_funnel"]
          ? { allowed: true }
          : { allowed: false, reason: "DISABLED_BY_SETTING_COORDINATOR_FUNNEL" };
      }
      return { allowed: false, reason: "ROLE_NOT_AUTHORIZED" };
  }
}

export function assertCan(
  actor: ActorContext,
  action: PermissionKey,
  resource?: ResourceRef,
  settings?: PermissionSettings,
): void {
  const decision = can(actor, action, resource, settings);
  if (!decision.allowed) {
    throw new AppError("FORBIDDEN", "No tienes permisos para realizar esta acción.", 403, {
      action,
      role: actor.role,
      reason: decision.reason,
    });
  }
}
