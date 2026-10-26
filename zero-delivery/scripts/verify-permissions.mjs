#!/usr/bin/env node
/**
 * Suite table-driven Rol × Permiso (Hito 2, Fase 2.1).
 *
 * Recorre exhaustivamente las 47 claves de `PermissionKey` contra los 5 roles y
 * valida invariantes de negocio que NO deben romperse nunca. No depende de un
 * framework de test: falla con código de salida 1 y sirve en CI.
 *
 * Uso: node scripts/verify-permissions.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const permisosSrc = join(repoRoot, "packages/shared-types/src/domain/permissions.ts");
const dist = join(repoRoot, "packages/shared-types/dist/index.js");

const { can, UserRole } = await import(`file://${dist.replaceAll("\\", "/")}`);

// 1. Extraer las claves reales del tipo (evita duplicar la lista a mano).
const fuente = readFileSync(permisosSrc, "utf8");
const bloque = fuente.slice(
  fuente.indexOf("export type PermissionKey"),
  fuente.indexOf("export interface ActorContext")
);
const claves = [...bloque.matchAll(/\|\s*"([a-z_.]+)"/g)].map((m) => m[1]);

const fallos = [];
const check = (ok, mensaje) => {
  if (!ok) fallos.push(mensaje);
};

check(claves.length === 47, `PermissionKey debe tener 47 claves, tiene ${claves.length}`);

const roles = Object.values(UserRole);
check(roles.length === 5, `Se esperaban 5 roles, hay ${roles.length}`);

const actor = (role, extra = {}) => ({
  tenantId: "tenant-a",
  userId: "user-1",
  role,
  branchIds: ["branch-1"],
  riderId: "rider-1",
  requestId: "req-1",
  ...extra,
});

// 2. Matriz completa Rol × Permiso (sin restricciones de recurso).
const matriz = {};
for (const role of roles) {
  matriz[role] = {};
  for (const clave of claves) {
    const d = can(actor(role), clave);
    check(
      typeof d === "object" && d !== null && typeof d.allowed === "boolean",
      `Decisión inválida para ${role}/${clave}`
    );
    matriz[role][clave] = d.allowed;
  }
}

// 3. Reglas inviolables: tablas de solo inserción.
for (const role of roles) {
  for (const clave of ["audit.delete", "ledger.delete"]) {
    check(matriz[role][clave] === false, `${role} no debe poder "${clave}"`);
  }
}

// 4. ADMIN tiene el catálogo completo salvo lo prohibido por diseño y los
//    permisos que son exclusivos de otro rol (la billetera propia es del rider).
const adminExcepto = new Set(["audit.delete", "ledger.delete", "wallet.view_own"]);
for (const clave of claves) {
  if (adminExcepto.has(clave)) continue;
  check(matriz.ADMIN[clave] === true, `ADMIN debería poder "${clave}"`);
}

// 4.b Permisos exclusivos de un rol.
for (const role of roles) {
  check(
    matriz[role]["wallet.view_own"] === (role === "RIDER"),
    `wallet.view_own debe ser exclusivo de RIDER (falla en ${role})`
  );
}
for (const role of roles) {
  const esperado = role === "RIDER" || role === "ADMIN";
  check(
    matriz[role]["delivery.update_own"] === esperado,
    `delivery.update_own debe ser RIDER + override ADMIN (falla en ${role})`
  );
}

// 5. Negativas inequívocas por rol.
const negativas = {
  RIDER: [
    "user.manage",
    "settings.global.manage",
    "payment.validate",
    "order.mark_ready",
    "order.handoff_to_rider",
    "order.assign_rider",
    "settlement.confirm",
    "wallet.view_any",
  ],
  SUPPORT_AGENT: [
    "order.mark_ready",
    "order.handoff_to_rider",
    "settlement.confirm",
    "user.manage",
    "audit.view",
  ],
  BRANCH_MANAGER: [
    "user.manage",
    "settlement.confirm",
    "wallet.view_any",
    "settings.global.manage",
  ],
  COORDINATOR: ["user.manage", "settings.global.manage", "audit.view"],
};
for (const [role, clavesNegadas] of Object.entries(negativas)) {
  for (const clave of clavesNegadas) {
    check(
      matriz[role][clave] === false,
      `${role} NO debería poder "${clave}"`
    );
  }
}

// 6. Toda clave (salvo las prohibidas) debe tener al menos un rol que la ejerza.
for (const clave of claves) {
  if (["audit.delete", "ledger.delete"].includes(clave)) continue;
  const alguno = roles.some((r) => matriz[r][clave]);
  check(alguno, `Ningún rol puede ejercer "${clave}" (permiso muerto)`);
}

// 7. Aislamiento multi-inquilino absoluto.
for (const role of roles) {
  const d = can(actor(role), "order.view", { tenantId: "tenant-b" });
  check(d.allowed === false, `${role} no debe cruzar de inquilino`);
}

// 8. Alcance de sucursal del Encargado.
const encargado = actor(UserRole.BRANCH_MANAGER);
check(
  can(encargado, "branch.toggle", { tenantId: "tenant-a", branchId: "branch-1" }).allowed === true,
  "Encargado debe poder operar en su sucursal asignada"
);
check(
  can(encargado, "branch.toggle", { tenantId: "tenant-a", branchId: "branch-2" }).allowed === false,
  "Encargado NO debe operar fuera de su sucursal"
);

// 9. Alcance de asignación del Repartidor.
const rider = actor(UserRole.RIDER);
check(
  can(rider, "delivery.update_own", { tenantId: "tenant-a", riderId: "rider-1" }).allowed === true,
  "Repartidor debe poder actualizar su propia entrega"
);
check(
  can(rider, "delivery.update_own", { tenantId: "tenant-a", riderId: "rider-2" }).allowed === false,
  "Repartidor NO debe actualizar entregas de otro"
);

// 10. Matriz resumida para inspección humana.
const ancho = 24;
const cabecera = "permiso".padEnd(ancho) + roles.map((r) => r.slice(0, 4).padStart(6)).join("");
console.log(cabecera);
console.log("-".repeat(cabecera.length));
for (const clave of claves) {
  const fila = clave.padEnd(ancho) + roles.map((r) => (matriz[r][clave] ? "  si  " : "  -   ")).join("");
  console.log(fila);
}

console.log("");
if (fallos.length > 0) {
  console.error(`FALLARON ${fallos.length} verificacion(es):`);
  for (const f of fallos) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`OK: ${claves.length} permisos × ${roles.length} roles = ${claves.length * roles.length} evaluaciones sin violaciones.`);
