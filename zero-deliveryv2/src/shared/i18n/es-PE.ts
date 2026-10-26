/**
 * Diccionario i18n centralizado para Español (Perú, es-PE).
 * Sección 6, 8 y 14 del Spec: ningún texto visible al usuario va hardcodeado sin pasar por aquí.
 */

export const ES_PE = {
  app: {
    name: "Zero Delivery",
    tagline: "Plataforma Operativa Multi-Restaurante y Logística",
    currencySymbol: "S/",
    timezone: "America/Lima",
  },
  roles: {
    ADMIN: "Administrador",
    COORDINATOR: "Coordinador",
    BRANCH_MANAGER: "Encargado",
    SUPPORT_AGENT: "Empleado",
    RIDER: "Repartidor",
  },
  orderStatus: {
    NEW: "Nuevo",
    CONFIRMED: "Confirmado",
    PREPARING: "En preparación",
    READY: "Listo",
    RIDER_ASSIGNED: "Repartidor asignado",
    RIDER_AT_PICKUP: "Rider cerca del punto de retiro",
    ON_THE_WAY: "En camino",
    DELIVERED: "Entregado",
    REJECTED: "Rechazado",
    CANCELLATION_REQUESTED: "Cancelación solicitada",
    CANCELLED: "Cancelado",
    DELIVERY_FAILED: "Entrega fallida",
    RETURN_PENDING: "Devolución pendiente",
    RETURNED_TO_RESTAURANT: "Devuelto al restaurante",
    PENDING_RESOLUTION: "Pendiente de resolución",
  },
  paymentStatus: {
    PENDING: "Pendiente",
    PAID: "Pagado",
    REJECTED: "Rechazado",
    REFUNDED: "Reembolsado",
  },
  paymentMethod: {
    CASH: "Efectivo",
    YAPE: "Yape",
    BANK_TRANSFER: "Transferencia bancaria",
  },
  payoutStatus: {
    PENDING: "Pago al local pendiente",
    CONFIRMED: "Pago al local confirmado",
  },
  riderLabels: {
    alreadyPaidNoCollection: "Ya pagado — sin cobro al cliente",
    collectCashPrefix: "Cobrar en efectivo:",
    fragileWarning: "Producto frágil / sensible — requiere manejo especial",
    shareLocationButton: "Compartir mi ubicación actual",
    openInGoogleMaps: "Abrir en Google Maps",
  },
  offlineBanner:
    "Sin conexión a internet. Puedes consultar los datos en caché, pero las acciones requieren conexión activa.",
} as const;
