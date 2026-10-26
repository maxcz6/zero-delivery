import type { Cents } from "@/shared/money";
import type { OrderStatus } from "./transitions";
import type { PaymentMethod, PaymentStatus, PayoutStatus } from "./release-gate";

export type OrderDomainRecord = {
  id: string;
  tenantId: string;
  number: number;
  branchId: string;
  branchName: string;
  customerId: string;
  customerName: string;
  customerPhoneE164: string;
  addressText: string;
  addressReference?: string | null;
  operationalStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  restaurantPayoutStatus: PayoutStatus;
  itemsSubtotalCents: Cents;
  discountCents: Cents;
  deliveryFeeCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  cashToCollectCents: Cents;
  handoffAt: string | null;
  releasedAt: string | null;
  riderId: string | null;
  riderName?: string | null;
  riderLastPing?: {
    lat: number;
    lng: number;
    createdAt: string;
  } | null;
  items: {
    id: string;
    nameSnapshot: string;
    qty: number;
    basePriceCents: Cents;
    packagingCents: Cents;
    marginCents: Cents;
    unitPriceCents: Cents;
    lineTotalCents: Cents;
    isFragile: boolean;
    status: "ACTIVE" | "UNAVAILABLE" | "REPLACED" | "CANCELLED";
  }[];
  createdAt: string;
};

/**
 * DTO público para el Cliente Final (/p/[publicToken]).
 * Regla 7.8 y CA-12: JAMÁS incluye basePriceCents, packagingCents, marginCents,
 * restaurantPayoutStatus ni la ubicación GPS del repartidor.
 */
export type CustomerOrderDTO = {
  number: number;
  branchName: string;
  operationalStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  totalCents: Cents;
  deliveryFeeCents: Cents | null;
  items: {
    name: string;
    qty: number;
    unitPriceCents: Cents;
    lineTotalCents: Cents;
    status: "ACTIVE" | "UNAVAILABLE" | "REPLACED" | "CANCELLED";
  }[];
  createdAt: string;
};

/**
 * DTO para el Encargado de Sucursal (`BRANCH_MANAGER`).
 * Nota A (Sección 6): Después de salir del local (`ON_THE_WAY`), el encargado
 * solo ve que está en reparto hasta conocer el estado final (`DELIVERED` / `DELIVERY_FAILED` / devolución),
 * y NUNCA ve la ubicación GPS del repartidor ni el margen de la agencia.
 */
export type BranchManagerOrderDTO = {
  id: string;
  number: number;
  branchId: string;
  visibleOperationalStatus: OrderStatus | "DISPATCHED_IN_TRANSIT";
  restaurantPayoutStatus: PayoutStatus;
  handoffAt: string | null;
  items: {
    id: string;
    nameSnapshot: string;
    qty: number;
    basePriceCents: Cents;
    packagingCents: Cents;
    isFragile: boolean;
    status: "ACTIVE" | "UNAVAILABLE" | "REPLACED" | "CANCELLED";
  }[];
  createdAt: string;
};

/**
 * DTO completo para Staff de Agencia (`ADMIN`, `COORDINATOR`, `SUPPORT_AGENT`).
 */
export type StaffOrderDTO = OrderDomainRecord;

export function toCustomerOrderDTO(
  order: OrderDomainRecord,
  options: { includesDeliveryInPrice?: boolean } = {},
): CustomerOrderDTO {
  return {
    number: order.number,
    branchName: order.branchName,
    operationalStatus: order.operationalStatus,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    totalCents: order.totalCents,
    deliveryFeeCents: options.includesDeliveryInPrice ? null : order.deliveryFeeCents,
    items: order.items.map((item) => ({
      name: item.nameSnapshot,
      qty: item.qty,
      unitPriceCents: item.unitPriceCents,
      lineTotalCents: item.lineTotalCents,
      status: item.status,
    })),
    createdAt: order.createdAt,
  };
}

export function toBranchManagerOrderDTO(order: OrderDomainRecord): BranchManagerOrderDTO {
  // Nota A: Después de salir del local solo ve el estado final o devolución
  const visibleStatus: OrderStatus | "DISPATCHED_IN_TRANSIT" =
    order.operationalStatus === "ON_THE_WAY" ? "DISPATCHED_IN_TRANSIT" : order.operationalStatus;

  return {
    id: order.id,
    number: order.number,
    branchId: order.branchId,
    visibleOperationalStatus: visibleStatus,
    restaurantPayoutStatus: order.restaurantPayoutStatus,
    handoffAt: order.handoffAt,
    items: order.items.map((item) => ({
      id: item.id,
      nameSnapshot: item.nameSnapshot,
      qty: item.qty,
      basePriceCents: item.basePriceCents,
      packagingCents: item.packagingCents,
      isFragile: item.isFragile,
      status: item.status,
    })),
    createdAt: order.createdAt,
  };
}

export function toStaffOrderDTO(order: OrderDomainRecord): StaffOrderDTO {
  return { ...order };
}
