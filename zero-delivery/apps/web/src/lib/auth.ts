import { dbRoleToRole, UserRole, type RolUsuarioDb } from "@zero-delivery/shared-types";
import { api } from "./api";
import type { Actor } from "./types";

export const ROLE_HOME: Record<UserRole, string> = {
  [UserRole.ADMIN]: "/admin",
  [UserRole.COORDINATOR]: "/coordinator",
  [UserRole.BRANCH_MANAGER]: "/kitchen",
  [UserRole.SUPPORT_AGENT]: "/orders",
  [UserRole.RIDER]: "/rider",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  [UserRole.ADMIN]: "Administrador",
  [UserRole.COORDINATOR]: "Coordinador",
  [UserRole.BRANCH_MANAGER]: "Encargado de Sucursal",
  [UserRole.SUPPORT_AGENT]: "Agente de Soporte",
  [UserRole.RIDER]: "Repartidor",
};

export function homeForDbRole(rol: string): string {
  const mapped = dbRoleToRole[rol as RolUsuarioDb];
  return ROLE_HOME[mapped] ?? "/login";
}

export async function fetchMe(): Promise<Actor> {
  const res = await api.get<{ ok: boolean; actor: Actor }>("/auth/me");
  return res.actor;
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout");
}
