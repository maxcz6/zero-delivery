import type { Cents } from "@/shared/money";
import type { OrderStatus } from "@/modules/orders/domain/transitions";

export type OutboundMessage = {
  tenantId: string;
  channel: "IN_APP" | "WHATSAPP" | "VOCERO_CRM";
  recipientPhoneE164?: string;
  voceroConversationId?: string;
  templateKey: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export type SendResult = {
  ok: boolean;
  externalMessageId?: string;
  errorReason?: string;
};

export interface NotificationPort {
  send(msg: OutboundMessage): Promise<SendResult>;
}

export type CrmCustomerSyncPayload = {
  tenantId: string;
  customerId: string;
  name: string;
  phoneE164: string;
  segment: "NEW" | "RECURRING" | "TOP";
  voceroConversationId?: string;
};

export type CrmOrderSyncPayload = {
  tenantId: string;
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
  totalCents: Cents;
  customerPhoneE164: string;
  voceroConversationId?: string;
};

export interface CrmPort {
  upsertCustomer(customer: CrmCustomerSyncPayload): Promise<void>;
  pushOrder(order: CrmOrderSyncPayload): Promise<void>;
  pushOrderStatus(params: {
    orderId: string;
    orderNumber: number;
    status: OrderStatus;
    voceroConversationId?: string;
  }): Promise<void>;
  requestHumanHandoff(params: {
    voceroConversationId: string;
    reason: "cliente" | "modelo" | "error" | "ventana" | "hostilidad";
  }): Promise<void>;
}

export type AssetRef = {
  storageKey: string;
  mime: string;
  sizeBytes: number;
};

export interface StoragePort {
  put(params: { key: string; buffer: Buffer; mime: string }): Promise<AssetRef>;
  getUrl(storageKey: string): Promise<string>;
}
