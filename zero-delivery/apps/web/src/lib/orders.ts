import type { EstadoOperativoPedidoDb as Estado } from "@zero-delivery/shared-types";
import type { Pedido } from "./types";

/** Espejo de la FSM canónica del backend (apps/api/src/modules/orders/order-transitions.ts). */
export const ALLOWED_TRANSITIONS: Record<Estado, Estado[]> = {
  NUEVO: ["CONFIRMADO", "RECHAZADO", "CANCELADO"],
  CONFIRMADO: ["EN_PREPARACION", "CANCELACION_SOLICITADA", "CANCELADO"],
  EN_PREPARACION: ["LISTO", "CANCELACION_SOLICITADA"],
  LISTO: ["REPARTIDOR_ASIGNADO", "REPARTIDOR_EN_RECOJO", "EN_CAMINO", "CANCELACION_SOLICITADA"],
  REPARTIDOR_ASIGNADO: ["REPARTIDOR_EN_RECOJO", "EN_CAMINO", "CANCELACION_SOLICITADA"],
  REPARTIDOR_EN_RECOJO: ["EN_CAMINO", "CANCELACION_SOLICITADA"],
  EN_CAMINO: ["ENTREGADO", "ENTREGA_FALLIDA", "CANCELACION_SOLICITADA"],
  ENTREGA_FALLIDA: ["DEVOLUCION_PENDIENTE", "PENDIENTE_RESOLUCION"],
  DEVOLUCION_PENDIENTE: ["DEVUELTO_A_RESTAURANTE"],
  CANCELACION_SOLICITADA: [
    "CANCELADO",
    "CONFIRMADO",
    "EN_PREPARACION",
    "LISTO",
    "REPARTIDOR_ASIGNADO",
    "REPARTIDOR_EN_RECOJO",
    "EN_CAMINO",
  ],
  PENDIENTE_RESOLUCION: ["DEVUELTO_A_RESTAURANTE", "ENTREGADO", "CANCELADO"],
  ENTREGADO: [],
  RECHAZADO: [],
  CANCELADO: [],
  DEVUELTO_A_RESTAURANTE: [],
};

export const STATES_REQUIRING_MOTIVO: Estado[] = [
  "RECHAZADO",
  "CANCELADO",
  "CANCELACION_SOLICITADA",
  "ENTREGA_FALLIDA",
  "PENDIENTE_RESOLUCION",
];

export const ESTADO_LABEL: Record<Estado, string> = {
  NUEVO: "Nuevo",
  CONFIRMADO: "Confirmado",
  EN_PREPARACION: "En preparación",
  LISTO: "Listo",
  REPARTIDOR_ASIGNADO: "Repartidor asignado",
  REPARTIDOR_EN_RECOJO: "Repartidor en recojo",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  RECHAZADO: "Rechazado",
  CANCELACION_SOLICITADA: "Cancelación solicitada",
  CANCELADO: "Cancelado",
  ENTREGA_FALLIDA: "Entrega fallida",
  DEVOLUCION_PENDIENTE: "Devolución pendiente",
  DEVUELTO_A_RESTAURANTE: "Devuelto al restaurante",
  PENDIENTE_RESOLUCION: "Pendiente de resolución",
};

export interface KanbanColumnDef {
  key: string;
  title: string;
  states: Estado[];
  /** Umbral de alerta de tiempo transcurrido en minutos (null = sin alerta). */
  alertMinutes: number | null;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  { key: "nuevos", title: "Nuevos", states: ["NUEVO", "CONFIRMADO"], alertMinutes: 5 },
  { key: "preparacion", title: "En Preparación", states: ["EN_PREPARACION"], alertMinutes: 30 },
  {
    key: "listos",
    title: "Listos para Despacho",
    states: ["LISTO", "REPARTIDOR_ASIGNADO"],
    alertMinutes: null,
  },
  {
    key: "camino",
    title: "En Camino",
    states: ["REPARTIDOR_EN_RECOJO", "EN_CAMINO"],
    alertMinutes: null,
  },
  {
    key: "cerrados",
    title: "Cerrados e incidencias",
    states: [
      "ENTREGADO",
      "DEVUELTO_A_RESTAURANTE",
      "CANCELADO",
      "RECHAZADO",
      "ENTREGA_FALLIDA",
      "DEVOLUCION_PENDIENTE",
      "PENDIENTE_RESOLUCION",
      "CANCELACION_SOLICITADA",
    ],
    alertMinutes: null,
  },
];

export function orderNumber(pedido: Pedido): string {
  const n = Number(pedido.numero);
  return `#${Number.isFinite(n) ? String(n).padStart(4, "0") : pedido.numero}`;
}

export function elapsedMinutes(creadoEn: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(creadoEn).getTime()) / 60_000));
}

export function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function isOrderFragile(pedido: Pedido): boolean {
  return Boolean(pedido.items?.some((item) => item.producto?.es_fragil));
}

export function isCashOrder(pedido: Pedido): boolean {
  return pedido.metodo_pago === "EFECTIVO";
}

export function mapsUrl(pedido: Pedido): string {
  const dir = pedido.direccion_snapshot ?? {};
  const lat = dir.latitud === null || dir.latitud === undefined ? null : Number(dir.latitud);
  const lng = dir.longitud === null || dir.longitud === undefined ? null : Number(dir.longitud);
  if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }
  const texto = dir.texto_direccion ?? "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto)}`;
}

export function wazeUrl(pedido: Pedido): string {
  const dir = pedido.direccion_snapshot ?? {};
  const lat = dir.latitud === null || dir.latitud === undefined ? null : Number(dir.latitud);
  const lng = dir.longitud === null || dir.longitud === undefined ? null : Number(dir.longitud);
  if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(dir.texto_direccion ?? "")}`;
}

/** Primer estado de la columna al que la FSM permite transitar desde el estado actual. */
export function droppableTarget(from: Estado, columnStates: Estado[]): Estado | null {
  const allowed = ALLOWED_TRANSITIONS[from] ?? [];
  for (const candidate of columnStates) {
    if (allowed.includes(candidate)) return candidate;
  }
  return null;
}
