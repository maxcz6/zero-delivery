"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bike, CreditCard, Search } from "lucide-react";
import { api, ApiError, money } from "@/lib/api";
import type { ApiResponse, Pedido } from "@/lib/types";
import { elapsedMinutes, ESTADO_LABEL, formatElapsed, orderNumber } from "@/lib/orders";
import { useNow } from "@/lib/useNow";
import { Badge, EmptyState, ErrorNote, Modal, PageLoader, Spinner } from "@/components/ui";
import { AssignRiderModal } from "@/components/coordinator/AssignRiderModal";

const ASSIGNABLE: Array<Pedido["estado_operativo"]> = [
  "CONFIRMADO",
  "EN_PREPARACION",
  "LISTO",
  "REPARTIDOR_ASIGNADO",
];

const ESTADO_BADGE: Partial<Record<Pedido["estado_operativo"], string>> = {
  NUEVO: "bg-primary text-white",
  CONFIRMADO: "bg-info-soft text-primary",
  EN_PREPARACION: "bg-warning-soft text-warning",
  LISTO: "bg-success-soft text-success",
  REPARTIDOR_ASIGNADO: "bg-success-soft text-success",
  REPARTIDOR_EN_RECOJO: "bg-accent-soft text-accent",
  EN_CAMINO: "bg-accent-soft text-accent",
  CANCELACION_SOLICITADA: "bg-destructive/10 text-destructive",
  ENTREGA_FALLIDA: "bg-destructive text-white",
  PENDIENTE_RESOLUCION: "bg-destructive/10 text-destructive",
  DEVOLUCION_PENDIENTE: "bg-muted text-muted-foreground",
};

const METODO_LABEL: Record<Pedido["metodo_pago"], string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  TRANSFERENCIA_BANCARIA: "Transferencia",
};

export function SupportOrders() {
  const queryClient = useQueryClient();
  const now = useNow();
  const [query, setQuery] = useState("");
  const [cancelFor, setCancelFor] = useState<Pedido | null>(null);
  const [assignFor, setAssignFor] = useState<string | null>(null);

  const ordersQuery = useQuery({
    queryKey: ["orders", "active", "support"],
    queryFn: () => api.get<ApiResponse<Pedido[]>>("/orders/active"),
    refetchInterval: 15_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (input: { pedidoId: string; motivo: string }) =>
      api.post<ApiResponse<Pedido>>(`/orders/${input.pedidoId}/transition`, {
        nuevo_estado: "CANCELACION_SOLICITADA",
        motivo: input.motivo,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      setCancelFor(null);
    },
  });

  const pedidos = useMemo(() => {
    const all = ordersQuery.data?.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    const numeric = q.replace(/^#/, "");
    return all.filter(
      (p) =>
        String(Number(p.numero) || p.numero).includes(numeric) ||
        (p.cliente?.nombre ?? "").toLowerCase().includes(q) ||
        (p.cliente?.telefono_e164 ?? "").includes(q)
    );
  }, [ordersQuery.data, query]);

  if (ordersQuery.isLoading) return <PageLoader label="Cargando pedidos…" />;
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

  const cancelableStates = new Set([
    "CANCELACION_SOLICITADA",
    "ENTREGADO",
    "CANCELADO",
    "RECHAZADO",
    "ENTREGA_FALLIDA",
    "DEVOLUCION_PENDIENTE",
    "DEVUELTO_A_RESTAURANTE",
    "PENDIENTE_RESOLUCION",
  ]);

  const renderActions = (pedido: Pedido) => (
    <div className="flex flex-wrap gap-2">
      {pedido.metodo_pago !== "EFECTIVO" && pedido.estado_pago !== "PAGADO" ? (
        <Link href="/orders/pagos" className="btn-secondary btn-sm text-yape">
          <CreditCard className="h-3.5 w-3.5" aria-hidden />
          Validar pago
        </Link>
      ) : null}
      {ASSIGNABLE.includes(pedido.estado_operativo) ? (
        <button
          type="button"
          onClick={() => setAssignFor(pedido.id)}
          className="btn-primary btn-sm"
        >
          <Bike className="h-3.5 w-3.5" aria-hidden />
          {pedido.repartidor_id ? "Reasignar" : "Asignar repartidor"}
        </button>
      ) : null}
      {!cancelableStates.has(pedido.estado_operativo) ? (
        <button
          type="button"
          onClick={() => setCancelFor(pedido)}
          className="btn-ghost btn-sm text-destructive"
        >
          Solicitar cancelación
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <label htmlFor="support-search" className="input-label">
          Buscar por número, cliente o teléfono
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            id="support-search"
            type="search"
            className="input pl-9"
            placeholder="Ej. #0007, María o +51 987…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Acepta número de pedido, nombre del cliente o teléfono.
        </p>
      </div>

      {pedidos.length === 0 ? (
        <EmptyState title="Sin pedidos que coincidan" />
      ) : (
        <>
        <div className="card hidden overflow-x-auto md:block">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Pedido</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Sucursal</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Pago</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 text-right font-semibold">Tiempo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pedidos.map((pedido) => {
                const badge = ESTADO_BADGE[pedido.estado_operativo] ?? "bg-muted text-muted-foreground";
                const minutes = elapsedMinutes(pedido.creado_en, now);
                return (
                  <tr
                    key={pedido.id}
                    className="border-b border-border last:border-0 hover:bg-muted/50"
                  >
                    <td className="px-4 py-3 font-bold text-foreground">
                      {orderNumber(pedido)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {pedido.cliente?.nombre ?? "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {pedido.cliente?.telefono_e164 ?? ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {pedido.sucursal?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={badge}>{ESTADO_LABEL[pedido.estado_operativo]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {METODO_LABEL[pedido.metodo_pago]} · {pedido.estado_pago}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">
                      {money(pedido.total_centavos)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground">
                      {formatElapsed(minutes)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">{renderActions(pedido)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 md:hidden">
          {pedidos.map((pedido) => {
            const badge = ESTADO_BADGE[pedido.estado_operativo] ?? "badge-neutral";
            const minutes = elapsedMinutes(pedido.creado_en, now);
            return (
              <article key={pedido.id} className="card space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground">{orderNumber(pedido)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {pedido.cliente?.nombre ?? "—"} · {pedido.cliente?.telefono_e164 ?? ""}
                    </p>
                  </div>
                  <Badge className={badge}>{ESTADO_LABEL[pedido.estado_operativo]}</Badge>
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Sucursal</dt>
                    <dd className="font-medium text-foreground">{pedido.sucursal?.nombre ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Pago</dt>
                    <dd className="font-medium text-foreground">
                      {METODO_LABEL[pedido.metodo_pago]} · {pedido.estado_pago}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Total</dt>
                    <dd className="font-semibold text-foreground">{money(pedido.total_centavos)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tiempo</dt>
                    <dd className="font-medium text-foreground">{formatElapsed(minutes)}</dd>
                  </div>
                </dl>

                {renderActions(pedido)}
              </article>
            );
          })}
        </div>
        </>
      )}

      {assignFor ? <AssignRiderModal pedidoId={assignFor} onClose={() => setAssignFor(null)} /> : null}

      {cancelFor ? (
        <CancelModal
          pedido={cancelFor}
          busy={cancelMutation.isPending}
          error={
            cancelMutation.isError && cancelMutation.error instanceof ApiError
              ? cancelMutation.error.message
              : null
          }
          onClose={() => setCancelFor(null)}
          onSubmit={(motivo) => cancelMutation.mutate({ pedidoId: cancelFor.id, motivo })}
        />
      ) : null}
    </div>
  );
}

function CancelModal({
  pedido,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  pedido: Pedido;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (motivo.trim().length >= 3) onSubmit(motivo.trim());
  }

  return (
    <Modal title={`Solicitar cancelación · ${orderNumber(pedido)}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="motivo-cancelacion" className="input-label">
            Motivo de la solicitud (obligatorio)
          </label>
          <textarea
            id="motivo-cancelacion"
            className="input min-h-24 resize-y"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            minLength={3}
          />
          <span className="text-xs text-muted-foreground">
            La cancelación definitiva debe ser autorizada por el coordinador.
          </span>
        </div>
        {error ? <ErrorNote message={error} /> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Volver
          </button>
          <button type="submit" className="btn-primary" disabled={busy || motivo.trim().length < 3}>
            {busy ? <Spinner className="h-4 w-4" /> : null}
            Enviar solicitud
          </button>
        </div>
      </form>
    </Modal>
  );
}
