"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChefHat,
  Clock,
  CookingPot,
  Handshake,
  PackageCheck,
  Store,
} from "lucide-react";
import type { EstadoOperativoPedidoDb } from "@zero-delivery/shared-types";
import { api, ApiError } from "@/lib/api";
import type { ApiResponse, Pedido, Sucursal } from "@/lib/types";
import { elapsedMinutes, formatElapsed, isOrderFragile, orderNumber } from "@/lib/orders";
import { fetchMe } from "@/lib/auth";
import { useNow } from "@/lib/useNow";
import { Badge, ErrorNote, PageLoader, Spinner } from "@/components/ui";

interface SectionDef {
  key: string;
  title: string;
  states: EstadoOperativoPedidoDb[];
}

const SECTIONS: SectionDef[] = [
  { key: "aceptar", title: "Por Aceptar", states: ["NUEVO"] },
  { key: "preparacion", title: "En Preparación", states: ["CONFIRMADO", "EN_PREPARACION"] },
  {
    key: "listos",
    title: "Listos para Traspaso",
    states: ["LISTO", "REPARTIDOR_ASIGNADO", "REPARTIDOR_EN_RECOJO"],
  },
];

export function KitchenBoard() {
  const queryClient = useQueryClient();
  const now = useNow();

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000 });
  const branchesQuery = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<ApiResponse<Sucursal[]>>("/catalog/branches"),
  });
  const ordersQuery = useQuery({
    queryKey: ["orders", "active", "kitchen"],
    queryFn: () => api.get<ApiResponse<Pedido[]>>("/orders/active"),
    refetchInterval: 8_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (input: { branchId: string; apertura_manual: boolean }) =>
      api.patch<ApiResponse<Sucursal>>(`/catalog/branches/${input.branchId}/toggle`, {
        apertura_manual: input.apertura_manual,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["branches"] });
    },
  });

  const transitionMutation = useMutation({
    mutationFn: (input: { pedidoId: string; nuevoEstado: EstadoOperativoPedidoDb }) =>
      api.post<ApiResponse<Pedido>>(`/orders/${input.pedidoId}/transition`, {
        nuevo_estado: input.nuevoEstado,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const handoffMutation = useMutation({
    mutationFn: (pedidoId: string) => api.post<ApiResponse<Pedido>>(`/orders/${pedidoId}/handoff`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  if (ordersQuery.isLoading || meQuery.isLoading) {
    return <PageLoader label="Cargando pedidos de la sucursal…" />;
  }
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

  const branchIds = meQuery.data?.branchIds ?? [];
  const myBranches = (branchesQuery.data?.data ?? []).filter(
    (b) => branchIds.length === 0 || branchIds.includes(b.id)
  );
  const pedidos = ordersQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {myBranches.map((branch) => (
          <div
            key={branch.id}
            className="card flex items-center gap-3 px-4 py-3"
          >
            <Store className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-bold text-foreground">{branch.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {branch.apertura_manual ? "Abierta (aceptando pedidos)" : "Cerrada"}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={branch.apertura_manual}
              aria-label={`Abrir o cerrar ${branch.nombre}`}
              onClick={() =>
                toggleMutation.mutate({
                  branchId: branch.id,
                  apertura_manual: !branch.apertura_manual,
                })
              }
              disabled={toggleMutation.isPending}
              className={`relative ml-2 h-8 w-14 cursor-pointer rounded-full transition-colors disabled:opacity-50 ${
                branch.apertura_manual ? "bg-success" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                  branch.apertura_manual ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        ))}
        {toggleMutation.isError ? (
          <p className="flex items-center gap-1 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {toggleMutation.error instanceof ApiError
              ? toggleMutation.error.message
              : "No se pudo cambiar el estado de la sucursal"}
          </p>
        ) : null}
      </div>

      {transitionMutation.isError ? (
        <ErrorNote
          message={
            transitionMutation.error instanceof ApiError
              ? transitionMutation.error.message
              : "No se pudo actualizar el pedido"
          }
        />
      ) : null}
      {handoffMutation.isError ? (
        <ErrorNote
          message={
            handoffMutation.error instanceof ApiError
              ? handoffMutation.error.message
              : "No se pudo registrar el traspaso"
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((section) => {
          const sectionOrders = pedidos.filter((p) => section.states.includes(p.estado_operativo));
          return (
            <section
              key={section.key}
              aria-label={section.title}
              className="flex min-w-0 flex-col rounded-card bg-muted/60 p-3"
            >
              <header className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground">
                  {section.key === "aceptar" ? (
                    <PackageCheck className="h-4 w-4 text-primary" aria-hidden />
                  ) : section.key === "preparacion" ? (
                    <CookingPot className="h-4 w-4 text-accent" aria-hidden />
                  ) : (
                    <Handshake className="h-4 w-4 text-success" aria-hidden />
                  )}
                  {section.title}
                </h2>
                <span className="rounded-full bg-card px-2.5 py-0.5 text-sm font-bold text-foreground shadow-sm">
                  {sectionOrders.length}
                </span>
              </header>
              <div className="flex flex-1 flex-col gap-3">
                {sectionOrders.map((pedido) => (
                  <KitchenCard
                    key={pedido.id}
                    pedido={pedido}
                    now={now}
                    lateMinutes={section.key === "preparacion" ? 30 : 5}
                    onTransition={(nuevoEstado) =>
                      transitionMutation.mutate({ pedidoId: pedido.id, nuevoEstado })
                    }
                    onHandoff={() => handoffMutation.mutate(pedido.id)}
                    busy={transitionMutation.isPending || handoffMutation.isPending}
                  />
                ))}
                {sectionOrders.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
                    Sin pedidos
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function KitchenCard({
  pedido,
  now,
  lateMinutes,
  onTransition,
  onHandoff,
  busy,
}: {
  pedido: Pedido;
  now: number;
  lateMinutes: number;
  onTransition: (estado: EstadoOperativoPedidoDb) => void;
  onHandoff: () => void;
  busy: boolean;
}) {
  const minutes = elapsedMinutes(pedido.creado_en, now);
  const isLate = minutes > lateMinutes;
  const traspasado = pedido.traspaso_en !== null;

  return (
    <article className="card space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xl font-bold text-foreground">{orderNumber(pedido)}</p>
          <p className="text-sm text-muted-foreground">{pedido.cliente?.nombre ?? "Cliente"}</p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold ${
            isLate ? "bg-accent-soft text-accent" : "bg-muted text-muted-foreground"
          }`}
        >
          {isLate ? <AlertTriangle className="h-4 w-4" aria-hidden /> : <Clock className="h-4 w-4" aria-hidden />}
          {formatElapsed(minutes)}
        </span>
      </div>

      <ul className="space-y-2 border-t border-border pt-3">
        {(pedido.items ?? []).map((item) => (
          <li key={item.id} className="text-sm">
            <p className="font-semibold text-foreground">
              {item.cantidad}× {item.nombre_snapshot}
            </p>
            {item.modificadores && item.modificadores.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.modificadores.map((mod) => (
                  <Badge
                    key={mod.id}
                    className="border border-warning-soft bg-warning-soft text-warning"
                  >
                    {mod.nombre_snapshot}
                  </Badge>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {isOrderFragile(pedido) ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Contiene productos frágiles — empacar con cuidado
        </p>
      ) : null}

      {pedido.notas ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Nota: {pedido.notas}
        </p>
      ) : null}

      {pedido.estado_operativo === "NUEVO" ? (
        <button
          type="button"
          onClick={() => onTransition("CONFIRMADO")}
          disabled={busy}
          className="flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Check className="h-6 w-6" aria-hidden />
          Aceptar Pedido
        </button>
      ) : null}

      {pedido.estado_operativo === "CONFIRMADO" ? (
        <button
          type="button"
          onClick={() => onTransition("EN_PREPARACION")}
          disabled={busy}
          className="flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-lg font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <ChefHat className="h-6 w-6" aria-hidden />
          Empezar Preparación
        </button>
      ) : null}

      {pedido.estado_operativo === "EN_PREPARACION" ? (
        <button
          type="button"
          onClick={() => onTransition("LISTO")}
          disabled={busy}
          className="flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <PackageCheck className="h-6 w-6" aria-hidden />
          Marcar Listo
        </button>
      ) : null}

      {["LISTO", "REPARTIDOR_ASIGNADO", "REPARTIDOR_EN_RECOJO"].includes(
        pedido.estado_operativo
      ) ? (
        traspasado ? (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-success-soft px-3 py-3 text-sm font-bold text-success">
            <Handshake className="h-5 w-5" aria-hidden />
            Traspaso registrado a las{" "}
            {new Date(pedido.traspaso_en as string).toLocaleTimeString("es-PE", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : (
          <button
            type="button"
            onClick={onHandoff}
            disabled={busy}
            className="flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-success text-lg font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Spinner className="h-5 w-5" /> : <Handshake className="h-6 w-6" aria-hidden />}
            Registrar Traspaso Físico
          </button>
        )
      ) : null}
    </article>
  );
}

