import { describe, expect, it } from "vitest";
import {
  can,
  DEFAULT_PERMISSION_SETTINGS,
  PERMISSION_KEYS,
  ROLES,
  type ActorContext,
  type PermissionKey,
  type Role,
} from "@/modules/identity";

function makeActor(role: Role, overrides?: Partial<ActorContext>): ActorContext {
  return {
    tenantId: "tenant-1",
    userId: `user-${role.toLowerCase()}`,
    role,
    branchIds: role === "BRANCH_MANAGER" ? ["branch-own"] : [],
    riderId: role === "RIDER" ? "rider-own" : undefined,
    requestId: "req-test",
    ...overrides,
  };
}

/**
 * Matriz esperada en alcance propio (branchId = 'branch-own', assignedRiderId = 'rider-own')
 * con la configuración por defecto (support.can_assign_rider = true, otros flags = false).
 * Espeja la tabla de la Sección 6 de ZERO_DELIVERY_MVP_BUILD_SPEC.md.
 */
const EXPECTED_DEFAULT_MATRIX: Record<PermissionKey, Record<Role, boolean>> = {
  "user.manage": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "settings.global.manage": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "restaurant.manage": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "branch.toggle": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "branch.schedule.edit": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: false },
  "product.create": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: false },
  "product.availability.edit": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: false },
  "product.price.edit": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: false },
  "order.create_manual": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: true, RIDER: false },
  "order.view": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: true, SUPPORT_AGENT: true, RIDER: true },
  "order.accept_reject": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: false },
  "order.start_prepare": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: false },
  "order.mark_ready": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: false },
  "order.handoff_to_rider": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: false },
  "order.assign_rider": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: true, RIDER: false },
  "order.note.add": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: true, SUPPORT_AGENT: true, RIDER: true },
  "order.cancel.request": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: true, RIDER: false },
  "order.cancel.authorize": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "order.address_change.manage": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: true, RIDER: false },
  "payment.validate": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: true, RIDER: false },
  "payout.restaurant.confirm": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: true, RIDER: false },
  "payment.correct": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "refund.manage": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "rider.manage": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "delivery.update_own": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: true },
  "delivery.second_attempt.authorize": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "return.confirm_physical": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: false },
  "return.resolve": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "wallet.view_own": { ADMIN: false, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: true },
  "wallet.view_any": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: true, RIDER: false },
  "wallet.adjust": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "advance.create": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "settlement.confirm": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "incident.loss.decide": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "customer.history.view": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: true, RIDER: false },
  "customer.risk_flag.set": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "report.global_financial": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "report.operational": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: true },
  "report.branch_sales": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "report.funnel": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "audit.view": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "audit.delete": { ADMIN: false, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "ledger.delete": { ADMIN: false, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "export.global_financial": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "export.operational": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: true, SUPPORT_AGENT: false, RIDER: true },
  "export.branch_sales": { ADMIN: true, COORDINATOR: true, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
  "export.funnel": { ADMIN: true, COORDINATOR: false, BRANCH_MANAGER: false, SUPPORT_AGENT: false, RIDER: false },
};

describe("RBAC Matrix — can(actor, action, resource, settings) (CA-01 & CA-14)", () => {
  for (const action of PERMISSION_KEYS) {
    for (const role of ROLES) {
      it(`verifica ${role} × ${action} en alcance propio`, () => {
        const actor = makeActor(role);
        const resource = {
          tenantId: "tenant-1",
          branchId: "branch-own",
          assignedRiderId: "rider-own",
        };
        const decision = can(actor, action, resource, DEFAULT_PERMISSION_SETTINGS);
        expect(decision.allowed).toBe(EXPECTED_DEFAULT_MATRIX[action][role]);
      });
    }
  }

  it("deniega siempre acceso cruzado entre distintos tenants (aislamiento multi-tenant)", () => {
    const admin = makeActor("ADMIN", { tenantId: "tenant-a" });
    const decision = can(admin, "order.view", { tenantId: "tenant-b" });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("TENANT_MISMATCH");
  });

  it("deniega a BRANCH_MANAGER operar sobre una sucursal ajena a su alcance", () => {
    const manager = makeActor("BRANCH_MANAGER", { branchIds: ["branch-miraflores"] });
    const decision = can(manager, "order.accept_reject", {
      tenantId: "tenant-1",
      branchId: "branch-san-isidro",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("OUT_OF_BRANCH_SCOPE");
  });

  it("deniega a RIDER ver o actualizar pedidos asignados a otro repartidor", () => {
    const rider = makeActor("RIDER", { riderId: "rider-1" });
    expect(
      can(rider, "order.view", { tenantId: "tenant-1", assignedRiderId: "rider-2" }).allowed,
    ).toBe(false);
    expect(
      can(rider, "delivery.update_own", { tenantId: "tenant-1", assignedRiderId: "rider-2" })
        .allowed,
    ).toBe(false);
  });

  it("respeta los parámetros configurables (support.can_create_advance, reports.branch_manager_can_view_sales, reports.coordinator_can_view_funnel)", () => {
    const support = makeActor("SUPPORT_AGENT");
    const manager = makeActor("BRANCH_MANAGER");
    const coordinator = makeActor("COORDINATOR");

    const customSettings = {
      ...DEFAULT_PERMISSION_SETTINGS,
      "support.can_assign_rider": false,
      "support.can_create_advance": true,
      "reports.branch_manager_can_view_sales": true,
      "reports.coordinator_can_view_funnel": true,
    };

    expect(can(support, "order.assign_rider", undefined, customSettings).allowed).toBe(false);
    expect(can(support, "advance.create", undefined, customSettings).allowed).toBe(true);
    expect(
      can(manager, "report.branch_sales", { branchId: "branch-own" }, customSettings).allowed,
    ).toBe(true);
    expect(
      can(manager, "export.branch_sales", { branchId: "branch-own" }, customSettings).allowed,
    ).toBe(true);
    expect(can(coordinator, "report.funnel", undefined, customSettings).allowed).toBe(true);
  });
});
