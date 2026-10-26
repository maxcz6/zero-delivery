"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight, Banknote, CheckCircle2, Landmark, ReceiptText } from "lucide-react";
import { api, ApiError, money, toCents } from "@/lib/api";
import type { ApiResponse, Pedido } from "@/lib/types";
import { ESTADO_LABEL, orderNumber } from "@/lib/orders";
import { Badge, EmptyState, ErrorNote, PageLoader } from "@/components/ui";
import { YapeModal } from "@/components/coordinator/YapeModal";
import { RestaurantPaymentModal } from "@/components/coordinator/RestaurantPaymentModal";

const METODO_LABEL: Record<Pedido["metodo_pago"], string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  TRANSFERENCIA_BANCARIA: "Transferencia",
};

const METODO_BADGE: Record<Pedido["metodo_pago"], string> = {
  EFECTIVO: "bg-[#059669] text-white",
  YAPE: "bg-[#7C3AED] text-white",
  TRANSFERENCIA_BANCARIA: "bg-[#2563EB] text-white",
};

type Filtro = "cobros" | "liquidaciones" | "todos";
type ModalState = { type: "cobro" | "liquidacion"; pedidoId: string } | null;

export function PaymentsBoard({ compact = false }: { compact?: boolean }) {
  const [filtro, setFiltro] = useState<Filtro>("cobros");
  const [modal, setModal] = useState<ModalState>(null);

  const ordersQuery = useQuery({
    queryKey: ["orders", "active", "payments"],
    queryFn: () => api.get<ApiResponse<Pedido[]>>("/orders/active"),
    refetchInterval: 15_000,
  });

  const pedidos = ordersQuery.data?.data ?? [];

  const cobros = useMemo(
    () =>
      pedidos.filter(
        (p) => p.metodo_pago !== "EFECTIVO" && p.estado_pago === "PENDIENTE"
      ),
    [pedidos]
  );

  const liquidaciones = useMemo(
    () =>
      pedidos.filter(
        (p) =>
          p.estado_pago_restaurante === "PENDIENTE" &&
          [
            "LISTO",
            "REPARTIDOR_ASIGNADO",
            "REPARTIDOR_EN_RECOJO",
            "EN_CAMINO",
          ].includes(p.estado_operativo)
      ),
    [pedidos]
  );

  const montoCobros = cobros.reduce((acc, p) => acc + toCents(p.total_centavos), 0);

  const filas =
    filtro === "cobros" ? cobros : filtro === "liquidaciones" ? liquidaciones : pedidos;

  if (ordersQuery.isLoading) return <PageLoader label="Cargando pagos…" />;
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={<ReceiptText className="h-5 w-5" aria-hidden />}
          label="Cobros por validar"
          value={String(cobros.length)}
        />
        <Kpi
          icon={<Banknote className="h-5 w-5" aria-hidden />}
          label="Monto por validar"
          value={money(montoCobros)}
        />
        <Kpi
          icon={<Landmark className="h-5 w-5" aria-hidden />}
          label="Liquidaciones pendientes"
          value={String(liquidaciones.length)}
        />
        <Kpi
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden />}
          label="Pedidos activos"
          value={String(pedidos.length)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["cobros", "Cobros digitales"],
              ["liquidaciones", "Pagos al restaurante"],
              ["todos", "Todos"],
            ] as [Filtro, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltro(key)}
              aria-pressed={filtro === key}
              className={`min-h-[40px] cursor-pointer rounded-md px-3 text-sm font-semibold transition-colors ${
                filtro === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {!compact ? (
          <Link
            href="/coordinator"
            className="inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Ir al tablero de despacho
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        ) : null}
      </div>

      {filas.length === 0 ? (
        <EmptyState
          title="Sin pagos pendientes"
          hint="Cuando llegue un comprobante digital o una liquidación, aparecerá aquí."
        />
      ) : (
        <ul className="space-y-3">
          {filas.map((pedido) => {
            const cobroPendiente =
              pedido.metodo_pago !== "EFECTIVO" && pedido.estado_pago === "PENDIENTE";
            const liquidacionPendiente =
              pedido.estado_pago_restaurante === "PENDIENTE" &&
              [
                "LISTO",
                "REPARTIDOR_ASIGNADO",
                "REPARTIDOR_EN_RECOJO",
                "EN_CAMINO",
              ].includes(pedido.estado_operativo);
            return (
              <li key={pedido.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-bold text-foreground">
                      {orderNumber(pedido)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {pedido.cliente?.nombre ?? "Cliente"} ·{" "}
                      {pedido.sucursal?.nombre ?? "Sucursal"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={METODO_BADGE[pedido.metodo_pago]}>
                      {METODO_LABEL[pedido.metodo_pago]}
                    </Badge>
                    <Badge className="bg-muted text-muted-foreground">
                      {ESTADO_LABEL[pedido.estado_operativo]}
                    </Badge>
                    <Badge
                      className={
                        pedido.estado_pago === "PAGADO"
                          ? "bg-success/10 text-success"
                          : "bg-warning/10 text-warning"
                      }
                    >
                      Pago {pedido.estado_pago.toLowerCase()}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Total del pedido</p>
                    <p className="text-lg font-bold text-foreground">
                      {money(pedido.total_centavos)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cobroPendiente ? (
                      <button
                        type="button"
                        onClick={() => setModal({ type: "cobro", pedidoId: pedido.id })}
                        className={`min-h-[44px] cursor-pointer rounded-lg px-4 text-sm font-bold transition-opacity hover:opacity-90 ${
                          pedido.metodo_pago === "YAPE"
                            ? "bg-[#7C3AED] text-white"
                            : "bg-primary text-on-primary"
                        }`}
                      >
                        Validar {METODO_LABEL[pedido.metodo_pago]}
                      </button>
                    ) : null}
                    {liquidacionPendiente ? (
                      <button
                        type="button"
                        onClick={() =>
                          setModal({ type: "liquidacion", pedidoId: pedido.id })
                        }
                        className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        <Landmark className="h-4 w-4" aria-hidden />
                        Pagar restaurante
                      </button>
                    ) : null}
                    {!cobroPendiente && !liquidacionPendiente ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                        Sin acciones pendientes
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modal?.type === "cobro" ? (
        <YapeModal pedidoId={modal.pedidoId} onClose={() => setModal(null)} />
      ) : null}
      {modal?.type === "liquidacion" ? (
        <RestaurantPaymentModal
          pedidoId={modal.pedidoId}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-bold leading-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}
