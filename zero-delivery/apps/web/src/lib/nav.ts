import type { UserRole } from "@zero-delivery/shared-types";

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
  badge?: string;
}

/** Menú propio de cada rol; los destinos respetan ROUTE_ROLES del middleware. */
export const ROLE_NAV: Record<UserRole, NavItem[]> = {
  ADMIN: [
    { href: "/admin", label: "Panel General", icon: "LayoutDashboard" },
    { href: "/bot", label: "Bot & Vocero CRM", icon: "Bot" },
    { href: "/coordinator", label: "Despacho Kanban", icon: "Kanban" },
    { href: "/kitchen", label: "Cocina y KDS", icon: "ChefHat" },
    { href: "/orders", label: "Toma de Pedidos", icon: "ClipboardList" },
    { href: "/admin/sucursales", label: "Sucursales", icon: "Store" },
    { href: "/admin/catalogo", label: "Catálogo y Menú", icon: "BookOpen" },
    { href: "/admin/repartidores", label: "Flota Repartidores", icon: "Bike" },
    { href: "/admin/pagos", label: "Pagos y Cierres", icon: "CreditCard" },
    { href: "/admin/usuarios", label: "Gestión Usuarios", icon: "Users" },
    { href: "/metrics", label: "Métricas y KPIs", icon: "BarChart3" },
    { href: "/profile", label: "Mi Cuenta", icon: "UserCircle" },
  ],
  COORDINATOR: [
    { href: "/coordinator", label: "Despacho Kanban", icon: "Kanban" },
    { href: "/bot", label: "Bot & Vocero CRM", icon: "Bot" },
    { href: "/orders", label: "Pedidos Activos", icon: "ClipboardList" },
    { href: "/coordinator/pagos", label: "Validar Pagos", icon: "CreditCard" },
    { href: "/coordinator/repartidores", label: "Flota y Asignación", icon: "Bike" },
    { href: "/coordinator/billeteras", label: "Billeteras y Caja", icon: "Wallet" },
    { href: "/metrics", label: "Métricas del Día", icon: "BarChart3" },
    { href: "/profile", label: "Mi Cuenta", icon: "UserCircle" },
  ],
  BRANCH_MANAGER: [
    { href: "/kitchen", label: "Comandas Cocina", icon: "ChefHat" },
    { href: "/kitchen/catalogo", label: "Mi Sucursal y Carta", icon: "BookOpen" },
    { href: "/profile", label: "Mi Cuenta", icon: "UserCircle" },
  ],
  SUPPORT_AGENT: [
    { href: "/orders", label: "Todos los Pedidos", icon: "ClipboardList" },
    { href: "/orders/nuevo", label: "Registrar Pedido", icon: "PlusCircle" },
    { href: "/orders/pagos", label: "Comprobantes Yape", icon: "CreditCard" },
    { href: "/bot", label: "Bot & Vocero CRM", icon: "Bot" },
    { href: "/profile", label: "Mi Cuenta", icon: "UserCircle" },
  ],
  RIDER: [
    { href: "/rider", label: "Mis Entregas", icon: "Bike" },
    { href: "/rider/wallet", label: "Billetera y Deuda", icon: "Wallet" },
    { href: "/profile", label: "Mi Cuenta", icon: "UserCircle" },
  ],
};

export function navForRole(role: string | undefined): NavItem[] {
  if (!role) return [];
  return ROLE_NAV[role as UserRole] ?? [];
}
