import { UserRole } from "./enums";

export type PermissionKey =
  // 1. Administración y catálogo
  | "user.manage"
  | "settings.global.manage"
  | "restaurant.manage"
  | "branch.toggle"
  | "branch.schedule.edit"
  | "product.create"
  | "product.availability.edit"
  | "product.price.edit"
  // 2. Pedidos
  | "order.create_manual"
  | "order.view"
  | "order.accept_reject"
  | "order.start_prepare"
  | "order.mark_ready"
  | "order.handoff_to_rider"
  | "order.assign_rider"
  | "order.note.add"
  | "order.cancel.request"
  | "order.cancel.authorize"
  | "order.address_change.manage"
  // 3. Pagos
  | "payment.validate"
  | "payout.restaurant.confirm"
  | "payment.correct"
  | "refund.manage"
  // 4. Logística
  | "rider.manage"
  | "delivery.update_own"
  | "delivery.second_attempt.authorize"
  | "return.confirm_physical"
  | "return.resolve"
  // 5. Finanzas del repartidor
  | "wallet.view_own"
  | "wallet.view_any"
  | "wallet.adjust"
  | "advance.create"
  | "settlement.confirm"
  | "incident.loss.decide"
  // 6. Clientes y reportes
  | "customer.history.view"
  | "customer.risk_flag.set"
  | "report.global_financial"
  | "report.operational"
  | "report.branch_sales"
  | "report.funnel"
  | "audit.view"
  | "audit.delete"
  | "ledger.delete"
  // 7. Exportación
  | "export.global_financial"
  | "export.operational"
  | "export.branch_sales"
  | "export.funnel";

export interface ActorContext {
  tenantId: string;
  userId: string;
  role: UserRole;
  branchIds: string[]; // Alcance de sucursales para Encargados
  riderId?: string;    // ID de repartidor vinculado si el rol es RIDER
  requestId: string;
}

export interface ResourceRef {
  tenantId: string;
  branchId?: string;
  riderId?: string;
}

export interface SettingsContext {
  supportCanAssignRider?: boolean;
  supportCanCreateAdvance?: boolean;
  branchManagerCanViewSales?: boolean;
  coordinatorCanViewFunnel?: boolean;
}

export type PermissionDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Matriz canónica de evaluación de permisos del sistema.
 * Fuente de verdad: docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md y docs/LOGICA_DE_NEGOCIO_Y_PERMISOS.md
 */
export function can(
  actor: ActorContext,
  action: PermissionKey,
  resource?: ResourceRef,
  settings: SettingsContext = {}
): PermissionDecision {
  // Aislamiento Multi-Inquilino Absoluto
  if (resource && resource.tenantId !== actor.tenantId) {
    return { allowed: false, reason: "TENANT_MISMATCH: No autorizado para acceder a otro inquilino" };
  }

  // Reglas inviolables del sistema: NADIE puede borrar auditoría ni libro mayor
  if (action === "audit.delete" || action === "ledger.delete") {
    return { allowed: false, reason: "SYSTEM_FORBIDDEN: Tablas de solo inserción inmutables por diseño" };
  }

  // Alcance por Sucursal para ENCARGADO_SUCURSAL
  if (actor.role === UserRole.BRANCH_MANAGER && resource?.branchId) {
    if (!actor.branchIds.includes(resource.branchId)) {
      return { allowed: false, reason: "OUT_OF_BRANCH_SCOPE: La sucursal no está asignada al usuario" };
    }
  }

  // Alcance por Asignación para REPARTIDOR
  if (actor.role === UserRole.RIDER && resource?.riderId) {
    if (actor.riderId !== resource.riderId) {
      return { allowed: false, reason: "NOT_ASSIGNED_TO_RIDER: El pedido o recurso no está asignado a este repartidor" };
    }
  }

  const { role } = actor;

  switch (action) {
    // 1. Administración y catálogo
    case "user.manage":
    case "settings.global.manage":
    case "restaurant.manage":
      return role === UserRole.ADMIN ? { allowed: true } : { allowed: false, reason: "ADMIN_ONLY" };

    case "branch.toggle":
      if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) {
        return { allowed: true };
      }
      if (
        role === UserRole.BRANCH_MANAGER &&
        resource?.branchId &&
        actor.branchIds.includes(resource.branchId)
      ) {
        return { allowed: true };
      }
      return { allowed: false, reason: "COORDINATOR_OR_ADMIN_ONLY" };

    case "branch.schedule.edit":
    case "product.create":
    case "product.availability.edit":
    case "product.price.edit":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR || role === UserRole.BRANCH_MANAGER
        ? { allowed: true }
        : { allowed: false, reason: "BRANCH_STAFF_OR_ADMIN_ONLY" };

    // 2. Pedidos
    case "order.create_manual":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR || role === UserRole.SUPPORT_AGENT
        ? { allowed: true }
        : { allowed: false, reason: "CANNOT_CREATE_MANUAL_ORDER" };

    case "order.view":
      return { allowed: true }; // Filtrado según alcance

    case "order.accept_reject":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR || role === UserRole.BRANCH_MANAGER
        ? { allowed: true }
        : { allowed: false, reason: "CANNOT_ACCEPT_OR_REJECT_ORDER" };

    case "order.start_prepare":
    case "order.mark_ready":
    case "order.handoff_to_rider":
      return role === UserRole.BRANCH_MANAGER || role === UserRole.ADMIN
        ? { allowed: true }
        : { allowed: false, reason: "KITCHEN_STAFF_ONLY" };

    case "order.assign_rider":
      if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) return { allowed: true };
      if (role === UserRole.SUPPORT_AGENT) {
        return settings.supportCanAssignRider ?? true
          ? { allowed: true }
          : { allowed: false, reason: "DISABLED_BY_SETTING_SUPPORT_ASSIGN" };
      }
      return { allowed: false, reason: "CANNOT_ASSIGN_RIDER" };

    case "order.note.add":
      return { allowed: true };

    case "order.cancel.request":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR || role === UserRole.SUPPORT_AGENT
        ? { allowed: true }
        : { allowed: false, reason: "CANNOT_REQUEST_CANCELLATION" };

    case "order.cancel.authorize":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR
        ? { allowed: true }
        : { allowed: false, reason: "CANNOT_AUTHORIZE_CANCELLATION" };

    case "order.address_change.manage":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR || role === UserRole.SUPPORT_AGENT
        ? { allowed: true }
        : { allowed: false, reason: "CANNOT_MANAGE_ADDRESS_CHANGE" };

    // 3. Pagos
    case "payment.validate":
    case "payout.restaurant.confirm":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR || role === UserRole.SUPPORT_AGENT
        ? { allowed: true }
        : { allowed: false, reason: "CANNOT_VALIDATE_PAYMENT" };

    case "payment.correct":
    case "refund.manage":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR
        ? { allowed: true }
        : { allowed: false, reason: "MANAGEMENT_ONLY" };

    // 4. Logística
    case "rider.manage":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR
        ? { allowed: true }
        : { allowed: false, reason: "MANAGEMENT_ONLY" };

    case "delivery.update_own":
      return role === UserRole.RIDER || role === UserRole.ADMIN
        ? { allowed: true }
        : { allowed: false, reason: "RIDER_ONLY" };

    case "delivery.second_attempt.authorize":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR
        ? { allowed: true }
        : { allowed: false, reason: "MANAGEMENT_ONLY" };

    case "return.confirm_physical":
      return role === UserRole.BRANCH_MANAGER || role === UserRole.ADMIN || role === UserRole.COORDINATOR
        ? { allowed: true }
        : { allowed: false, reason: "CANNOT_CONFIRM_PHYSICAL_RETURN" };

    case "return.resolve":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR
        ? { allowed: true }
        : { allowed: false, reason: "MANAGEMENT_ONLY" };

    // 5. Finanzas del repartidor
    case "wallet.view_own":
      return role === UserRole.RIDER ? { allowed: true } : { allowed: false, reason: "RIDER_ONLY" };

    case "wallet.view_any":
      // Personal interno ve cualquier billetera; el repartidor solo la propia
      // (equivalente a wallet.view_own, validado contra el recurso solicitado).
      if (role === UserRole.RIDER) {
        return resource?.riderId && resource.riderId === actor.riderId
          ? { allowed: true }
          : { allowed: false, reason: "RIDER_OWN_WALLET_ONLY" };
      }
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR || role === UserRole.SUPPORT_AGENT
        ? { allowed: true }
        : { allowed: false, reason: "STAFF_ONLY" };

    case "wallet.adjust":
    case "settlement.confirm":
    case "incident.loss.decide":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR
        ? { allowed: true }
        : { allowed: false, reason: "MANAGEMENT_ONLY" };

    case "advance.create":
      if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) return { allowed: true };
      if (role === UserRole.SUPPORT_AGENT) {
        return settings.supportCanCreateAdvance
          ? { allowed: true }
          : { allowed: false, reason: "DISABLED_BY_SETTING_SUPPORT_ADVANCE" };
      }
      return { allowed: false, reason: "CANNOT_CREATE_ADVANCE" };

    // 6. Clientes y reportes
    case "customer.history.view":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR || role === UserRole.SUPPORT_AGENT
        ? { allowed: true }
        : { allowed: false, reason: "STAFF_ONLY" };

    case "customer.risk_flag.set":
      return role === UserRole.ADMIN || role === UserRole.COORDINATOR
        ? { allowed: true }
        : { allowed: false, reason: "MANAGEMENT_ONLY" };

    case "report.global_financial":
    case "audit.view":
      return role === UserRole.ADMIN ? { allowed: true } : { allowed: false, reason: "ADMIN_ONLY" };

    case "report.operational":
      return role !== UserRole.SUPPORT_AGENT ? { allowed: true } : { allowed: false, reason: "NOT_AUTHORIZED" };

    case "report.branch_sales":
      if (role === UserRole.ADMIN || role === UserRole.COORDINATOR) return { allowed: true };
      if (role === UserRole.BRANCH_MANAGER) {
        return settings.branchManagerCanViewSales
          ? { allowed: true }
          : { allowed: false, reason: "DISABLED_BY_SETTING_BRANCH_SALES" };
      }
      return { allowed: false, reason: "NOT_AUTHORIZED" };

    case "report.funnel":
      if (role === UserRole.ADMIN) return { allowed: true };
      if (role === UserRole.COORDINATOR) {
        return settings.coordinatorCanViewFunnel
          ? { allowed: true }
          : { allowed: false, reason: "DISABLED_BY_SETTING_COORDINATOR_FUNNEL" };
      }
      return { allowed: false, reason: "NOT_AUTHORIZED" };

    // 7. Exportación
    case "export.global_financial":
      return can(actor, "report.global_financial", resource, settings);
    case "export.operational":
      return can(actor, "report.operational", resource, settings);
    case "export.branch_sales":
      return can(actor, "report.branch_sales", resource, settings);
    case "export.funnel":
      return can(actor, "report.funnel", resource, settings);

    default:
      return { allowed: false, reason: "UNKNOWN_PERMISSION" };
  }
}
