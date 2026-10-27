"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Bike,
  Bot,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  Package,
  ShieldCheck,
  Store,
  TrendingUp,
} from "lucide-react";
import { api, money } from "@/lib/api";
import { AppHeader } from "@/components/AppHeader";
import { PageLoader, ErrorNote } from "@/components/ui";

/** Respuesta real de GET /orders/stats/overview (camelCase, contadores del inquilino). */
interface StatsOverview {
  activeOrdersCount: number;
  deliveredOrdersCount: number;
  totalOrdersCount: number;
  totalSalesCents: number;
  totalSalesSoles: number;
  activeRidersCount: number;
  cashOrdersCount: number;
  yapeOrdersCount: number;
}

interface ReportsSummaryData {
  sucursales: Array<{
    id: string;
    nombre: string;
    slug: string;
    direccion: string;
    abierta: boolean;
    total_pedidos: number;
    pedidos_entregados: number;
    ventas_centavos: string;
    ventas_soles: string;
  }>;
  totales: {
    registros_auditoria: number;
    decisiones_bot: number;
  };
}

export default function MetricsPage() {
  const statsQuery = useQuery({
    queryKey: ["stats", "overview"],
    queryFn: () => api.get<{ ok: boolean; data: StatsOverview }>("/orders/stats/overview"),
    refetchInterval: 15_000,
  });

  const reportsSummaryQuery = useQuery({
    queryKey: ["reports", "summary"],
    queryFn: () => api.get<{ ok: boolean; data: ReportsSummaryData }>("/reports/summary"),
    refetchInterval: 20_000,
  });

  const stats = statsQuery.data?.data;
  const reportsSummary = reportsSummaryQuery.data?.data;

  if (statsQuery.isLoading) {
    return (
      <div className="min-h-dvh bg-background">
        <AppHeader title="Métricas y Rendimiento" />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <PageLoader label="Calculando métricas del día…" />
        </main>
      </div>
    );
  }

  if (statsQuery.isError || !stats) {
    return (
      <div className="min-h-dvh bg-background">
        <AppHeader title="Métricas y Rendimiento" />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <ErrorNote message="No se pudieron cargar las estadísticas operacionales." />
        </main>
      </div>
    );
  }

  const total = stats.totalOrdersCount || 0;
  const entregados = stats.deliveredOrdersCount || 0;
  const activos = stats.activeOrdersCount || 0;
  const efectivo = stats.cashOrdersCount || 0;
  const yape = stats.yapeOrdersCount || 0;
  const otros = Math.max(total - efectivo - yape, 0);

  const completionRate = total > 0 ? Math.round((entregados / total) * 100) : 0;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const efectivoPct = pct(efectivo);
  const yapePct = pct(yape);
  const otrosPct = Math.max(100 - efectivoPct - yapePct, 0);

  return (
    <div className="min-h-dvh bg-background pb-12">
      <AppHeader title="Métricas y Rendimiento" />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {/* Cabecera con indicador de tiempo real */}
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              Tablero de Control Operacional
            </h1>
            <p className="text-xs text-muted-foreground">
              Indicadores clave de ventas, flota y entregas del inquilino
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Actualización cada 15s
          </span>
        </div>

        {/* KPIs principales */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Ventas Totales
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <DollarSign className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-2xl font-black text-foreground">{money(stats.totalSalesCents)}</p>
            <p className="mt-1 flex items-center text-xs font-semibold text-emerald-600">
              <TrendingUp className="mr-1 h-3.5 w-3.5" aria-hidden />
              Facturado en soles
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pedidos en Curso
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Package className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-2xl font-black text-foreground">{activos}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {total} pedidos registrados
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Tasa de Entrega
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-2xl font-black text-foreground">{completionRate}%</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {entregados} entregados · {activos} activos
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Flota Activa
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
                <Bike className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <p className="mt-3 text-2xl font-black text-foreground">{stats.activeRidersCount}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Repartidores activos</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Métodos de pago */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Canales de Recaudación</h2>
              <span className="text-xs text-muted-foreground">Pedidos por método</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex h-4 w-full overflow-hidden rounded-lg bg-muted" role="img" aria-label={`Efectivo ${efectivoPct}%, Yape ${yapePct}%, otros ${otrosPct}%`}>
                <div className="bg-emerald-600 transition-all duration-500" style={{ width: `${efectivoPct}%` }} />
                <div className="bg-yape transition-all duration-500" style={{ width: `${yapePct}%` }} />
                <div className="bg-muted-foreground/30 transition-all duration-500" style={{ width: `${otrosPct}%` }} />
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-semibold text-emerald-700">
                  <Banknote className="h-3.5 w-3.5" aria-hidden /> Efectivo: {efectivoPct}%
                </span>
                <span className="flex items-center gap-1 font-semibold text-yape">
                  <CreditCard className="h-3.5 w-3.5" aria-hidden /> Yape: {yapePct}%
                </span>
                {otros > 0 ? <span className="font-semibold">Otros: {otrosPct}%</span> : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Contra entrega
                </p>
                <p className="mt-1 text-lg font-black text-emerald-900">{efectivo} pedidos</p>
                <p className="text-[11px] text-emerald-700/80">Cobro en efectivo al recibir</p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-3.5">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-700">
                  Yape / Digital
                </p>
                <p className="mt-1 text-lg font-black text-violet-900">{yape} pedidos</p>
                <p className="text-[11px] text-violet-700/80">Comprobante por validar</p>
              </div>
            </div>
          </section>

          {/* Resumen operativo */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-foreground">Resumen Operativo</h2>
              <span className="text-xs text-muted-foreground">Estado actual</span>
            </div>

            <dl className="divide-y divide-border">
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Pedidos registrados</dt>
                <dd className="text-sm font-bold text-foreground">{total}</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Activos (en curso)</dt>
                <dd className="text-sm font-bold text-foreground">{activos}</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Entregados</dt>
                <dd className="text-sm font-bold text-foreground">{entregados}</dd>
              </div>
              <div className="flex items-center justify-between py-3">
                <dt className="text-sm text-muted-foreground">Repartidores activos</dt>
                <dd className="text-sm font-bold text-foreground">{stats.activeRidersCount}</dd>
              </div>
            </dl>

            <p className="rounded-lg bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
              Ticket promedio:{" "}
              <b className="text-foreground">
                {money(total > 0 ? Math.round(stats.totalSalesCents / total) : 0)}
              </b>{" "}
              por pedido.
            </p>
          </section>
        </div>

        {/* HITO 5: EXPORTACIÓN DE REPORTES ADMINISTRATIVOS CSV (COMPATIBLES CON EXCEL UTF-8 BOM) */}
        <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-foreground">
                  Exportar Reportes Administrativos CSV (Compatible con Excel)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Todos los reportes incluyen encabezado UTF-8 BOM (`\uFEFF`) para abrir tildes y
                  montos en soles (`S/`) directamente en Microsoft Excel sin distorsión.
                </p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Hito 5 · Reportería Financiera y Operativa
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="/api/v1/reports/sales.csv"
              download="reporte_ventas_sucursales.csv"
              className="group flex flex-col justify-between rounded-xl border border-border bg-muted/30 p-4 transition-all hover:border-primary hover:bg-primary/5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Store className="h-5 w-5 text-primary" />
                  <Download className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-y-0.5 group-hover:text-primary" />
                </div>
                <p className="mt-2.5 text-sm font-extrabold text-foreground">
                  1. Ventas por Sucursal
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Desglose de pedidos, clientes, canales y montos en S/ por cada sucursal
                  independiente.
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
                Descargar CSV (Excel) →
              </span>
            </a>

            <a
              href="/api/v1/reports/settlements.csv"
              download="reporte_liquidaciones_repartidores.csv"
              className="group flex flex-col justify-between rounded-xl border border-border bg-muted/30 p-4 transition-all hover:border-indigo-500 hover:bg-indigo-500/5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Bike className="h-5 w-5 text-indigo-600" />
                  <Download className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-y-0.5 group-hover:text-indigo-600" />
                </div>
                <p className="mt-2.5 text-sm font-extrabold text-foreground">
                  2. Liquidaciones y Garantías
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Saldos de garantía en billetera, elegibilidad contra entrega, estrellas y
                  comisiones de flota.
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-indigo-600">
                Descargar CSV (Excel) →
              </span>
            </a>

            <a
              href="/api/v1/reports/audit.csv"
              download="reporte_auditoria_inmutable.csv"
              className="group flex flex-col justify-between rounded-xl border border-border bg-muted/30 p-4 transition-all hover:border-emerald-500 hover:bg-emerald-500/5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  <Download className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-y-0.5 group-hover:text-emerald-600" />
                </div>
                <p className="mt-2.5 text-sm font-extrabold text-foreground">
                  3. Bitácora de Auditoría
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Registro inmutable (`registro_auditoria`,{" "}
                  {reportsSummary?.totales?.registros_auditoria ?? 0} eventos) protegido por
                  triggers PostgreSQL.
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                Descargar CSV (Excel) →
              </span>
            </a>

            <a
              href="/api/v1/reports/bot.csv"
              download="reporte_decisiones_bot_vocero.csv"
              className="group flex flex-col justify-between rounded-xl border border-border bg-muted/30 p-4 transition-all hover:border-amber-500 hover:bg-amber-500/5"
            >
              <div>
                <div className="flex items-center justify-between">
                  <Bot className="h-5 w-5 text-amber-600" />
                  <Download className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-y-0.5 group-hover:text-amber-600" />
                </div>
                <p className="mt-2.5 text-sm font-extrabold text-foreground">
                  4. Decisiones Bot Vocero
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Historial de despachos, pedidos tomados por IA, repartidores asignados y alertas (
                  {reportsSummary?.totales?.decisiones_bot ?? 0} turnos).
                </p>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                Descargar CSV (Excel) →
              </span>
            </a>
          </div>
        </section>

        {/* DESGLOSE DE VENTAS POR SUCURSAL INDEPENDIENTE */}
        {reportsSummary?.sucursales && reportsSummary.sucursales.length > 0 ? (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-base font-extrabold text-foreground">
                  Rendimiento por Sucursal Independiente
                </h2>
                <p className="text-xs text-muted-foreground">
                  Cada sucursal opera con su propia carta, precios y contabilidad de pedidos
                </p>
              </div>
              <span className="text-xs font-bold text-muted-foreground">
                {reportsSummary.sucursales.length} sucursales activas
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {reportsSummary.sucursales.map((suc) => (
                <div
                  key={suc.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-muted/20 p-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
                        <Store className="h-4 w-4 shrink-0" aria-hidden />
                        {suc.nombre}
                      </p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          suc.abierta
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-rose-500/15 text-rose-700"
                        }`}
                      >
                        {suc.abierta ? "Abierta" : "Cerrada"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{suc.direccion}</p>
                  </div>

                  <div className="mt-3 flex items-end justify-between border-t border-border pt-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        Pedidos: <strong>{suc.total_pedidos}</strong> ({suc.pedidos_entregados}{" "}
                        entregados)
                      </p>
                      <a
                        href={`/api/v1/reports/sales.csv?sucursal_id=${encodeURIComponent(suc.id)}`}
                        download={`ventas_${suc.slug}.csv`}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                      >
                        <Download className="h-3 w-3" />
                        Exportar CSV de esta sucursal
                      </a>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        Ventas
                      </p>
                      <p className="font-mono text-base font-black text-foreground">
                        {suc.ventas_soles}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
