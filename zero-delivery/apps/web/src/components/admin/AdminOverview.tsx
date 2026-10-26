"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  ChefHat,
  ClipboardList,
  CreditCard,
  Store,
  Truck,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { api, ApiError, money, toCents } from "@/lib/api";
import { fetchMe, ROLE_LABEL } from "@/lib/auth";
import type { ApiResponse, Pedido, Repartidor, Sucursal, UsuarioSistema } from "@/lib/types";
import { ESTADO_LABEL, orderNumber } from "@/lib/orders";
import { Badge, ErrorNote, PageLoader } from "@/components/ui";

export function AdminOverview() {
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000 });
  const ordersQuery = useQuery({
    queryKey: ["orders", "active", "admin"],
    queryFn: () => api.get<ApiResponse<Pedido[]>>("/orders/active"),
    refetchInterval: 15_000,
  });
  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<ApiResponse<Sucursal[]>>("/catalog/branches"),
  });
  const ridersQuery = useQuery({
    queryKey: ["riders"],
    queryFn: () => api.get<ApiResponse<Repartidor[]>>("/logistics/riders"),
    staleTime: 60_000,
  });
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<ApiResponse<UsuarioSistema[]>>("/users"),
    staleTime: 60_000,
  });

  if (ordersQuery.isLoading) return <PageLoader label="Cargando panel…" />;
  if (ordersQuery.isError) {
    return (
      <ErrorNote
        message={
          ordersQuery.error instanceof ApiError
            ? ordersQuery.error.message
            : "No se pudo conectar con la API"
        }
      />
    );
  }

  const pedidos = ordersQuery.data?.data ?? [];
  const sucursales = branchesQuery.data?.data ?? [];
  const riders = ridersQuery.data?.data ?? [];
  const usuarios = usersQuery.data?.data ?? [];

  const porAceptar = pedidos.filter((p) => ["NUEVO", "CONFIRMADO"].includes(p.estado_operativo));
  const enCocina = pedidos.filter((p) => p.estado_operativo === "EN_PREPARACION");
  const enCamino = pedidos.filter((p) =>
    ["REPARTIDOR_EN_RECOJO", "EN_CAMINO"].includes(p.estado_operativo)
  );
  const cobrosPendientes = pedidos.filter(
    (p) => p.metodo_pago !== "EFECTIVO" && p.estado_pago === "PENDIENTE"
  );
  const montoCobros = cobrosPendientes.reduce(
    (acc, p) => acc + toCents(p.total_centavos),
    0
  );
  const abiertas = sucursales.filter((s) => s.apertura_manual).length;
  const disponibles = riders.filter((r) => r.estado === "DISPONIBLE").length;
  const activos = usuarios.filter((u) => u.esta_activo).length;

  const recientes = [...pedidos]
    .sort((a, b) => new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            Hola, {meQuery.data?.role ? ROLE_LABEL[meQuery.data.role] : "Administrador"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Estado global de la operación en tiempo real.
          </p>
        </div>
        <Link
          href="/coordinator"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
        >
          Abrir despacho
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          label="Pedidos activos"
          value={String(pedidos.length)}
          hint={`${porAceptar.length} por aceptar`}
        />
        <Kpi
          icon={<ChefHat className="h-5 w-5" aria-hidden />}
          label="En preparación"
          value={String(enCocina.length)}
          hint="Cocina y empaque"
        />
        <Kpi
          icon={<Truck className="h-5 w-5" aria-hidden />}
          label="En camino"
          value={String(enCamino.length)}
          hint={`${disponibles} repartidores disponibles`}
        />
        <Kpi
          icon={<Wallet className="h-5 w-5" aria-hidden />}
          label="Cobros por validar"
          value={String(cobrosPendientes.length)}
          hint={money(montoCobros)}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <QuickAction
          href="/admin/usuarios"
          icon={<Users className="h-5 w-5" aria-hidden />}
          title="Usuarios"
          detail={`${activos} activos de ${usuarios.length}`}
        />
        <QuickAction
          href="/admin/catalogo"
          icon={<UtensilsCrossed className="h-5 w-5" aria-hidden />}
          title="Catálogo"
          detail="Productos, precios y disponibilidad"
        />
        <QuickAction
          href="/admin/repartidores"
          icon={<Bike className="h-5 w-5" aria-hidden />}
          title="Repartidores"
          detail={`${disponibles} disponibles · ${riders.length} registrados`}
        />
        <QuickAction
          href="/admin/pagos"
          icon={<CreditCard className="h-5 w-5" aria-hidden />}
          title="Pagos"
          detail={`${cobrosPendientes.length} comprobantes por validar`}
        />
        <QuickAction
          href="/coordinator"
          icon={<ClipboardList className="h-5 w-5" aria-hidden />}
          title="Despacho"
          detail="Tablero Kanban del coordinador"
        />
        <QuickAction
          href="/orders"
          icon={<Store className="h-5 w-5" aria-hidden />}
          title="Pedidos"
          detail="Soporte y seguimiento de pedidos"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="card p-4" aria-label="Sucursales">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
              Sucursales
            </h3>
            <Link
              href="/admin/catalogo"
              className="text-xs font-semibold text-primary hover:underline"
            >
              {abiertas} abiertas de {sucursales.length}
            </Link>
          </header>
          <ul className="mt-3 space-y-2">
            {sucursales.map((branch) => (
              <li
                key={branch.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {branch.nombre}
                </span>
                <Badge
                  className={
                    branch.apertura_manual
                      ? "bg-success/10 text-success"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {branch.apertura_manual ? "Abierta" : "Cerrada"}
                </Badge>
              </li>
            ))}
            {sucursales.length === 0 ? (
              <li className="text-sm text-muted-foreground">Sin sucursales.</li>
            ) : null}
          </ul>
        </section>

        <section className="card overflow-x-auto p-4" aria-label="Pedidos recientes">
          <header className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
              Pedidos recientes
            </h3>
            <Link
              href="/coordinator"
              className="text-xs font-semibold text-primary hover:underline"
            >
              Ver tablero
            </Link>
          </header>
          <table className="mt-3 w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 font-semibold">Pedido</th>
                <th className="py-2 font-semibold">Estado</th>
                <th className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {recientes.map((pedido) => (
                <tr key={pedido.id} className="border-b border-border last:border-0">
                  <td className="py-2">
                    <p className="font-semibold text-foreground">{orderNumber(pedido)}</p>
                    <p className="max-w-[180px] truncate text-xs text-muted-foreground">
                      {pedido.cliente?.nombre ?? "Cliente"} ·{" "}
                      {pedido.sucursal?.nombre ?? ""}
                    </p>
                  </td>
                  <td className="py-2">
                    <Badge className="bg-muted text-muted-foreground">
                      {ESTADO_LABEL[pedido.estado_operativo]}
                    </Badge>
                  </td>
                  <td className="py-2 text-right font-semibold text-foreground">
                    {money(pedido.total_centavos)}
                  </td>
                </tr>
              ))}
              {recientes.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    Sin pedidos activos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </span>
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold leading-none text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="card flex min-h-[76px] items-center gap-3 p-4 transition-shadow hover:shadow-lg"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
