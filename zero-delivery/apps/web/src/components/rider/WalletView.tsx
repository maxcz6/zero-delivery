"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  CalendarCheck,
  Landmark,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import { api, ApiError, money, toCents } from "@/lib/api";
import type { ApiResponse, MovimientoBilletera, TipoMovimiento, WalletInfo } from "@/lib/types";
import { fetchMe } from "@/lib/auth";
import { EmptyState, ErrorNote, PageLoader } from "@/components/ui";

const MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  DEPOSITO_GARANTIA: "Depósito de garantía",
  RETIRO_GARANTIA: "Retiro de garantía",
  EFECTIVO_COBRADO: "Efectivo cobrado en entrega",
  EFECTIVO_LIQUIDADO: "Liquidación de efectivo",
  AJUSTE: "Ajuste",
};

function MovimientoIcon({ tipo }: { tipo: TipoMovimiento }) {
  switch (tipo) {
    case "DEPOSITO_GARANTIA":
      return <Landmark className="h-5 w-5 text-primary" aria-hidden />;
    case "RETIRO_GARANTIA":
      return <SlidersHorizontal className="h-5 w-5 text-muted-foreground" aria-hidden />;
    case "EFECTIVO_COBRADO":
      return <Banknote className="h-5 w-5 text-[#EA580C]" aria-hidden />;
    case "EFECTIVO_LIQUIDADO":
      return <CalendarCheck className="h-5 w-5 text-[#059669]" aria-hidden />;
    case "AJUSTE":
      return <SlidersHorizontal className="h-5 w-5 text-muted-foreground" aria-hidden />;
  }
}

function isToday(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function WalletView() {
  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, staleTime: 5 * 60_000 });
  const riderId = meQuery.data?.riderId;

  const walletQuery = useQuery({
    queryKey: ["wallet", riderId],
    queryFn: () => api.get<ApiResponse<WalletInfo>>(`/logistics/riders/${riderId}/wallet`),
    enabled: Boolean(riderId),
    refetchInterval: 30_000,
  });

  if (meQuery.isLoading || walletQuery.isLoading) {
    return <PageLoader label="Cargando tu billetera…" />;
  }

  if (!riderId) {
    return (
      <EmptyState
        title="Tu usuario no está vinculado a un repartidor"
        hint="Contacta al coordinador para activar tu billetera."
      />
    );
  }

  if (walletQuery.isError) {
    return (
      <ErrorNote
        message={
          walletQuery.error instanceof ApiError
            ? walletQuery.error.message
            : "No se pudo cargar la billetera"
        }
      />
    );
  }

  const wallet = walletQuery.data?.data;
  if (!wallet) return <EmptyState title="Billetera no disponible" />;

  const saldo = toCents(wallet.saldo_centavos);
  const movimientos = wallet.movimientos ?? [];
  const deHoy = movimientos.filter((m) => isToday(m.creado_en));
  const cobradoHoy = deHoy
    .filter((m) => m.tipo === "EFECTIVO_COBRADO")
    .reduce((acc, m) => acc + toCents(m.monto_centavos), 0);
  const liquidadoHoy = deHoy
    .filter((m) => m.tipo === "EFECTIVO_LIQUIDADO")
    .reduce((acc, m) => acc + toCents(m.monto_centavos), 0);

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          <Wallet className="h-4 w-4" aria-hidden />
          Saldo actual
        </p>
        <p
          className={`mt-1 text-4xl font-bold ${saldo < 0 ? "text-destructive" : "text-foreground"}`}
        >
          {money(wallet.saldo_centavos)}
        </p>
        {wallet.tiene_deuda ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Tienes deuda activa por efectivo cobrado pendiente de liquidación. Entrega el
              efectivo al coordinador para regularizar tu saldo.
            </span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Sin deudas activas. Tu garantía está al día.
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ArrowDownCircle className="h-4 w-4 text-[#EA580C]" aria-hidden />
            Cobrado hoy
          </p>
          <p className="mt-1 text-lg font-bold text-foreground">{money(Math.abs(cobradoHoy))}</p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <ArrowUpCircle className="h-4 w-4 text-[#059669]" aria-hidden />
            Liquidado hoy
          </p>
          <p className="mt-1 text-lg font-bold text-foreground">{money(liquidadoHoy)}</p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Historial de movimientos
        </h2>
        {movimientos.length === 0 ? (
          <EmptyState title="Aún no tienes movimientos" />
        ) : (
          <ul className="space-y-2">
            {movimientos.map((mov) => {
              const monto = toCents(mov.monto_centavos);
              return (
                <li key={mov.id} className="card flex items-center gap-3 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <MovimientoIcon tipo={mov.tipo} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {MOVIMIENTO_LABEL[mov.tipo] ?? mov.tipo}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(mov.creado_en).toLocaleString("es-PE", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {mov.motivo ? ` · ${mov.motivo}` : ""}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-sm font-bold ${
                      monto < 0 ? "text-destructive" : "text-[#059669]"
                    }`}
                  >
                    {monto < 0 ? "−" : "+"}
                    {money(Math.abs(monto))}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
