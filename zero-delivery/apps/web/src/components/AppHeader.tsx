"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ExternalLink,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Power,
  UserCircle,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { fetchMe, ROLE_LABEL } from "@/lib/auth";
import { useUiStore } from "@/store/ui-store";

interface BotOverviewHeader {
  conexion: {
    enabled: boolean;
    autoAssignRider: boolean;
    voceroReachable: boolean;
  };
  estadisticas: {
    alertas_pendientes: number;
    decisiones_automaticas: number;
    escalados_humano: number;
  };
  alertas_activas: Array<{
    id: string;
    tipo: string;
    severidad: "INFO" | "ADVERTENCIA" | "CRITICO";
    estado: "ABIERTA" | "RECONOCIDA" | "RESUELTA";
    pedido_id: string | null;
    pedido_numero: string | null;
    sucursal_nombre: string | null;
    datos: {
      cliente_nombre?: string;
      cliente_telefono?: string;
      mensaje_cliente?: string;
      motivo_escalado?: string;
      sugerencia_accion?: string;
    };
    creado_en: string;
  }>;
}

/** Barra superior de cada pantalla: botón de menú, interruptor rápido del Bot, campana de alertas de indecisión del Bot y accesos. */
export function AppHeader({ title }: { title: string }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const expanded = useUiStore((s) => s.expanded);
  const toggle = useUiStore((s) => s.toggle);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const { data: actor } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    staleTime: 5 * 60_000,
  });

  const canSeeMetrics = actor?.role === "ADMIN" || actor?.role === "COORDINATOR";
  const canSeeBot =
    actor?.role === "ADMIN" ||
    actor?.role === "COORDINATOR" ||
    actor?.role === "SUPPORT_AGENT";

  const { data: botOverview } = useQuery({
    queryKey: ["vocero-bot-overview"],
    queryFn: () =>
      api.get<{ ok: boolean; data: BotOverviewHeader }>(
        "/integrations/vocero/overview"
      ),
    enabled: Boolean(canSeeBot),
    refetchInterval: 8_000,
  });

  const toggleBotMutation = useMutation({
    mutationFn: (nextEnabled: boolean) =>
      api.patch("/integrations/vocero/toggle", { enabled: nextEnabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vocero-bot-overview"] });
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: (alertId: string) =>
      api.post(`/integrations/vocero/alerts/${alertId}/resolve`, {
        nota: "Resuelto desde la campana de notificaciones",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vocero-bot-overview"] });
    },
  });

  const botData = botOverview?.data;
  const openAlerts = (botData?.alertas_activas ?? []).filter(
    (a) => a.estado === "ABIERTA"
  );
  const botEnabled = botData?.conexion?.enabled ?? true;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            aria-label={expanded ? "Contraer barra lateral" : "Expandir barra lateral"}
            aria-expanded={expanded}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:border-primary hover:bg-muted hover:text-primary"
          >
            <Menu className="h-5 w-5 lg:hidden" aria-hidden />
            {expanded ? (
              <PanelLeftClose className="hidden h-5 w-5 lg:block" aria-hidden />
            ) : (
              <PanelLeftOpen className="hidden h-5 w-5 lg:block" aria-hidden />
            )}
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-foreground">
              {title}
            </p>
            <p className="truncate text-xs leading-tight text-muted-foreground">
              Zero Delivery
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón rápido de estado / encendido del Bot Vocero CRM (Admin / Coordinador) */}
          {canSeeBot && botData ? (
            <div className="hidden items-center gap-1.5 rounded-xl border border-border bg-muted/50 p-1 md:flex">
              <Link
                href="/bot"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold text-foreground transition-colors hover:bg-card"
                title="Abrir Centro de Control del Bot y Vocero CRM"
              >
                <Bot className="h-4 w-4 text-primary" aria-hidden />
                <span>Bot CRM:</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                    botEnabled
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-rose-500/15 text-rose-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      botEnabled ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                    }`}
                  />
                  {botEnabled ? "CONECTADO" : "APAGADO"}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => toggleBotMutation.mutate(!botEnabled)}
                disabled={toggleBotMutation.isPending}
                title={
                  botEnabled
                    ? "Apagar conexión con el Bot de Vocero CRM"
                    : "Encender conexión con el Bot de Vocero CRM"
                }
                className={`flex h-7 cursor-pointer items-center gap-1 rounded-lg px-2 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                  botEnabled
                    ? "bg-rose-600 text-white hover:bg-rose-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                <Power className="h-3.5 w-3.5" aria-hidden />
                {botEnabled ? "Apagar" : "Encender"}
              </button>
            </div>
          ) : null}

          {/* Campana de Notificaciones de Indecisión del Bot para Coordinador y Admin */}
          {canSeeBot ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAlertsOpen((v) => !v)}
                aria-label="Notificaciones de decisiones pendientes del Bot"
                className={`relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border transition-colors ${
                  openAlerts.length > 0
                    ? "border-amber-500/60 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                <Bell className="h-4 w-4" aria-hidden />
                {openAlerts.length > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white shadow">
                    {openAlerts.length}
                  </span>
                ) : null}
              </button>

              {alertsOpen ? (
                <div className="fixed inset-x-3 top-16 z-50 rounded-2xl border border-border bg-card p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[420px]">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
                      <div>
                        <p className="text-xs font-extrabold uppercase tracking-wide text-foreground">
                          Alertas del Bot Vocero CRM
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Casos donde el Bot requiere decisión del Coordinador o Admin
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlertsOpen(false)}
                      className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 max-h-80 space-y-2.5 overflow-y-auto pr-1">
                    {openAlerts.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-5 text-center">
                        <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
                        <p className="mt-1.5 text-xs font-bold text-foreground">
                          Sin decisiones pendientes
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          El Bot está resolviendo las consultas y pedidos automáticamente.
                        </p>
                      </div>
                    ) : (
                      openAlerts.map((alerta) => (
                        <div
                          key={alerta.id}
                          className={`rounded-xl border p-3 ${
                            alerta.severidad === "CRITICO"
                              ? "border-rose-500/40 bg-rose-500/5"
                              : "border-amber-500/40 bg-amber-500/5"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                alerta.severidad === "CRITICO"
                                  ? "bg-rose-600 text-white"
                                  : "bg-amber-600 text-white"
                              }`}
                            >
                              {alerta.tipo.replace(/^BOT_/, "").replace(/_/g, " ")}
                            </span>
                            {alerta.pedido_numero ? (
                              <span className="font-mono text-xs font-extrabold text-primary">
                                Pedido {alerta.pedido_numero}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1.5 text-xs font-bold text-foreground">
                            {alerta.datos?.cliente_nombre || "Cliente WhatsApp"}{" "}
                            {alerta.datos?.cliente_telefono ? (
                              <span className="font-mono text-[11px] font-normal text-muted-foreground">
                                ({alerta.datos.cliente_telefono})
                              </span>
                            ) : null}
                          </p>

                          {alerta.datos?.mensaje_cliente ? (
                            <p className="mt-1 rounded-lg bg-card/80 px-2.5 py-1.5 text-xs italic text-foreground">
                              “{alerta.datos.mensaje_cliente}”
                            </p>
                          ) : null}

                          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                            {alerta.datos?.motivo_escalado}
                          </p>

                          <div className="mt-2.5 flex items-center justify-end gap-2">
                            <Link
                              href="/bot"
                              onClick={() => setAlertsOpen(false)}
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-muted"
                            >
                              Ver en Bot CRM
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => resolveAlertMutation.mutate(alerta.id)}
                              disabled={resolveAlertMutation.isPending}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-bold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Resolver
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5">
                    <span className="text-[11px] text-muted-foreground">
                      Historial y KPIs del Bot
                    </span>
                    <Link
                      href="/bot"
                      onClick={() => setAlertsOpen(false)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      Abrir Centro de Control del Bot →
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {actor ? (
            <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary sm:inline-flex">
              {ROLE_LABEL[actor.role] ?? actor.role}
            </span>
          ) : null}
          {canSeeMetrics ? (
            <Link
              href="/metrics"
              aria-label="Métricas"
              className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-colors hover:border-primary hover:text-primary ${
                pathname === "/metrics"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
          <Link
            href="/profile"
            aria-label="Mi cuenta"
            className={`flex h-11 w-11 items-center justify-center rounded-lg border transition-colors hover:border-primary hover:text-primary ${
              pathname === "/profile"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            <UserCircle className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      {/* Banner superior de alerta inmediata si el Bot tiene decisiones críticas pendientes */}
      {canSeeBot && openAlerts.length > 0 && pathname !== "/bot" ? (
        <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-1.5">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 font-semibold text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                <strong>Atención Coordinador / Admin:</strong> El Bot de Vocero CRM tiene{" "}
                <strong>{openAlerts.length}</strong>{" "}
                {openAlerts.length === 1
                  ? "caso donde no pudo tomar una decisión"
                  : "casos donde no pudo tomar una decisión"}{" "}
                y requiere tu validación.
              </span>
            </div>
            <Link
              href="/bot"
              className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-amber-700"
            >
              Revisar decisiones e historial del Bot →
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
