import {
  EstadoOperativoPedidoDb,
  PermissionKey,
} from "@zero-delivery/shared-types";

export const ALLOWED_TRANSITIONS: Record<
  EstadoOperativoPedidoDb,
  EstadoOperativoPedidoDb[]
> = {
  NUEVO: ["CONFIRMADO", "RECHAZADO", "CANCELADO"],
  CONFIRMADO: ["EN_PREPARACION", "CANCELACION_SOLICITADA", "CANCELADO"],
  EN_PREPARACION: ["LISTO", "CANCELACION_SOLICITADA"],
  LISTO: [
    "REPARTIDOR_ASIGNADO",
    "REPARTIDOR_EN_RECOJO",
    "EN_CAMINO",
    "CANCELACION_SOLICITADA",
  ],
  REPARTIDOR_ASIGNADO: [
    "REPARTIDOR_EN_RECOJO",
    "EN_CAMINO",
    "CANCELACION_SOLICITADA",
  ],
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
  PENDIENTE_RESOLUCION: [
    "DEVUELTO_A_RESTAURANTE",
    "ENTREGADO",
    "CANCELADO",
  ],
  ENTREGADO: [],
  RECHAZADO: [],
  CANCELADO: [],
  DEVUELTO_A_RESTAURANTE: [],
};

export const TRANSITION_PERMISSIONS: Partial<
  Record<EstadoOperativoPedidoDb, PermissionKey>
> = {
  CONFIRMADO: "order.accept_reject",
  RECHAZADO: "order.accept_reject",
  EN_PREPARACION: "order.start_prepare",
  LISTO: "order.mark_ready",
  REPARTIDOR_ASIGNADO: "order.assign_rider",
  REPARTIDOR_EN_RECOJO: "delivery.update_own",
  EN_CAMINO: "order.handoff_to_rider",
  ENTREGADO: "delivery.update_own",
  ENTREGA_FALLIDA: "delivery.update_own",
  DEVOLUCION_PENDIENTE: "delivery.update_own",
  DEVUELTO_A_RESTAURANTE: "return.confirm_physical",
  PENDIENTE_RESOLUCION: "return.resolve",
  CANCELACION_SOLICITADA: "order.cancel.request",
  CANCELADO: "order.cancel.authorize",
};

export const STATES_REQUIRING_MOTIVO: EstadoOperativoPedidoDb[] = [
  "RECHAZADO",
  "CANCELADO",
  "CANCELACION_SOLICITADA",
  "ENTREGA_FALLIDA",
  "PENDIENTE_RESOLUCION",
];
