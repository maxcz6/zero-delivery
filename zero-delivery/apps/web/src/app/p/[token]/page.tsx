"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  MapPin,
  Package,
  PackageCheck,
  Phone,
  RefreshCw,
  Store,
  AlertCircle,
  Banknote,
  ShieldCheck,
} from "lucide-react";
import { api, money } from "@/lib/api";
import { PageLoader, ErrorNote } from "@/components/ui";

interface ItemSnapshot {
  id: string;
  nombre_snapshot: string;
  cantidad: number;
  total_linea_centavos: string;
}

interface TrackData {
  id: string;
  numero: string | number;
  estado_operativo: string;
  estado_pago: string;
  metodo_pago: string;
  total_centavos: string;
  direccion_snapshot: {
    /** Los pedidos creados por el cliente guardan `texto_direccion`; los del seed, `direccion`. */
    texto_direccion?: string;
    direccion?: string;
    referencia?: string | null;
  } | null;
  sucursal: {
    nombre: string;
    direccion?: string;
    telefono?: string | null;
  } | null;
  repartidor: {
    nombre_completo: string;
    tipo_vehiculo?: string | null;
    telefono?: string | null;
  } | null;
  items: ItemSnapshot[];
  creado_en: string;
}

const STEPS = [
  { key: "NUEVO", label: "Recibido", icon: Package },
  { key: "EN_PREPARACION", label: "En Cocina", icon: ChefHat },
  { key: "LISTO", label: "Listo", icon: Store },
  { key: "EN_CAMINO", label: "En Camino", icon: Bike },
  { key: "ENTREGADO", label: "Entregado", icon: CheckCircle2 },
];

function getStepIndex(estado: string): number {
  switch (estado) {
    case "NUEVO":
      return 0;
    case "CONFIRMADO":
      return 0;
    case "EN_PREPARACION":
      return 1;
    case "LISTO":
    case "REPARTIDOR_ASIGNADO":
    case "REPARTIDOR_EN_RECOJO":
      return 2;
    case "EN_CAMINO":
      return 3;
    case "ENTREGADO":
      return 4;
    default:
      return 0;
  }
}

export default function PublicTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);

  const trackQuery = useQuery({
    queryKey: ["public-track", token],
    queryFn: () => api.get<{ ok: boolean; data: TrackData }>(`/orders/public/track/${token}`),
    refetchInterval: 6_000,
  });

  const order = trackQuery.data?.data;

  if (trackQuery.isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <PageLoader label="Localizando tu pedido en vivo…" />
      </div>
    );
  }

  if (trackQuery.isError || !order) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-background p-6">
        <div className="max-w-md w-full">
          <ErrorNote message="No se encontró el pedido o el enlace de seguimiento ha expirado." />
        </div>
      </div>
    );
  }

  const isCancelled = ["CANCELADO", "RECHAZADO", "ENTREGA_FALLIDA"].includes(order.estado_operativo);
  const currentStep = getStepIndex(order.estado_operativo);
  const numero = order.numero;
  const direccion = order.direccion_snapshot;
  const esContraEntrega = order.metodo_pago === "EFECTIVO" || order.metodo_pago === "EFECTIVO_CONTRAENTREGA";
  const pagado = order.estado_pago === "PAGADO";
  const rider = order.repartidor;
  const riderNombre = rider?.nombre_completo ?? "Repartidor";
  const riderVehiculo = rider?.tipo_vehiculo ?? "Motocicleta de reparto";
  const riderTelefono = rider?.telefono ?? null;

  return (
    <div className="min-h-dvh bg-background pb-16 font-sans">
      {/* Barra superior de seguimiento */}
      <header className="bg-white border-b border-border shadow-xs">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <PackageCheck className="h-5 w-5" />
            </span>
            <div>
              <span className="text-sm font-bold text-foreground">Zero Delivery</span>
              <span className="block text-[10px] text-muted-foreground">Seguimiento en Vivo</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Actualización en tiempo real
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
        {/* Tarjeta resumen del estado */}
        <section className="rounded-2xl border border-border bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Pedido #{numero}
              </span>
              <h2 className="text-xl font-extrabold text-foreground mt-0.5">
                {isCancelled
                  ? `Estado: ${order.estado_operativo}`
                  : currentStep === 4
                    ? "¡Pedido Entregado!"
                    : currentStep === 3
                      ? "Tu pedido está en camino"
                      : currentStep === 2
                        ? "Pedido listo, esperando repartidor"
                        : currentStep === 1
                          ? "El restaurante está preparando tu comida"
                          : "Hemos recibido tu pedido"}
              </h2>
            </div>
            <span className="shrink-0 whitespace-nowrap text-xl font-extrabold text-primary">
              {money(order.total_centavos)}
            </span>
          </div>

          {/* Stepper de Progreso */}
          {!isCancelled ? (
            <div className="pt-2">
              <div className="grid grid-cols-5 gap-1 relative">
                {STEPS.map((step, idx) => {
                  const completed = idx < currentStep;
                  const current = idx === currentStep;
                  const IconComp = step.icon;

                  return (
                    <div key={step.key} className="flex flex-col items-center text-center">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                          current
                            ? "border-primary bg-primary text-white shadow-md shadow-primary/30 scale-105"
                            : completed
                              ? "border-emerald-500 bg-emerald-50 text-emerald-600"
                              : "border-border bg-muted/40 text-muted-foreground"
                        }`}
                      >
                        <IconComp className="h-4 w-4" />
                      </div>
                      <span
                        className={`mt-2 text-[11px] leading-tight font-semibold ${
                          current
                            ? "text-primary font-bold"
                            : completed
                              ? "text-emerald-700"
                              : "text-muted-foreground"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>Este pedido fue cancelado o no pudo ser completado.</span>
            </div>
          )}
        </section>

        {/* Tarjeta de Información de Pago */}
        <section className="rounded-2xl border border-border bg-white p-4 shadow-xs">
          {pagado ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-primary">
                  Pedido pagado
                </p>
                <p className="text-sm font-semibold text-foreground">
                  No debes pagar nada al recibir tu entrega.
                </p>
              </div>
            </div>
          ) : esContraEntrega ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Banknote className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                  Pago contraentrega en efectivo
                </p>
                <p className="text-sm font-bold text-foreground">
                  Total a pagar al repartidor: {money(order.total_centavos)}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  Pago digital pendiente de validación
                </p>
                <p className="text-sm font-semibold text-foreground">
                  El coordinador validará tu comprobante antes de despachar el pedido.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Información del Repartidor */}
        {rider ? (
          <section className="rounded-2xl border border-border bg-white p-4 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Bike className="h-4 w-4 text-primary" /> Datos del Repartidor
            </h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-foreground">{riderNombre}</p>
                <p className="text-xs text-muted-foreground">
                  Vehículo: {riderVehiculo}
                </p>
              </div>
              {riderTelefono ? (
                <a
                  href={`tel:${riderTelefono}`}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-xs hover:bg-primary/90 transition-colors"
                  aria-label="Llamar al repartidor"
                >
                  <Phone className="h-5 w-5" />
                </a>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Dirección de Entrega y Sucursal */}
        <section className="rounded-2xl border border-border bg-white p-4 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-accent shrink-0 mt-0.5" />
            <div className="text-sm">
              <span className="block font-bold text-foreground">Dirección de Entrega:</span>
              <p className="text-muted-foreground">
                {direccion?.texto_direccion ?? direccion?.direccion ?? "Dirección registrada"}
              </p>
              {direccion?.referencia ? (
                <p className="text-xs text-muted-foreground italic mt-0.5">
                  Ref: {direccion.referencia}
                </p>
              ) : null}
            </div>
          </div>

          {order.sucursal ? (
            <div className="pt-2 border-t border-border flex items-start gap-3">
              <Store className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="block font-bold text-foreground">Preparado por:</span>
                <p className="text-muted-foreground">
                  {order.sucursal.nombre} {order.sucursal.direccion ? `· ${order.sucursal.direccion}` : ""}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        {/* Resumen de Productos */}
        <section className="rounded-2xl border border-border bg-white p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Detalle del Pedido
          </h3>
          <ul className="divide-y divide-border text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="py-2.5 flex items-center justify-between">
                <span className="font-medium text-foreground">
                  {item.cantidad}× {item.nombre_snapshot}
                </span>
                <span className="font-semibold text-muted-foreground">
                  {money(item.total_linea_centavos)}
                </span>
              </li>
            ))}
          </ul>
          <div className="pt-2 border-t border-border flex items-center justify-between text-base font-bold">
            <span className="text-foreground">Total:</span>
            <span className="text-primary">{money(order.total_centavos)}</span>
          </div>
        </section>
      </main>
    </div>
  );
}
