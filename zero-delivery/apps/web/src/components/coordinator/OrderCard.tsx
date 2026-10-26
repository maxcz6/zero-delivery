"use client";

import { AlertTriangle, Banknote, Clock, Landmark } from "lucide-react";
import { formatPen } from "@zero-delivery/shared-types";
import type { Pedido } from "@/lib/types";
import { toCents } from "@/lib/api";
import {
  elapsedMinutes,
  ESTADO_LABEL,
  formatElapsed,
  isOrderFragile,
  orderNumber,
} from "@/lib/orders";
import { useNow } from "@/lib/useNow";
import { Badge } from "@/components/ui";

const PAYMENT_BADGE: Record<
  Pedido["metodo_pago"],
  { label: string; className: string }
> = {
  YAPE: { label: "Yape", className: "bg-[#7C3AED] text-white" },
  EFECTIVO: { label: "Efectivo", className: "bg-[#059669] text-white" },
  TRANSFERENCIA_BANCARIA: { label: "Transferencia", className: "bg-[#2563EB] text-white" },
};

export interface OrderCardActions {
  onValidateYape?: (pedido: Pedido) => void;
  onAssignRider?: (pedido: Pedido) => void;
  onRestaurantPayment?: (pedido: Pedido) => void;
}

export function OrderCard({
  pedido,
  alertMinutes,
  actions,
}: {
  pedido: Pedido;
  alertMinutes: number | null;
  actions: OrderCardActions;
}) {
  const now = useNow();
  const minutes = elapsedMinutes(pedido.creado_en, now);
  const isLate = alertMinutes !== null && minutes > alertMinutes;
  const payment = PAYMENT_BADGE[pedido.metodo_pago];
  const fragile = isOrderFragile(pedido);
  const itemCount = pedido.items?.length ?? 0;
  const pendingYape =
    pedido.metodo_pago !== "EFECTIVO" && pedido.estado_pago === "PENDIENTE";
  const canAssign =
    !pedido.repartidor_id &&
    ["NUEVO", "CONFIRMADO", "LISTO"].includes(pedido.estado_operativo);
  const canPayRestaurant =
    pedido.estado_pago_restaurante === "PENDIENTE" &&
    ["LISTO", "REPARTIDOR_ASIGNADO", "REPARTIDOR_EN_RECOJO", "EN_CAMINO"].includes(
      pedido.estado_operativo
    );

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", pedido.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="card cursor-grab space-y-2 p-3 active:cursor-grabbing hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">{orderNumber(pedido)}</p>
          <p className="truncate text-xs text-muted-foreground">
            {pedido.cliente?.nombre ?? "Cliente"} · {pedido.sucursal?.nombre ?? ""}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
            isLate
              ? "bg-[#EA580C]/15 text-[#C2410C]"
              : "bg-muted text-muted-foreground"
          }`}
          title={isLate ? "Pedido fuera de tiempo objetivo" : "Tiempo transcurrido"}
        >
          {isLate ? <AlertTriangle className="h-3 w-3" aria-hidden /> : <Clock className="h-3 w-3" aria-hidden />}
          {formatElapsed(minutes)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {payment ? (
          <Badge className={payment.className}>
            {pedido.metodo_pago === "EFECTIVO" ? (
              <Banknote className="h-3 w-3" aria-hidden />
            ) : null}
            {payment.label}
          </Badge>
        ) : null}
        {pedido.estado_pago === "PENDIENTE" ? (
          <Badge className="border border-warning/40 bg-warning/10 text-warning">
            Pago pendiente
          </Badge>
        ) : null}
        {fragile ? (
          <Badge className="border border-destructive/30 bg-destructive/5 text-destructive">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            Frágil
          </Badge>
        ) : null}
        <Badge className="bg-muted text-muted-foreground">
          {ESTADO_LABEL[pedido.estado_operativo]}
        </Badge>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-foreground">
          {formatPen(toCents(pedido.total_centavos))}
        </p>
        <p className="text-xs text-muted-foreground">
          {itemCount} {itemCount === 1 ? "ítem" : "ítems"}
        </p>
      </div>

      {pendingYape || canAssign || canPayRestaurant ? (
        <div className="flex flex-wrap gap-1.5 border-t border-border pt-2">
          {pendingYape && actions.onValidateYape ? (
            <button
              type="button"
              onClick={() => actions.onValidateYape?.(pedido)}
              className="min-h-[32px] cursor-pointer rounded-lg bg-[#7C3AED] px-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            >
              Validar pago
            </button>
          ) : null}
          {canAssign && actions.onAssignRider ? (
            <button
              type="button"
              onClick={() => actions.onAssignRider?.(pedido)}
              className="min-h-[32px] cursor-pointer rounded-lg bg-primary px-2.5 text-xs font-semibold text-on-primary transition-opacity hover:opacity-90"
            >
              Asignar repartidor
            </button>
          ) : null}
          {canPayRestaurant && actions.onRestaurantPayment ? (
            <button
              type="button"
              onClick={() => actions.onRestaurantPayment?.(pedido)}
              className="inline-flex min-h-[32px] cursor-pointer items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Landmark className="h-3 w-3" aria-hidden />
              Pago restaurante
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
