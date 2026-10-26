"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LogOut, Menu, PackageCheck, X } from "lucide-react";
import { fetchMe, logout, ROLE_LABEL } from "@/lib/auth";
import { navForRole } from "@/lib/nav";

export function AppHeader({ title }: { title: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: actor } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

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
  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
            <PackageCheck className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-foreground">{title}</p>
            <p className="truncate text-xs leading-tight text-muted-foreground">Zero Delivery</p>
          </div>
        </div>

        {/* Escritorio: rol + salir */}
        <div className="hidden items-center gap-3 sm:flex">
          {actor ? (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              {ROLE_LABEL[actor.role] ?? actor.role}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Salir
          </button>
        </div>

        {/* Móvil: menú hamburguesa */}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="app-mobile-menu"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:border-primary hover:text-primary sm:hidden"
        >
          {menuOpen ? (
            <X className="h-5 w-5" aria-hidden />
          ) : (
            <Menu className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>

      {/* Escritorio: navegación del rol */}
      {links.length > 0 ? (
        <nav aria-label="Menú principal" className="hidden border-t border-border sm:block">
          <ul className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-4">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-[44px] cursor-pointer items-center border-b-2 px-3 text-sm font-semibold transition-colors ${
                      active
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {menuOpen ? (
        <div id="app-mobile-menu" className="border-t border-border bg-card sm:hidden">
          {actor ? (
            <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {ROLE_LABEL[actor.role] ?? actor.role}
            </p>
          ) : null}
          <nav aria-label="Menú principal" className="px-4 py-3">
            <ul className="space-y-1">
              {links.map((link) => {
                const active = isActive(link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMenuOpen(false)}
                      className={`flex min-h-[48px] cursor-pointer items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="border-t border-border p-4">
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
              className="flex min-h-[48px] w-full cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
