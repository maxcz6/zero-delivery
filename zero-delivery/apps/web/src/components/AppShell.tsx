"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/AppSidebar";
import { useUiStore } from "@/store/ui-store";

/** Rutas sin barra lateral: login y vistas públicas del comensal. */
function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/m" ||
    pathname.startsWith("/m/") ||
    pathname.startsWith("/p/")
  );
}

/**
 * Estructura común del sistema: barra lateral fija + contenido desplazado.
 * El contenido deja siempre el espacio del riel (móvil 56px, escritorio 72px) y,
 * en escritorio con la barra expandida, 256px.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const expanded = useUiStore((s) => s.expanded);
  const init = useUiStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  if (isPublicPath(pathname)) return <>{children}</>;

  return (
    <>
      <AppSidebar />
      <div
        className={`min-h-dvh pl-14 transition-[padding] duration-200 ease-out ${
          expanded ? "lg:pl-64" : "lg:pl-[72px]"
        }`}
      >
        {children}
      </div>
    </>
  );
}
