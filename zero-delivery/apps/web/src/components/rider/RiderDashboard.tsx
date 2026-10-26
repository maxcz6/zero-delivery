"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Banknote,
  Bike,
  CheckCircle2,
  MapPin,
  Navigation,
  Package,
  Phone,
  Store,
} from "lucide-react";
import type { EstadoOperativoPedidoDb } from "@zero-delivery/shared-types";
import { api, ApiError, money, toCents } from "@/lib/api";
import type { ApiResponse, Pedido } from "@/lib/types";
import { isCashOrder, mapsUrl, orderNumber, wazeUrl } from "@/lib/orders";
import { fetchMe } from "@/lib/auth";
import { EmptyState, ErrorNote, Modal, PageLoader, Spinner } from "@/components/ui";

export function RiderDashboard() {
  const queryClient = useQueryClient();
  const [failureFor, setFailureFor] = useState<string | null>(null);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000 });
  const riderId = meQuery.data?.riderId;

  const ordersQuery = useQuery({
    queryKey: ["orders", "active", "rider"],
    queryFn: () => api.get<ApiResponse<Pedido[]>>("/orders/active"),
    enabled: Boolean(riderId),
    refetchInterval: 10_000,
  });

  const transitionMutation = useMutation({
    mutationFn: (input: { pedidoId: string; nuevoEstado: EstadoOperativoPedidoDb; motivo?: string }) =>
      api.post<ApiResponse<Pedido>>(`/orders/${input.pedidoId}/transition`, {
        nuevo_estado: input.nuevoEstado,
        motivo: input.motivo,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  /** Registra el cobro en el ledger de la billetera y confirma la entrega. */
  const deliverWithCashMutation = useMutation({
    mutationFn: async (pedido: Pedido) => {
      if (isCashOrder(pedido) && toCents(pedido.efectivo_por_cobrar_centavos) > 0) {
        await api.post(`/logistics/orders/${pedido.id}/collect-cash`);
      }
      return api.post<ApiResponse<Pedido>>(`/orders/${pedido.id}/transition`, {
        nuevo_estado: "ENTREGADO",
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
  });

  if (meQuery.isLoading || ordersQuery.isLoading) {
    return <PageLoader label="Cargando tus entregas…" />;
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

  const pedidos = (ordersQuery.data?.data ?? []).filter(
    (p) => !riderId || p.repartidor_id === riderId
  );
  const activeDelivery = pedidos.find((p) =>
    ["REPARTIDOR_ASIGNADO", "REPARTIDOR_EN_RECOJO", "EN_CAMINO"].includes(p.estado_operativo)
  );
  const failed = failureFor ? pedidos.find((p) => p.id === failureFor) : undefined;

  return (
    <div className="space-y-4">
      {transitionMutation.isError ? (
        <ErrorNote
          message={
            transitionMutation.error instanceof ApiError
              ? transitionMutation.error.message
              : "No se pudo actualizar el pedido"
          }
        />
      ) : null}
      {deliverWithCashMutation.isError ? (
        <ErrorNote
          message={
            deliverWithCashMutation.error instanceof ApiError
              ? deliverWithCashMutation.error.message
              : "No se pudo confirmar la entrega"
          }
        />
      ) : null}

      {pedidos.length === 0 ? (
        <EmptyState
          title="No tienes entregas asignadas"
          hint="Cuando el coordinador te asigne un pedido, aparecerá aquí."
        />
      ) : null}

      {pedidos.map((pedido) => (
        <DeliveryCard
          key={pedido.id}
          pedido={pedido}
          isPrimary={pedido.id === activeDelivery?.id}
          busy={transitionMutation.isPending || deliverWithCashMutation.isPending}
          onTransition={(nuevoEstado) =>
            transitionMutation.mutate({ pedidoId: pedido.id, nuevoEstado })
          }
          onDeliver={() => deliverWithCashMutation.mutate(pedido)}
          onReportFailure={() => setFailureFor(pedido.id)}
        />
      ))}

      {failed ? (
        <FailureModal
          pedidoId={failed.id}
          onClose={() => setFailureFor(null)}
          onSubmit={(motivo) => {
            transitionMutation.mutate(
              { pedidoId: failed.id, nuevoEstado: "ENTREGA_FALLIDA", motivo },
              { onSuccess: () => setFailureFor(null) }
            );
          }}
        />
      ) : null}
    </div>
  );
}

function DeliveryCard({
  pedido,
  isPrimary,
  busy,
  onTransition,
  onDeliver,
  onReportFailure,
}: {
  pedido: Pedido;
  isPrimary: boolean;
  busy: boolean;
  onTransition: (estado: EstadoOperativoPedidoDb) => void;
  onDeliver: () => void;
  onReportFailure: () => void;
}) {
  const direccion = pedido.direccion_snapshot ?? {};
  const cash = isCashOrder(pedido);
  const cashAmount = toCents(pedido.efectivo_por_cobrar_centavos);
  const estado = pedido.estado_operativo;
  const phone = pedido.cliente?.telefono_e164;

  return (
    <article
      className={`card space-y-4 p-4 ${isPrimary ? "border-2 border-primary shadow-lg" : ""}`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Package className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-lg font-bold leading-tight text-foreground">
              {orderNumber(pedido)}
            </p>
            <p className="text-xs text-muted-foreground">
              {pedido.cliente?.nombre ?? "Cliente"} ·{" "}
              {estado === "REPARTIDOR_ASIGNADO"
                ? "Asignado"
                : estado === "REPARTIDOR_EN_RECOJO"
                  ? "En recojo"
                  : estado === "EN_CAMINO"
                    ? "En camino"
                    : estado}
            </p>
          </div>
        </div>
        <p className="text-lg font-bold text-foreground">{money(pedido.total_centavos)}</p>
      </header>

      {estado === "REPARTIDOR_ASIGNADO" || estado === "REPARTIDOR_EN_RECOJO" ? (
        <div className="space-y-3 rounded-xl bg-muted p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Store className="h-4 w-4 text-primary" aria-hidden />
            Recojo en: {pedido.sucursal?.nombre ?? "sucursal"}
          </p>
          {pedido.sucursal?.direccion ? (
            <p className="text-sm text-muted-foreground">{pedido.sucursal.direccion}</p>
          ) : null}
          <ul className="space-y-1 border-t border-border pt-2 text-sm text-foreground">
            {(pedido.items ?? []).map((item) => (
              <li key={item.id}>
                {item.cantidad}× {item.nombre_snapshot}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {estado === "EN_CAMINO" ? (
        <div className="space-y-3">
          <div className="rounded-xl bg-muted p-3">
            <p className="flex items-start gap-2 text-sm font-semibold text-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#EA580C]" aria-hidden />
              <span>
                {direccion.texto_direccion ?? "Dirección no registrada"}
                {direccion.referencia ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    Ref: {direccion.referencia}
                  </span>
                ) : null}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <a
              href={phone ? `tel:${phone}` : undefined}
              aria-disabled={!phone}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-primary text-sm font-bold transition-opacity ${
                phone
                  ? "cursor-pointer text-primary hover:opacity-80"
                  : "pointer-events-none border-border text-muted-foreground opacity-50"
              }`}
            >
              <Phone className="h-5 w-5" aria-hidden />
              Llamar
            </a>
            <a
              href={mapsUrl(pedido)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-on-primary transition-opacity hover:opacity-90"
            >
              <Navigation className="h-5 w-5" aria-hidden />
              Maps
            </a>
            <a
              href={wazeUrl(pedido)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-[#33CCFF] text-sm font-bold text-[#0EA5E9] transition-opacity hover:opacity-80"
            >
              <Bike className="h-5 w-5" aria-hidden />
              Waze
            </a>
          </div>

          {cash && cashAmount > 0 ? (
            <div className="rounded-xl border-2 border-[#059669] bg-[#059669]/10 p-4 text-center">
              <p className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#047857]">
                <Banknote className="h-4 w-4" aria-hidden />
                Cobrar en efectivo
              </p>
              <p className="text-3xl font-bold text-[#047857]">
                {money(pedido.efectivo_por_cobrar_centavos)}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        {estado === "REPARTIDOR_ASIGNADO" ? (
          <button
            type="button"
            onClick={() => onTransition("REPARTIDOR_EN_RECOJO")}
            disabled={busy}
            className="flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#EA580C] text-base font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Store className="h-6 w-6" aria-hidden />
            Voy al punto de recojo
          </button>
        ) : null}

        {estado === "REPARTIDOR_EN_RECOJO" ? (
          <button
            type="button"
            onClick={() => onTransition("EN_CAMINO")}
            disabled={busy}
            className="flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#EA580C] text-base font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Navigation className="h-6 w-6" aria-hidden />
            Recogido — Iniciar entrega
          </button>
        ) : null}

        {estado === "EN_CAMINO" ? (
          <button
            type="button"
            onClick={onDeliver}
            disabled={busy}
            className="flex min-h-[56px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#EA580C] text-base font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Spinner className="h-5 w-5" /> : <CheckCircle2 className="h-6 w-6" aria-hidden />}
            {cash && cashAmount > 0
              ? "Confirmar Cobro en Efectivo y Entrega"
              : "Confirmar Entrega"}
          </button>
        ) : null}

        {["REPARTIDOR_ASIGNADO", "REPARTIDOR_EN_RECOJO", "EN_CAMINO"].includes(estado) ? (
          <button
            type="button"
            onClick={onReportFailure}
            disabled={busy}
            className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-destructive text-sm font-bold text-destructive transition-opacity hover:bg-destructive/5 disabled:opacity-50"
          >
            <AlertTriangle className="h-5 w-5" aria-hidden />
            Reportar incidencia / entrega fallida
          </button>
        ) : null}
      </div>
    </article>
  );
}

function FailureModal({
  pedidoId,
  onClose,
  onSubmit,
}: {
  pedidoId: string;
  onClose: () => void;
  onSubmit: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (motivo.trim().length >= 3) onSubmit(motivo.trim());
  }

  return (
    <Modal title="Reportar entrega fallida" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4" data-pedido-id={pedidoId}>
        <div>
          <label htmlFor="motivo-falla" className="input-label">
            ¿Qué ocurrió? (obligatorio)
          </label>
          <textarea
            id="motivo-falla"
            className="input min-h-24 resize-y"
            placeholder="Ej. Cliente no responde al teléfono ni al timbre"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
            minLength={3}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            className="min-h-[48px] cursor-pointer rounded-lg bg-destructive px-6 font-bold text-on-destructive transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={motivo.trim().length < 3}
          >
            Reportar falla
          </button>
        </div>
      </form>
    </Modal>
  );
}
