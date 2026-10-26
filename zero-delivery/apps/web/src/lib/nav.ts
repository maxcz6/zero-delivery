import type { UserRole } from "@zero-delivery/shared-types";

export interface NavItem {
  href: string;
  label: string;
}

/** Menú propio de cada rol; los destinos respetan ROUTE_ROLES del middleware. */
export const ROLE_NAV: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { href: "/admin", label: "Panel" },
    { href: "/admin/usuarios", label: "Usuarios" },
    { href: "/admin/catalogo", label: "Catálogo" },
    { href: "/admin/repartidores", label: "Repartidores" },
    { href: "/admin/pagos", label: "Pagos" },
    { href: "/coordinator", label: "Despacho" },
    { href: "/kitchen", label: "Cocina" },
    { href: "/orders", label: "Pedidos" },
  ],
  COORDINATOR: [
    { href: "/coordinator", label: "Despacho" },
    { href: "/coordinator/pagos", label: "Pagos" },
    { href: "/coordinator/repartidores", label: "Repartidores" },
    { href: "/coordinator/billeteras", label: "Billeteras" },
  ],
  BRANCH_MANAGER: [
    { href: "/kitchen", label: "Cocina" },
    { href: "/kitchen/catalogo", label: "Catálogo" },
  ],
  SUPPORT_AGENT: [
    { href: "/orders", label: "Pedidos" },
    { href: "/orders/nuevo", label: "Nuevo pedido" },
    { href: "/orders/pagos", label: "Pagos" },
  ],
  RIDER: [
    { href: "/rider", label: "Entregas" },
    { href: "/rider/wallet", label: "Billetera" },
  ],
};

export function navForRole(role: string | undefined): NavItem[] {
  if (!role) return [];
  return ROLE_NAV[role as UserRole] ?? [];
}
