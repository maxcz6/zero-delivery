import { z } from "zod";

/**
 * Roles del sistema (Código inglés de aplicación <-> Valor español en BD)
 */
export const RolUsuarioDb = {
  ADMINISTRADOR: "ADMINISTRADOR",
  COORDINADOR: "COORDINADOR",
  ENCARGADO_SUCURSAL: "ENCARGADO_SUCURSAL",
  AGENTE_SOPORTE: "AGENTE_SOPORTE",
  REPARTIDOR: "REPARTIDOR",
} as const;

export type RolUsuarioDb = (typeof RolUsuarioDb)[keyof typeof RolUsuarioDb];

export const UserRole = {
  ADMIN: "ADMIN",
  COORDINATOR: "COORDINATOR",
  BRANCH_MANAGER: "BRANCH_MANAGER",
  SUPPORT_AGENT: "SUPPORT_AGENT",
  RIDER: "RIDER",
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const roleToDbRole: Record<UserRole, RolUsuarioDb> = {
  [UserRole.ADMIN]: RolUsuarioDb.ADMINISTRADOR,
  [UserRole.COORDINATOR]: RolUsuarioDb.COORDINADOR,
  [UserRole.BRANCH_MANAGER]: RolUsuarioDb.ENCARGADO_SUCURSAL,
  [UserRole.SUPPORT_AGENT]: RolUsuarioDb.AGENTE_SOPORTE,
  [UserRole.RIDER]: RolUsuarioDb.REPARTIDOR,
};

export const dbRoleToRole: Record<RolUsuarioDb, UserRole> = {
  [RolUsuarioDb.ADMINISTRADOR]: UserRole.ADMIN,
  [RolUsuarioDb.COORDINADOR]: UserRole.COORDINATOR,
  [RolUsuarioDb.ENCARGADO_SUCURSAL]: UserRole.BRANCH_MANAGER,
  [RolUsuarioDb.AGENTE_SOPORTE]: UserRole.SUPPORT_AGENT,
  [RolUsuarioDb.REPARTIDOR]: UserRole.RIDER,
};

/**
 * Estados Operativos del Pedido
 */
export const EstadoOperativoPedidoDb = {
  NUEVO: "NUEVO",
  CONFIRMADO: "CONFIRMADO",
  EN_PREPARACION: "EN_PREPARACION",
  LISTO: "LISTO",
  REPARTIDOR_ASIGNADO: "REPARTIDOR_ASIGNADO",
  REPARTIDOR_EN_RECOJO: "REPARTIDOR_EN_RECOJO",
  EN_CAMINO: "EN_CAMINO",
  ENTREGADO: "ENTREGADO",
  RECHAZADO: "RECHAZADO",
  CANCELACION_SOLICITADA: "CANCELACION_SOLICITADA",
  CANCELADO: "CANCELADO",
  ENTREGA_FALLIDA: "ENTREGA_FALLIDA",
  DEVOLUCION_PENDIENTE: "DEVOLUCION_PENDIENTE",
  DEVUELTO_A_RESTAURANTE: "DEVUELTO_A_RESTAURANTE",
  PENDIENTE_RESOLUCION: "PENDIENTE_RESOLUCION",
} as const;

export type EstadoOperativoPedidoDb =
  (typeof EstadoOperativoPedidoDb)[keyof typeof EstadoOperativoPedidoDb];

export const OrderStatus = {
  NEW: "NEW",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  READY: "READY",
  RIDER_ASSIGNED: "RIDER_ASSIGNED",
  RIDER_AT_PICKUP: "RIDER_AT_PICKUP",
  ON_THE_WAY: "ON_THE_WAY",
  DELIVERED: "DELIVERED",
  REJECTED: "REJECTED",
  CANCELLATION_REQUESTED: "CANCELLATION_REQUESTED",
  CANCELLED: "CANCELLED",
  DELIVERY_FAILED: "DELIVERY_FAILED",
  RETURN_PENDING: "RETURN_PENDING",
  RETURNED_TO_RESTAURANT: "RETURNED_TO_RESTAURANT",
  PENDING_RESOLUTION: "PENDING_RESOLUTION",
} as const;

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const orderStatusToDb: Record<OrderStatus, EstadoOperativoPedidoDb> = {
  [OrderStatus.NEW]: EstadoOperativoPedidoDb.NUEVO,
  [OrderStatus.CONFIRMED]: EstadoOperativoPedidoDb.CONFIRMADO,
  [OrderStatus.PREPARING]: EstadoOperativoPedidoDb.EN_PREPARACION,
  [OrderStatus.READY]: EstadoOperativoPedidoDb.LISTO,
  [OrderStatus.RIDER_ASSIGNED]: EstadoOperativoPedidoDb.REPARTIDOR_ASIGNADO,
  [OrderStatus.RIDER_AT_PICKUP]: EstadoOperativoPedidoDb.REPARTIDOR_EN_RECOJO,
  [OrderStatus.ON_THE_WAY]: EstadoOperativoPedidoDb.EN_CAMINO,
  [OrderStatus.DELIVERED]: EstadoOperativoPedidoDb.ENTREGADO,
  [OrderStatus.REJECTED]: EstadoOperativoPedidoDb.RECHAZADO,
  [OrderStatus.CANCELLATION_REQUESTED]: EstadoOperativoPedidoDb.CANCELACION_SOLICITADA,
  [OrderStatus.CANCELLED]: EstadoOperativoPedidoDb.CANCELADO,
  [OrderStatus.DELIVERY_FAILED]: EstadoOperativoPedidoDb.ENTREGA_FALLIDA,
  [OrderStatus.RETURN_PENDING]: EstadoOperativoPedidoDb.DEVOLUCION_PENDIENTE,
  [OrderStatus.RETURNED_TO_RESTAURANT]: EstadoOperativoPedidoDb.DEVUELTO_A_RESTAURANTE,
  [OrderStatus.PENDING_RESOLUTION]: EstadoOperativoPedidoDb.PENDIENTE_RESOLUCION,
};

export const dbToOrderStatus: Record<EstadoOperativoPedidoDb, OrderStatus> = {
  [EstadoOperativoPedidoDb.NUEVO]: OrderStatus.NEW,
  [EstadoOperativoPedidoDb.CONFIRMADO]: OrderStatus.CONFIRMED,
  [EstadoOperativoPedidoDb.EN_PREPARACION]: OrderStatus.PREPARING,
  [EstadoOperativoPedidoDb.LISTO]: OrderStatus.READY,
  [EstadoOperativoPedidoDb.REPARTIDOR_ASIGNADO]: OrderStatus.RIDER_ASSIGNED,
  [EstadoOperativoPedidoDb.REPARTIDOR_EN_RECOJO]: OrderStatus.RIDER_AT_PICKUP,
  [EstadoOperativoPedidoDb.EN_CAMINO]: OrderStatus.ON_THE_WAY,
  [EstadoOperativoPedidoDb.ENTREGADO]: OrderStatus.DELIVERED,
  [EstadoOperativoPedidoDb.RECHAZADO]: OrderStatus.REJECTED,
  [EstadoOperativoPedidoDb.CANCELACION_SOLICITADA]: OrderStatus.CANCELLATION_REQUESTED,
  [EstadoOperativoPedidoDb.CANCELADO]: OrderStatus.CANCELLED,
  [EstadoOperativoPedidoDb.ENTREGA_FALLIDA]: OrderStatus.DELIVERY_FAILED,
  [EstadoOperativoPedidoDb.DEVOLUCION_PENDIENTE]: OrderStatus.RETURN_PENDING,
  [EstadoOperativoPedidoDb.DEVUELTO_A_RESTAURANTE]: OrderStatus.RETURNED_TO_RESTAURANT,
  [EstadoOperativoPedidoDb.PENDIENTE_RESOLUCION]: OrderStatus.PENDING_RESOLUTION,
};

/**
 * Estados de Pago del Cliente
 */
export const EstadoPagoDb = {
  PENDIENTE: "PENDIENTE",
  PAGADO: "PAGADO",
  RECHAZADO: "RECHAZADO",
  REEMBOLSADO: "REEMBOLSADO",
} as const;

export type EstadoPagoDb = (typeof EstadoPagoDb)[keyof typeof EstadoPagoDb];

export const PaymentStatus = {
  PENDING: "PENDING",
  PAID: "PAID",
  REJECTED: "REJECTED",
  REFUNDED: "REFUNDED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const paymentStatusToDb: Record<PaymentStatus, EstadoPagoDb> = {
  [PaymentStatus.PENDING]: EstadoPagoDb.PENDIENTE,
  [PaymentStatus.PAID]: EstadoPagoDb.PAGADO,
  [PaymentStatus.REJECTED]: EstadoPagoDb.RECHAZADO,
  [PaymentStatus.REFUNDED]: EstadoPagoDb.REEMBOLSADO,
};

export const dbToPaymentStatus: Record<EstadoPagoDb, PaymentStatus> = {
  [EstadoPagoDb.PENDIENTE]: PaymentStatus.PENDING,
  [EstadoPagoDb.PAGADO]: PaymentStatus.PAID,
  [EstadoPagoDb.RECHAZADO]: PaymentStatus.REJECTED,
  [EstadoPagoDb.REEMBOLSADO]: PaymentStatus.REFUNDED,
};

/**
 * Métodos de Pago
 */
export const MetodoPagoDb = {
  EFECTIVO: "EFECTIVO",
  YAPE: "YAPE",
  TRANSFERENCIA_BANCARIA: "TRANSFERENCIA_BANCARIA",
} as const;

export type MetodoPagoDb = (typeof MetodoPagoDb)[keyof typeof MetodoPagoDb];

export const PaymentMethod = {
  CASH: "CASH",
  YAPE: "YAPE",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const paymentMethodToDb: Record<PaymentMethod, MetodoPagoDb> = {
  [PaymentMethod.CASH]: MetodoPagoDb.EFECTIVO,
  [PaymentMethod.YAPE]: MetodoPagoDb.YAPE,
  [PaymentMethod.BANK_TRANSFER]: MetodoPagoDb.TRANSFERENCIA_BANCARIA,
};

export const dbToPaymentMethod: Record<MetodoPagoDb, PaymentMethod> = {
  [MetodoPagoDb.EFECTIVO]: PaymentMethod.CASH,
  [MetodoPagoDb.YAPE]: PaymentMethod.YAPE,
  [MetodoPagoDb.TRANSFERENCIA_BANCARIA]: PaymentMethod.BANK_TRANSFER,
};

/**
 * Tipos de Movimiento de Billetera (Ledger de Repartidor)
 */
export const TipoMovimientoBilleteraDb = {
  DEPOSITO_GARANTIA: "DEPOSITO_GARANTIA",
  RETIRO_GARANTIA: "RETIRO_GARANTIA",
  EFECTIVO_COBRADO: "EFECTIVO_COBRADO",
  EFECTIVO_LIQUIDADO: "EFECTIVO_LIQUIDADO",
  AJUSTE: "AJUSTE",
} as const;

export type TipoMovimientoBilleteraDb =
  (typeof TipoMovimientoBilleteraDb)[keyof typeof TipoMovimientoBilleteraDb];

// Schemas Zod
export const userRoleSchema = z.nativeEnum(UserRole);
export const orderStatusSchema = z.nativeEnum(OrderStatus);
export const paymentStatusSchema = z.nativeEnum(PaymentStatus);
export const paymentMethodSchema = z.nativeEnum(PaymentMethod);
