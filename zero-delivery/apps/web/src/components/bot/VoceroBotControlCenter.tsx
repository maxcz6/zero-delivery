"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bike,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  Drumstick,
  ExternalLink,
  History,
  MessageSquare,
  Play,
  Power,
  RefreshCw,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";

interface BotOverviewData {
  conexion: {
    enabled: boolean;
    autoAssignRider: boolean;
    autoConfirmCash: boolean;
    voceroBaseUrl: string;
    apiKeyConfigured: boolean;
    voceroReachable: boolean;
    voceroHealthDetail?: string;
    webhookEndpoint: string;
    healthEndpoint: string;
  };
  estadisticas: {
    total_eventos_entrantes: number;
    decisiones_automaticas: number;
    pedidos_creados_bot: number;
    repartidores_asignados_bot: number;
    escalados_humano: number;
    alertas_pendientes: number;
    tasa_resolucion_automatica: number;
    tiempo_promedio_ms: number;
    por_tipo_decision: Record<string, number>;
    outbox: {
      pendientes: number;
      enviados: number;
      fallidos: number;
      muertos: number;
    };
  };
  alertas_activas: Array<{
    id: string;
    tipo: string;
    severidad: "INFO" | "ADVERTENCIA" | "CRITICO";
    estado: "ABIERTA" | "RECONOCIDA" | "RESUELTA";
    pedido_id: string | null;
    pedido_numero: string | null;
    pedido_estado: string | null;
    pedido_total_soles: string | null;
    sucursal_nombre: string | null;
    datos: {
      conversation_id?: string | null;
      cliente_nombre?: string;
      cliente_telefono?: string;
      mensaje_cliente?: string;
      motivo_escalado?: string;
      sugerencia_accion?: string;
      nota_resolucion?: string;
    };
    creado_en: string;
    resuelto_en: string | null;
  }>;
  historial_decisiones: Array<{
    id: string;
    dispatch_id: string;
    estado_evento: string;
    recibido_en: string;
    procesado_en: string | null;
    canal: string;
    conversation_id: string;
    cliente_nombre: string;
    cliente_telefono: string;
    mensaje_entrante: string;
    tipo_decision: string;
    resuelto_por_bot: boolean;
    escalado_a_humano: boolean;
    motivo_decision: string;
    respuesta_bot: string | null;
    pedido_id: string | null;
    pedido_numero: string | null;
    repartidor_id: string | null;
    repartidor_nombre: string | null;
    duracion_ms: number;
  }>;
  eventos_salida: Array<{
    id: string;
    tipo: string;
    datos: Record<string, unknown>;
    estado: "PENDIENTE" | "PROCESANDO" | "ENVIADO" | "FALLIDO" | "MUERTO";
    intentos: number;
    ultimo_error: string | null;
    creado_en: string;
    procesado_en: string | null;
  }>;
}

interface BotSystemStateData {
  integracion_activa: boolean;
  directorio_general_url: string;
  sucursales: Array<{
    id: string;
    nombre: string;
    slug: string;
    direccion: string;
    telefono: string;
    url_carta_digital: string;
    platos: Array<{
      id: string;
      nombre: string;
      categoria: string;
      precio_soles: string;
      disponible: boolean;
      es_fragil: boolean;
    }>;
  }>;
  repartidores_activos: Array<{
    id: string;
    nombre: string;
    vehiculo: string;
    estado: string;
    estrellas: number;
    garantia_soles: string;
    elegible_efectivo: boolean;
  }>;
}

const DECISION_BADGE: Record<
  string,
  { label: string; color: string }
> = {
  REPARTIDOR_ASIGNADO: {
    label: "Pedido + Repartidor Asignado",
    color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  },
  PEDIDO_CREADO: {
    label: "Pedido Creado",
    color: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  },
  CONSULTA_ESTADO: {
    label: "Estado Consultado",
    color: "bg-indigo-500/15 text-indigo-700 border-indigo-500/30",
  },
  CONSULTA_CATALOGO: {
    label: "Carta / Sucursales Enviada",
    color: "bg-sky-500/15 text-sky-700 border-sky-500/30",
  },
  ESTADO_ACTUALIZADO: {
    label: "Estado Actualizado",
    color: "bg-teal-500/15 text-teal-700 border-teal-500/30",
  },
  COMPROBANTE_PAGO: {
    label: "Comprobante (Escalado)",
    color: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  },
  ESCALADO_HUMANO: {
    label: "Escalado a Coordinador/Admin",
    color: "bg-rose-500/15 text-rose-700 border-rose-500/30",
  },
  IGNORADO_TEST: {
    label: "Prueba Laboratorio (Ignorado)",
    color: "bg-slate-500/15 text-slate-700 border-slate-500/30",
  },
};

export function VoceroBotControlCenter() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    "historial" | "alertas" | "sistema" | "outbox"
  >("historial");

  // Estado de la consola operativa de producción
  const [clientName, setClientName] = useState("María López");
  const [clientPhone, setClientPhone] = useState("+51987654321");
  const [conversationIdInput, setConversationIdInput] = useState("");
  const [dispatchMessage, setDispatchMessage] = useState("");
  const [lastDispatchResult, setLastDispatchResult] = useState<any>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Parámetros de conexión con Vocero CRM en producción
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [voceroUrlInput, setVoceroUrlInput] = useState("");
  const [botApiKeyInput, setBotApiKeyInput] = useState("");
  const [configSavedMsg, setConfigSavedMsg] = useState<string | null>(null);

  const { data: overviewRes, isLoading } = useQuery({
    queryKey: ["vocero-bot-overview"],
    queryFn: () =>
      api.get<{ ok: boolean; data: BotOverviewData }>(
        "/integrations/vocero/overview"
      ),
    refetchInterval: 6_000,
  });

  const { data: sysStateRes } = useQuery({
    queryKey: ["vocero-bot-system-state"],
    queryFn: () =>
      api.get<{ ok: boolean; data: BotSystemStateData }>(
        "/integrations/vocero/system-state"
      ),
    refetchInterval: 12_000,
  });

  const toggleMutation = useMutation({
    mutationFn: (payload: {
      enabled?: boolean;
      autoAssignRider?: boolean;
      autoConfirmCash?: boolean;
      voceroBaseUrl?: string;
      botApiKey?: string;
    }) => api.patch("/integrations/vocero/toggle", payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vocero-bot-overview"] });
      void queryClient.invalidateQueries({
        queryKey: ["vocero-bot-system-state"],
      });
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: (alertId: string) =>
      api.post(`/integrations/vocero/alerts/${alertId}/resolve`, {
        nota: "Resuelto desde el Centro de Control del Bot",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vocero-bot-overview"] });
    },
  });

  const autoAssignMutation = useMutation({
    mutationFn: (orderId: string) =>
      api.post(`/integrations/vocero/orders/${orderId}/auto-assign`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vocero-bot-overview"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const flushOutboxMutation = useMutation({
    mutationFn: () => api.post("/integrations/vocero/outbox/flush", {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vocero-bot-overview"] });
    },
  });

  const retryOutboxMutation = useMutation({
    mutationFn: (eventId: string) =>
      api.post(`/integrations/vocero/outbox/${eventId}/retry`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["vocero-bot-overview"] });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: (payload: {
      nombreCliente: string;
      telefono: string;
      conversationId?: string;
      mensaje: string;
    }) =>
      api.post<{ ok: boolean; data: any }>(
        "/integrations/vocero/dispatch",
        payload
      ),
    onSuccess: (res) => {
      setDispatchError(null);
      setLastDispatchResult(res.data?.decision ?? res.data);
      void queryClient.invalidateQueries({ queryKey: ["vocero-bot-overview"] });
      void queryClient.invalidateQueries({
        queryKey: ["vocero-bot-system-state"],
      });
    },
    onError: (err: unknown) => {
      setDispatchError(
        err instanceof Error ? err.message : "No se pudo procesar el despacho"
      );
    },
  });

  const overview = overviewRes?.data;
  const sysState = sysStateRes?.data;
  const conexion = overview?.conexion;
  const stats = overview?.estadisticas;
  const alertasAbiertas = (overview?.alertas_activas ?? []).filter(
    (a) => a.estado === "ABIERTA"
  );

  const primerPlatoDisponible =
    sysState?.sucursales?.[0]?.platos?.find((p) => p.disponible)?.nombre ??
    "Pollo a la Brasa";
  const primeraSucursalNombre =
    sysState?.sucursales?.[0]?.nombre ?? "Sucursal Principal";

  const triggerDispatchPreset = (mensaje: string) => {
    setDispatchMessage(mensaje);
    dispatchMutation.mutate({
      nombreCliente: clientName,
      telefono: clientPhone,
      conversationId: conversationIdInput.trim() || undefined,
      mensaje,
    });
  };

  if (isLoading && !overview) {
    return (
      <div className="space-y-4 p-4 sm:p-6">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const enabled = conexion?.enabled ?? true;

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
      {/* =====================================================================
          1. CABECERA PRINCIPAL E INTERRUPTOR MAESTRO (ON / OFF)
         ===================================================================== */}
      <section
        className={`rounded-2xl border p-5 shadow-sm transition-colors ${
          enabled
            ? "border-primary/30 bg-gradient-to-r from-primary/5 via-card to-emerald-500/5"
            : "border-rose-500/40 bg-rose-500/5"
        }`}
      >
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-md ${
                enabled
                  ? "bg-primary text-on-primary"
                  : "bg-rose-600 text-white"
              }`}
            >
              <Bot className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-extrabold text-foreground sm:text-2xl">
                  Conector Bidireccional Vocero CRM & Bot IA
                </h1>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${
                    enabled
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-rose-600 text-white"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      enabled ? "bg-emerald-500 animate-ping" : "bg-white"
                    }`}
                  />
                  {enabled ? "CONEXIÓN ACTIVA (ON)" : "CONEXIÓN APAGADA (OFF)"}
                </span>
              </div>
              <p className="mt-1 max-w-3xl text-xs sm:text-sm text-muted-foreground">
                El Bot lee en vivo las sucursales independientes, platos, precios, estados de
                pedidos y elegibilidad de repartidores para responder al cliente, crear pedidos,
                asignar al repartidor recomendado y notificar al Coordinador y Admin cuando no
                pueda decidir.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={conexion?.autoAssignRider ?? true}
                    onChange={(e) =>
                      toggleMutation.mutate({ autoAssignRider: e.target.checked })
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="inline-flex items-center gap-1">
                    Auto-asignar repartidor recomendado (
                    <Star className="h-3.5 w-3.5" aria-hidden /> estrellas, distancia y garantía)
                  </span>
                </label>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 font-semibold text-foreground">
                  <input
                    type="checkbox"
                    checked={conexion?.autoConfirmCash ?? true}
                    onChange={(e) =>
                      toggleMutation.mutate({ autoConfirmCash: e.target.checked })
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  <span>Auto-confirmar pedidos en Efectivo</span>
                </label>

                <span className="font-mono text-[11px] text-muted-foreground">
                  CRM URL: <strong>{conexion?.voceroBaseUrl}</strong> · Webhook:{" "}
                  <strong>{conexion?.webhookEndpoint}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* BOTÓN MAESTRO PARA APAGAR O CONTINUAR LA CONEXIÓN */}
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <button
              type="button"
              onClick={() => toggleMutation.mutate({ enabled: !enabled })}
              disabled={toggleMutation.isPending}
              className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-2.5 rounded-xl px-6 py-3 text-sm font-extrabold shadow-md transition-all disabled:opacity-50 ${
                enabled
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              <Power className="h-5 w-5" aria-hidden />
              {enabled
                ? "Apagar Conexión con Vocero CRM"
                : "Continuar / Encender Conexión"}
            </button>
            <span className="text-center text-[11px] text-muted-foreground lg:text-right">
              {enabled
                ? "Si apagas la conexión, el webhook pasa a 404 y el Bot deja de actuar."
                : "La conexión está pausada. Presiona para que el Bot continúe."}
            </span>
          </div>
        </div>
      </section>

      {/* =====================================================================
          2. TARJETAS DE ESTADÍSTICAS Y KPIs DEL BOT
         ===================================================================== */}
      <section aria-label="Estadísticas del Bot">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase">Mensajes Procesados</span>
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">
              {stats?.total_eventos_entrantes ?? 0}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Despachos recibidos de Vocero
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase">Resolución Autónoma</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-emerald-600">
              {stats?.tasa_resolucion_automatica ?? 100}%
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {stats?.decisiones_automaticas ?? 0} decisiones sin intervención
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase">Pedidos por Bot</span>
              <Store className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-blue-600">
              {stats?.pedidos_creados_bot ?? 0}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Registrados directo en sistema
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase">Repartidores por IA</span>
              <Bike className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-indigo-600">
              {stats?.repartidores_asignados_bot ?? 0}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Asignados según recomendación
            </p>
          </div>

          <div
            onClick={() => setActiveTab("alertas")}
            className={`cursor-pointer rounded-xl border p-4 shadow-sm transition-colors ${
              (stats?.alertas_pendientes ?? 0) > 0
                ? "border-amber-500/60 bg-amber-500/10"
                : "border-border bg-card"
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase">Indecisiones / Alertas</span>
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-amber-600">
              {stats?.alertas_pendientes ?? 0}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                ({stats?.escalados_humano ?? 0} hist.)
              </span>
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-amber-800">
              Notificados a Coordinador y Admin
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-bold uppercase">Tiempo de Decisión</span>
              <Clock className="h-4 w-4 text-sky-600" />
            </div>
            <p className="mt-2 text-2xl font-extrabold text-foreground">
              {stats?.tiempo_promedio_ms ?? 0} ms
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Outbox: {stats?.outbox?.enviados ?? 0} enviados /{" "}
              {stats?.outbox?.pendientes ?? 0} pend.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. CONSOLA DE PRODUCCIÓN: ENLACE VOCERO CRM Y DESPACHO OPERATIVO
         ===================================================================== */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-foreground">
                  Consola de Producción: Despacho Operativo y Sincronización Vocero CRM
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                    conexion?.voceroReachable
                      ? "bg-emerald-500/15 text-emerald-700"
                      : "bg-amber-500/15 text-amber-800"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      conexion?.voceroReachable ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {conexion?.voceroReachable
                    ? "CRM Alcanzable en Vivo"
                    : "Esperando enlace Vocero CRM"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Procesa despachos reales con firma HMAC-SHA256 (`X-Vocero-Signature`), vincula la
                conversación en vivo (`GET /api/bot/context`), actualiza la ficha del cliente y
                despacha órdenes y repartidores en producción.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/v1/reports/bot.csv"
              download="reporte_decisiones_bot_vocero.csv"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-extrabold text-emerald-800 transition-colors hover:bg-emerald-500/20"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Exportar Historial CSV (Excel)
            </a>
            <button
              type="button"
              onClick={() => {
                setVoceroUrlInput(conexion?.voceroBaseUrl ?? "http://localhost:3000");
                setShowConfigForm((prev) => !prev);
              }}
              className="cursor-pointer rounded-xl border border-border bg-muted/60 px-3 py-1.5 text-xs font-extrabold text-foreground hover:bg-muted"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden />
              Configurar Credenciales CRM
            </button>
          </div>
        </div>

        {/* Panel desplegable de configuración de URL y API Key en producción */}
        {showConfigForm ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setConfigSavedMsg(null);
              toggleMutation.mutate(
                {
                  voceroBaseUrl: voceroUrlInput.trim() || undefined,
                  botApiKey: botApiKeyInput.trim() || undefined,
                },
                {
                  onSuccess: () => {
                    setConfigSavedMsg(
                      "Parámetros de producción guardados y verificados con Vocero CRM."
                    );
                    setBotApiKeyInput("");
                  },
                }
              );
            }}
            className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <label className="block text-[11px] font-extrabold uppercase text-foreground">
                  URL de Instancia Vocero CRM (`VOCERO_BASE_URL`)
                </label>
                <input
                  type="text"
                  value={voceroUrlInput}
                  onChange={(e) => setVoceroUrlInput(e.target.value)}
                  placeholder="http://localhost:3000 o http://host.docker.internal:3000"
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground"
                />
              </div>
              <div className="md:col-span-5">
                <label className="block text-[11px] font-extrabold uppercase text-foreground">
                  Llave Compartida (`BOT_API_KEY` de Vocero CRM, mín. 16 caract.)
                </label>
                <input
                  type="password"
                  value={botApiKeyInput}
                  onChange={(e) => setBotApiKeyInput(e.target.value)}
                  placeholder="Dejar en blanco para mantener la llave actual"
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground"
                />
              </div>
              <div className="flex items-end md:col-span-2">
                <button
                  type="submit"
                  disabled={toggleMutation.isPending}
                  className="h-10 w-full cursor-pointer rounded-xl bg-primary px-3 text-xs font-extrabold text-on-primary hover:bg-primary/90 disabled:opacity-50"
                >
                  {toggleMutation.isPending ? "Guardando..." : "Guardar Enlace"}
                </button>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                En <strong>Vocero CRM (.env)</strong> configura:{" "}
                <code className="rounded bg-card px-1.5 py-0.5 font-mono text-foreground">
                  BRAIN_DISPATCH_URL=http://localhost:4000/api/v1/webhooks/vocero
                </code>{" "}
                y{" "}
                <code className="rounded bg-card px-1.5 py-0.5 font-mono text-foreground">
                  BRAIN_HEALTH_URL=http://localhost:4000/api/v1/webhooks/vocero/health
                </code>
              </span>
              {configSavedMsg ? (
                <span className="font-bold text-emerald-700">{configSavedMsg}</span>
              ) : null}
            </div>
          </form>
        ) : null}

        {/* Acciones operativas rápidas de despacho en producción */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              triggerDispatchPreset(
                "Hola, ¿qué sucursales y platos tienen disponibles hoy?"
              )
            }
            disabled={dispatchMutation.isPending}
            className="cursor-pointer rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            1. Enviar Carta y Sucursales Activas
          </button>
          <button
            type="button"
            onClick={() =>
              triggerDispatchPreset(
                `Quiero pedir 2 ${primerPlatoDisponible} de ${primeraSucursalNombre} en efectivo a Av. Larco 450, Miraflores`
              )
            }
            disabled={dispatchMutation.isPending}
            className="cursor-pointer rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-500/20"
          >
            <Drumstick className="h-3.5 w-3.5" aria-hidden />
            2. Registrar Pedido en Efectivo + Auto-asignar Repartidor
          </button>
          <button
            type="button"
            onClick={() =>
              triggerDispatchPreset(
                "¿Cuál es el estado de mi pedido y quién es mi repartidor?"
              )
            }
            disabled={dispatchMutation.isPending}
            className="cursor-pointer rounded-lg border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-800 transition-colors hover:bg-indigo-500/20"
          >
            <Bike className="h-3.5 w-3.5" aria-hidden />
            3. Sincronizar Estado de Pedido y Ficha CRM
          </button>
          <button
            type="button"
            onClick={() =>
              triggerDispatchPreset(
                `Quiero pedir 1 ${primerPlatoDisponible} con Yape a Calle Los Pinos 230`
              )
            }
            disabled={dispatchMutation.isPending}
            className="cursor-pointer rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-900 transition-colors hover:bg-amber-500/20"
          >
            <CreditCard className="h-3.5 w-3.5" aria-hidden />
            4. Registrar Pedido Yape (Deriva a Validación Humana)
          </button>
          <button
            type="button"
            onClick={() =>
              triggerDispatchPreset(
                "Quiero cancelar mi pedido y que me devuelvan mi dinero, pásame con un humano"
              )
            }
            disabled={dispatchMutation.isPending}
            className="cursor-pointer rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-800 transition-colors hover:bg-rose-500/20"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            5. Derivar Caso Crítico / Handoff a Coordinador y Admin
          </button>
        </div>

        {/* Formulario de despacho directo con firma HMAC */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!dispatchMessage.trim()) return;
            dispatchMutation.mutate({
              nombreCliente: clientName,
              telefono: clientPhone,
              conversationId: conversationIdInput.trim() || undefined,
              mensaje: dispatchMessage,
            });
          }}
          className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-12"
        >
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nombre del cliente"
            className="h-11 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground sm:col-span-2"
          />
          <input
            type="text"
            value={clientPhone}
            onChange={(e) => setClientPhone(e.target.value)}
            placeholder="+51987654321"
            className="h-11 rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground sm:col-span-2"
          />
          <input
            type="text"
            value={conversationIdInput}
            onChange={(e) => setConversationIdInput(e.target.value)}
            placeholder="ID Conversación CRM (opcional)"
            className="h-11 rounded-xl border border-border bg-background px-3 font-mono text-xs text-foreground sm:col-span-2"
          />
          <input
            type="text"
            value={dispatchMessage}
            onChange={(e) => setDispatchMessage(e.target.value)}
            placeholder={`Mensaje entrante de cliente, ej: "Quiero 2 ${primerPlatoDisponible} en efectivo a Av. Arequipa 1200"`}
            className="h-11 rounded-xl border border-border bg-background px-3.5 text-xs text-foreground sm:col-span-4"
          />
          <button
            type="submit"
            disabled={dispatchMutation.isPending || !dispatchMessage.trim()}
            className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-extrabold text-on-primary shadow-sm hover:bg-primary/90 disabled:opacity-50 sm:col-span-2"
          >
            <Send className="h-4 w-4" />
            {dispatchMutation.isPending ? "Procesando..." : "Despachar Turno"}
          </button>
        </form>

        {dispatchError ? (
          <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-bold text-rose-700">
            {dispatchError}
          </div>
        ) : null}

        {lastDispatchResult ? (
          <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-extrabold text-on-primary">
                  Decisión Ejecutada: {lastDispatchResult.tipo_decision}
                </span>
                {lastDispatchResult.pedido_numero ? (
                  <span className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-extrabold text-white">
                    Pedido {lastDispatchResult.pedido_numero}
                  </span>
                ) : null}
                {lastDispatchResult.repartidor_nombre ? (
                  <span className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-extrabold text-white">
                    <Bike className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    Repartidor: {lastDispatchResult.repartidor_nombre}
                  </span>
                ) : null}
                {lastDispatchResult.escalado_a_humano ? (
                  <span className="rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-extrabold text-white">
                    <Bell className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                    Alerta enviada a Coordinador y Admin
                  </span>
                ) : null}
              </div>
              <span className="font-mono text-[11px] text-muted-foreground">
                {lastDispatchResult.duracion_ms} ms
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-foreground">
              <strong>Acción en el sistema:</strong> {lastDispatchResult.motivo_decision}
            </p>
            {lastDispatchResult.respuesta_bot ? (
              <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-card p-3 font-sans text-xs leading-relaxed text-foreground">
                {lastDispatchResult.respuesta_bot}
              </pre>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* =====================================================================
          4. PESTAÑAS DE GESTIÓN: HISTORIAL DE DECISIONES | NOTIFICACIONES | VISIBILIDAD | OUTBOX
         ===================================================================== */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("historial")}
          className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-colors ${
            activeTab === "historial"
              ? "bg-primary text-on-primary shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <History className="h-4 w-4" />
          Historial de Decisiones del Bot ({overview?.historial_decisiones?.length ?? 0})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("alertas")}
          className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-colors ${
            activeTab === "alertas"
              ? "bg-primary text-on-primary shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Notificaciones de Indecisión ({alertasAbiertas.length} abiertas)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sistema")}
          className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-colors ${
            activeTab === "sistema"
              ? "bg-primary text-on-primary shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Activity className="h-4 w-4" />
          Estado del Sistema que ve el Bot ({sysState?.sucursales?.length ?? 0} sucursales)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("outbox")}
          className={`flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-colors ${
            activeTab === "outbox"
              ? "bg-primary text-on-primary shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <Zap className="h-4 w-4" />
          Cola de Salida Outbox ({overview?.eventos_salida?.length ?? 0})
        </button>
      </div>

      {/* ---------------------------------------------------------------------
          TAB 1: HISTORIAL DE DECISIONES DEL BOT
         --------------------------------------------------------------------- */}
      {activeTab === "historial" ? (
        <section className="space-y-3">
          {overview?.historial_decisiones?.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <Bot className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm font-bold text-foreground">
                Aún no hay decisiones registradas
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Usa la Consola de Despacho arriba o envía un mensaje desde Vocero CRM para
                ver cómo el Bot decide y actúa sobre el sistema.
              </p>
            </div>
          ) : (
            overview?.historial_decisiones?.map((item) => {
              const badge = DECISION_BADGE[item.tipo_decision] ?? {
                label: item.tipo_decision,
                color: "bg-slate-500/15 text-slate-700 border-slate-500/30",
              };

              return (
                <article
                  key={item.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-extrabold ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        {item.cliente_nombre}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.cliente_telefono}
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        {item.canal}
                      </span>
                      {item.pedido_numero ? (
                        <Link
                          href="/coordinator"
                          className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-extrabold text-primary hover:underline"
                        >
                          Pedido {item.pedido_numero}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : null}
                      {item.repartidor_nombre ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                          <Bike className="h-3.5 w-3.5" />
                          {item.repartidor_nombre}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="font-mono">{item.duracion_ms} ms</span>
                      <span>
                        {new Date(item.recibido_en).toLocaleString("es-PE", {
                          hour12: false,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-xl bg-muted/50 p-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">
                        Mensaje del Cliente
                      </p>
                      <p className="mt-1 text-xs font-medium text-foreground">
                        “{item.mensaje_entrante}”
                      </p>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        <strong>Decisión tomada en sistema:</strong> {item.motivo_decision}
                      </p>
                    </div>

                    {item.respuesta_bot ? (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                        <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
                          Respuesta enviada por el Bot
                        </p>
                        <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
                          {item.respuesta_bot}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : null}

      {/* ---------------------------------------------------------------------
          TAB 2: NOTIFICACIONES CUANDO EL BOT NO PUEDE TOMAR DECISIONES
         --------------------------------------------------------------------- */}
      {activeTab === "alertas" ? (
        <section className="space-y-3">
          {overview?.alertas_activas?.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <p className="mt-2 text-sm font-bold text-foreground">
                No hay alertas de indecisión del Bot
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cuando el Bot reciba un comprobante Yape, un pedido sin repartidor elegible o
                una solicitud de cancelación, aparecerá aquí y en la campana superior.
              </p>
            </div>
          ) : (
            overview?.alertas_activas?.map((alerta) => {
              const isOpen = alerta.estado === "ABIERTA";
              return (
                <article
                  key={alerta.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    !isOpen
                      ? "border-border bg-card opacity-75"
                      : alerta.severidad === "CRITICO"
                        ? "border-rose-500/50 bg-rose-500/5"
                        : "border-amber-500/50 bg-amber-500/5"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold uppercase ${
                          !isOpen
                            ? "bg-emerald-500/15 text-emerald-700"
                            : alerta.severidad === "CRITICO"
                              ? "bg-rose-600 text-white"
                              : "bg-amber-600 text-white"
                        }`}
                      >
                        {isOpen ? alerta.severidad : "RESUELTA"} ·{" "}
                        {alerta.tipo.replace(/^BOT_/, "").replace(/_/g, " ")}
                      </span>
                      <span className="text-xs font-extrabold text-foreground">
                        {alerta.datos?.cliente_nombre || "Cliente WhatsApp"}
                      </span>
                      {alerta.datos?.cliente_telefono ? (
                        <span className="font-mono text-xs text-muted-foreground">
                          ({alerta.datos.cliente_telefono})
                        </span>
                      ) : null}
                      {alerta.pedido_numero ? (
                        <span className="rounded-lg bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-extrabold text-primary">
                          Pedido {alerta.pedido_numero} ({alerta.pedido_total_soles})
                        </span>
                      ) : null}
                      {alerta.sucursal_nombre ? (
                        <span className="text-xs font-semibold text-muted-foreground">
                          · {alerta.sucursal_nombre}
                        </span>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(alerta.creado_en).toLocaleString("es-PE", {
                        hour12: false,
                      })}
                    </span>
                  </div>

                  {alerta.datos?.mensaje_cliente ? (
                    <p className="mt-2 rounded-xl bg-card px-3 py-2 text-xs italic text-foreground">
                      Mensaje del cliente: “{alerta.datos.mensaje_cliente}”
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs font-semibold text-foreground">
                    <strong>¿Por qué el Bot no pudo decidir solo?</strong>{" "}
                    {alerta.datos?.motivo_escalado}
                  </p>
                  {alerta.datos?.sugerencia_accion ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      <strong>Acción recomendada para Coordinador / Admin:</strong>{" "}
                      {alerta.datos.sugerencia_accion}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                    {alerta.pedido_id && isOpen ? (
                      <button
                        type="button"
                        onClick={() => autoAssignMutation.mutate(alerta.pedido_id!)}
                        disabled={autoAssignMutation.isPending}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-500/20 disabled:opacity-50"
                      >
                        <Bike className="h-3.5 w-3.5" />
                        Auto-asignar Repartidor Recomendado
                      </button>
                    ) : null}

                    <Link
                      href="/coordinator"
                      className="inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
                    >
                      Ir a Despacho Kanban
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>

                    {isOpen ? (
                      <button
                        type="button"
                        onClick={() => resolveAlertMutation.mutate(alerta.id)}
                        disabled={resolveAlertMutation.isPending}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-extrabold text-on-primary shadow-sm hover:bg-primary/90 disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Marcar Decisión Resuelta
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : null}

      {/* ---------------------------------------------------------------------
          TAB 3: VISIBILIDAD DEL BOT SOBRE EL SISTEMA (SUCURSALES, PLATOS, REPARTIDORES)
         --------------------------------------------------------------------- */}
      {activeTab === "sistema" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 lg:col-span-7">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground">
              Sucursales Independientes y Platos que lee el Bot
            </h3>
            {sysState?.sucursales?.map((suc) => (
              <div
                key={suc.id}
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-extrabold text-foreground">
                      <Store className="h-4 w-4 shrink-0" aria-hidden />
                      {suc.nombre}
                    </p>
                    <p className="text-xs text-muted-foreground">{suc.direccion}</p>
                  </div>
                  <Link
                    href={`/m/${suc.slug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:underline"
                  >
                    Ver Carta Pública (/m/{suc.slug})
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {suc.platos.map((plato) => (
                    <div
                      key={plato.id}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs"
                    >
                      <div>
                        <p className="font-bold text-foreground">{plato.nombre}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {plato.categoria} {plato.es_fragil ? "· Frágil" : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-extrabold text-primary">
                          {plato.precio_soles}
                        </p>
                        <span
                          className={`text-[10px] font-bold ${
                            plato.disponible ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {plato.disponible ? "Disponible" : "Agotado"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4 lg:col-span-5">
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-foreground">
              Flota de Repartidores y Garantías evaluadas por el Bot
            </h3>
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="space-y-2.5">
                {sysState?.repartidores_activos?.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3 text-xs"
                  >
                    <div>
                      <p className="flex flex-wrap items-center gap-1.5 font-bold text-foreground">
                        <Bike className="h-3.5 w-3.5" aria-hidden />
                        {r.nombre}
                        <span className="inline-flex items-center gap-0.5 text-amber-600">
                          <Star className="h-3 w-3" aria-hidden />
                          {r.estrellas.toFixed(1)}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Vehículo: {r.vehiculo} · Garantía: {r.garantia_soles}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                          r.estado === "DISPONIBLE"
                            ? "bg-emerald-500/15 text-emerald-700"
                            : "bg-amber-500/15 text-amber-700"
                        }`}
                      >
                        {r.estado}
                      </span>
                      <span
                        className={`text-[10px] font-semibold ${
                          r.elegible_efectivo
                            ? "text-emerald-700"
                            : "text-rose-600"
                        }`}
                      >
                        <span className="inline-flex items-center gap-1">
                          {r.elegible_efectivo ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" aria-hidden />
                              Apto Contra Entrega
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3" aria-hidden />
                              Sin garantía efectivo
                            </>
                          )}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------------------------------------------------------------
          TAB 4: COLA DE SALIDA (OUTBOX) HACIA VOCERO CRM
         --------------------------------------------------------------------- */}
      {activeTab === "outbox" ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-foreground">
                Bandeja de Salida Transaccional (`eventos_salida`)
              </h3>
              <p className="text-xs text-muted-foreground">
                Eventos de cambio de estado de pedido, asignación de repartidor y validación de
                pago que se sincronizan con la ficha y WhatsApp de Vocero CRM.
              </p>
            </div>
            <button
              type="button"
              onClick={() => flushOutboxMutation.mutate()}
              disabled={flushOutboxMutation.isPending}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-extrabold text-on-primary hover:bg-primary/90 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Procesar Cola Ahora
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {overview?.eventos_salida?.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                      ev.estado === "ENVIADO"
                        ? "bg-emerald-500/15 text-emerald-700"
                        : ev.estado === "PENDIENTE"
                          ? "bg-blue-500/15 text-blue-700"
                          : "bg-rose-500/15 text-rose-700"
                    }`}
                  >
                    {ev.estado}
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {ev.tipo}
                  </span>
                  <span className="text-muted-foreground">
                    Intentos: {ev.intentos}
                  </span>
                  {ev.ultimo_error ? (
                    <span className="text-rose-600">{ev.ultimo_error}</span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(ev.creado_en).toLocaleString("es-PE", {
                      hour12: false,
                    })}
                  </span>
                  {ev.estado === "FALLIDO" || ev.estado === "MUERTO" ? (
                    <button
                      type="button"
                      onClick={() => retryOutboxMutation.mutate(ev.id)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700"
                    >
                      <Play className="h-3 w-3" />
                      Reintentar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
