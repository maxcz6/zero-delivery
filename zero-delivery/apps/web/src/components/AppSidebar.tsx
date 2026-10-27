"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bike,
  BookOpen,
  Bot,
  ChefHat,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  CreditCard,
  Kanban,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  PlusCircle,
  Store,
  UserCircle,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { fetchMe, logout, ROLE_LABEL } from "@/lib/auth";
import { navForRole } from "@/lib/nav";
import { useUiStore } from "@/store/ui-store";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Bot,
  Kanban,
  ChefHat,
  ClipboardList,
  BookOpen,
  Bike,
  CreditCard,
  Users,
  BarChart3,
  UserCircle,
  Wallet,
  PlusCircle,
  Store,
};

/**
 * Barra lateral fija. Se puede contraer (solo íconos) o expandir tanto en escritorio
 * como en móvil. En móvil, al expandirse se superpone al contenido.
 */
export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { expanded, toggle, setExpanded } = useUiStore();

  const { data: actor } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });

  // En móvil, al navegar el riel vuelve a contraerse.
  useEffect(() => {
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) {
      useUiStore.setState({ expanded: false });
    }
  }, [pathname]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !window.matchMedia("(min-width: 1024px)").matches) setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, setExpanded]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await logout();
    },
    onSuccess: () => {
      router.replace("/login");
      router.refresh();
    },
  });

  const links = navForRole(actor?.role);
  const activeHref = links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      {/* Fondo difuminado: solo móvil y con la barra expandida */}
      {expanded ? (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setExpanded(false)}
          aria-hidden="true"
        />
      ) : null}

      <aside
        aria-label="Barra lateral de navegación"
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card shadow-lg transition-[width] duration-200 ease-out lg:shadow-none ${
          expanded ? "w-64" : "w-14 lg:w-[72px]"
        }`}
      >
        {/* Marca */}
        <div className={`flex h-14 shrink-0 items-center border-b border-border ${expanded ? "gap-3 px-4" : "justify-center"}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-sm">
            <PackageCheck className="h-5 w-5" aria-hidden />
          </span>
          {expanded ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold leading-tight text-foreground">Zero Delivery</p>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">Despacho y logística</p>
            </div>
          ) : null}
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          <ul className="space-y-1">
            {links.map((link) => {
              const active = link.href === activeHref;
              const Icon = (link.icon && ICON_MAP[link.icon]) || LayoutDashboard;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    title={expanded ? undefined : link.label}
                    aria-label={link.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[44px] items-center rounded-lg text-sm transition-colors ${
                      expanded ? "gap-3 px-3" : "justify-center"
                    } ${
                      active
                        ? "bg-primary font-bold text-on-primary shadow-sm"
                        : "font-medium text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? "text-on-primary" : "text-muted-foreground"}`} aria-hidden />
                    {expanded ? <span className="truncate">{link.label}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Usuario, salir y contraer */}
        <div className="shrink-0 space-y-1 border-t border-border p-2">
          {actor && expanded ? (
            <div className="rounded-lg bg-muted/60 px-3 py-2">
              <p className="truncate text-xs font-bold text-foreground">{ROLE_LABEL[actor.role] ?? actor.role}</p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">{actor.userId?.slice(0, 8)}</p>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            title={expanded ? undefined : "Cerrar sesión"}
            aria-label="Cerrar sesión"
            className={`flex min-h-[44px] w-full cursor-pointer items-center rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive disabled:opacity-50 ${
              expanded ? "gap-3 px-3" : "justify-center"
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden />
            {expanded ? "Cerrar sesión" : null}
          </button>

          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? "Contraer barra lateral" : "Expandir barra lateral"}
            title={expanded ? undefined : "Expandir"}
            className={`flex min-h-[44px] w-full cursor-pointer items-center rounded-lg text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
              expanded ? "gap-3 px-3" : "justify-center"
            }`}
          >
            {expanded ? <ChevronsLeft className="h-5 w-5 shrink-0" aria-hidden /> : <ChevronsRight className="h-5 w-5 shrink-0" aria-hidden />}
            {expanded ? "Contraer" : null}
          </button>
        </div>
      </aside>
    </>
  );
}
