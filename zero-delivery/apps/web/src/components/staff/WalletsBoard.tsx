"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Wallet,
} from "lucide-react";
import { api, ApiError, money, toCents } from "@/lib/api";
import type {
  ApiResponse,
  MovimientoBilletera,
  Repartidor,
  WalletInfo,
} from "@/lib/types";
import { Badge, EmptyState, ErrorNote, PageLoader } from "@/components/ui";

const TIPO_LABEL: Record<MovimientoBilletera["tipo"], string> = {
  DEPOSITO_GARANTIA: "Depósito de garantía",
  RETIRO_GARANTIA: "Retiro de garantía",
  EFECTIVO_COBRADO: "Efectivo cobrado",
  EFECTIVO_LIQUIDADO: "Efectivo liquidado",
  AJUSTE: "Ajuste",
};

export function WalletsBoard() {
  const ridersQuery = useQuery({
    queryKey: ["riders"],
    queryFn: () => api.get<ApiResponse<Repartidor[]>>("/logistics/riders"),
    refetchInterval: 30_000,
  });

  const riders = ridersQuery.data?.data ?? [];

  const wallets = useQueries({
    queries: riders.map((rider) => ({
      queryKey: ["wallet", rider.id],
      queryFn: () =>
        api.get<ApiResponse<WalletInfo>>(`/logistics/riders/${rider.id}/wallet`),
      staleTime: 30_000,
    })),
  });

  if (ridersQuery.isLoading) return <PageLoader label="Cargando billeteras…" />;
  if (ridersQuery.isError) {
    return (
      <ErrorNote
        message={
          ridersQuery.error instanceof ApiError
            ? ridersQuery.error.message
            : "No se pudo conectar con la API"
        }
      />
    );
  }

  const saldos = wallets
    .map((w) => w.data?.data)
    .filter((w): w is WalletInfo => Boolean(w));
  const saldoTotal = saldos.reduce((acc, w) => acc + toCents(w.saldo_centavos), 0);
  const conDeuda = saldos.filter((w) => w.tiene_deuda).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Wallet className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Saldo total en garantías</p>
            <p className="text-xl font-bold text-foreground">{money(saldoTotal)}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Repartidores con deuda</p>
            <p className="text-xl font-bold text-foreground">{conDeuda}</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BookOpen className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Billeteras monitoreadas</p>
            <p className="text-xl font-bold text-foreground">{riders.length}</p>
          </div>
        </div>
      </div>

      {riders.length === 0 ? (
        <EmptyState title="Sin repartidores registrados" />
      ) : (
        <ul className="space-y-3">
          {riders.map((rider, index) => {
            const wallet = wallets[index]?.data?.data;
            return (
              <li key={rider.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-foreground">{rider.nombre_completo}</p>
                    <p className="text-xs text-muted-foreground">
                      {rider.telefono} · {rider.tipo_vehiculo === "MOTO" ? "Moto" : "Auto"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {wallet?.tiene_deuda ? (
                      <Badge className="border border-destructive/40 bg-destructive/10 text-destructive">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Deuda activa
                      </Badge>
                    ) : (
                      <Badge className="bg-success/10 text-success">Sin deuda</Badge>
                    )}
                    <span
                      className={`text-lg font-bold ${
                        wallet?.tiene_deuda ? "text-destructive" : "text-foreground"
                      }`}
                    >
                      {wallet ? money(wallet.saldo_centavos) : "—"}
                    </span>
                  </div>
                </div>

                {wallet && wallet.movimientos.length > 0 ? (
                  <details className="group mt-3 border-t border-border pt-2">
                    <summary className="flex min-h-[40px] cursor-pointer items-center text-sm font-semibold text-primary">
                      Ver libro mayor ({wallet.movimientos.length})
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-2 font-semibold">Fecha</th>
                            <th className="px-2 py-2 font-semibold">Tipo</th>
                            <th className="px-2 py-2 font-semibold">Motivo</th>
                            <th className="px-2 py-2 text-right font-semibold">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {wallet.movimientos.map((mov) => {
                            const monto = toCents(mov.monto_centavos);
                            const negativo = monto < 0;
                            return (
                              <tr key={mov.id} className="border-b border-border last:border-0">
                                <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                                  {new Date(mov.creado_en).toLocaleDateString("es-PE", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                  })}
                                </td>
                                <td className="px-2 py-2 text-foreground">
                                  <span className="inline-flex items-center gap-1">
                                    {negativo ? (
                                      <ArrowUpRight
                                        className="h-3.5 w-3.5 text-destructive"
                                        aria-hidden
                                      />
                                    ) : (
                                      <ArrowDownLeft
                                        className="h-3.5 w-3.5 text-success"
                                        aria-hidden
                                      />
                                    )}
                                    {TIPO_LABEL[mov.tipo] ?? mov.tipo}
                                  </span>
                                </td>
                                <td className="px-2 py-2 text-muted-foreground">
                                  {mov.motivo ?? "—"}
                                </td>
                                <td
                                  className={`whitespace-nowrap px-2 py-2 text-right font-semibold ${
                                    negativo ? "text-destructive" : "text-success"
                                  }`}
                                >
                                  {money(monto)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ) : (
                  <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
                    Sin movimientos registrados.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
