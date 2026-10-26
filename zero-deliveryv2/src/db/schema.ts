import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  smallint,
  bigint,
  numeric,
  date,
  time,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

// =============================================================================
// 1. IDENTIDAD Y ESTRUCTURA
// =============================================================================

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tenantCounters = pgTable(
  "tenant_counters",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    value: bigint("value", { mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.name] })],
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(), // ADMIN | COORDINATOR | BRANCH_MANAGER | SUPPORT_AGENT | RIDER
    isActive: boolean("is_active").notNull().default(true),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_tenant_role_idx").on(t.tenantId, t.role)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

export const restaurants = pgTable(
  "restaurants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    legalName: text("legal_name"),
    ruc: text("ruc"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("restaurants_tenant_idx").on(t.tenantId)],
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    address: text("address").notNull(),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    phone: text("phone"),
    isOpenManual: boolean("is_open_manual").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("branches_tenant_slug_uq").on(t.tenantId, t.slug),
    index("branches_restaurant_idx").on(t.restaurantId),
  ],
);

export const userBranchAccess = pgTable(
  "user_branch_access",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.branchId] })],
);

export const branchSchedules = pgTable(
  "branch_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    shiftNo: smallint("shift_no").notNull().default(1),
    opensAt: time("opens_at").notNull(),
    closesAt: time("closes_at").notNull(),
  },
  (t) => [uniqueIndex("branch_schedules_uq").on(t.branchId, t.dayOfWeek, t.shiftNo)],
);

export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    feeCents: bigint("fee_cents", { mode: "number" }).notNull().default(0),
    minOrderCents: bigint("min_order_cents", { mode: "number" }).notNull().default(0),
    radiusKm: numeric("radius_km", { precision: 6, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("delivery_zones_branch_name_uq").on(t.branchId, t.name)],
);

export const assets = pgTable(
  "assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    storageKey: text("storage_key").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("assets_tenant_idx").on(t.tenantId)],
);

// =============================================================================
// 2. CATÁLOGO
// =============================================================================

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_restaurant_name_uq").on(t.restaurantId, t.name)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    categoryId: uuid("category_id").references(() => categories.id),
    name: text("name").notNull(),
    description: text("description"),
    imageAssetId: uuid("image_asset_id").references(() => assets.id),
    isFragile: boolean("is_fragile").notNull().default(false),
    basePriceCents: bigint("base_price_cents", { mode: "number" }).notNull(),
    packagingCents: bigint("packaging_cents", { mode: "number" }).notNull().default(0),
    marginType: text("margin_type").notNull().default("FIXED"), // FIXED | PERCENT
    marginValue: numeric("margin_value", { precision: 12, scale: 4 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("products_restaurant_idx").on(t.restaurantId)],
);

export const modifierGroups = pgTable("modifier_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id),
  name: text("name").notNull(),
  minSelect: smallint("min_select").notNull().default(0),
  maxSelect: smallint("max_select").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const modifierOptions = pgTable(
  "modifier_options",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceDeltaCents: bigint("price_delta_cents", { mode: "number" }).notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("modifier_options_group_idx").on(t.groupId)],
);

export const productModifierGroups = pgTable(
  "product_modifier_groups",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => modifierGroups.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.groupId] })],
);

export const menus = pgTable("menus", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  branchId: uuid("branch_id")
    .notNull()
    .references(() => branches.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  includesDeliveryInPrice: boolean("includes_delivery_in_price").notNull().default(false),
  includesTaxInPrice: boolean("includes_tax_in_price").notNull().default(false),
  schedule: jsonb("schedule"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    menuId: uuid("menu_id")
      .notNull()
      .references(() => menus.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    priceCents: bigint("price_cents", { mode: "number" }).notNull(),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    uniqueIndex("menu_items_menu_product_uq").on(t.menuId, t.productId),
    index("menu_items_product_idx").on(t.productId),
  ],
);

// =============================================================================
// 3. CLIENTES
// =============================================================================

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    phoneE164: text("phone_e164").notNull(),
    email: text("email"),
    segment: text("segment").notNull().default("NEW"), // NEW | RECURRING | TOP
    riskFlag: text("risk_flag").notNull().default("NONE"), // NONE | CAUTION | BLOCKED
    riskReason: text("risk_reason"),
    riskSetBy: uuid("risk_set_by").references(() => users.id),
    riskSetAt: timestamp("risk_set_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("customers_tenant_phone_uq").on(t.tenantId, t.phoneE164)],
);

export const customerAddresses = pgTable(
  "customer_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    label: text("label"),
    addressText: text("address_text").notNull(),
    reference: text("reference"),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lng: numeric("lng", { precision: 9, scale: 6 }),
    zoneId: uuid("zone_id").references(() => deliveryZones.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("customer_addresses_customer_idx").on(t.customerId)],
);

// =============================================================================
// 4. REPARTIDORES
// =============================================================================

export const riders = pgTable(
  "riders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: uuid("user_id")
      .unique()
      .references(() => users.id),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    birthDate: date("birth_date").notNull(),
    fleetType: text("fleet_type").notNull(), // OWN | AGENCY | THIRD_PARTY
    agencyName: text("agency_name"),
    vehicleType: text("vehicle_type").notNull(), // MOTO | CAR
    status: text("status").notNull().default("OFFLINE"), // AVAILABLE | BUSY | ON_THE_WAY | OFFLINE
    highTrust: boolean("high_trust").notNull().default(false),
    trustScore: numeric("trust_score", { precision: 5, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("riders_tenant_status_idx").on(t.tenantId, t.status)],
);

// =============================================================================
// 5. PEDIDOS
// =============================================================================

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    number: bigint("number", { mode: "number" }).notNull().default(0),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    addressSnapshot: jsonb("address_snapshot").notNull(),
    channel: text("channel").notNull().default("MANUAL"), // MANUAL | WEB | WHATSAPP | CRM
    operationalStatus: text("operational_status").notNull().default("NEW"),
    paymentStatus: text("payment_status").notNull().default("PENDING"),
    paymentMethod: text("payment_method").notNull(), // CASH | YAPE | BANK_TRANSFER
    restaurantPayoutStatus: text("restaurant_payout_status").notNull().default("PENDING"),
    handoffAt: timestamp("handoff_at", { withTimezone: true }),
    handoffBy: uuid("handoff_by").references(() => users.id),
    releasedAt: timestamp("released_at", { withTimezone: true }),
    releasedBy: uuid("released_by").references(() => users.id),
    riderId: uuid("rider_id").references(() => riders.id),
    deliveryZoneId: uuid("delivery_zone_id").references(() => deliveryZones.id),
    attemptsCount: smallint("attempts_count").notNull().default(0),
    prevStatusBeforeCancelRequest: text("prev_status_before_cancel_request"),
    resolution: text("resolution"),
    itemsSubtotalCents: bigint("items_subtotal_cents", { mode: "number" }).notNull(),
    discountCents: bigint("discount_cents", { mode: "number" }).notNull().default(0),
    deliveryFeeCents: bigint("delivery_fee_cents", { mode: "number" }).notNull().default(0),
    taxCents: bigint("tax_cents", { mode: "number" }).notNull().default(0),
    totalCents: bigint("total_cents", { mode: "number" }).notNull(),
    cashToCollectCents: bigint("cash_to_collect_cents", { mode: "number" }).notNull().default(0),
    invoiceRequested: boolean("invoice_requested").notNull().default(false),
    publicToken: text("public_token").notNull().unique(),
    idempotencyKey: text("idempotency_key"),
    notes: text("notes"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_tenant_number_uq").on(t.tenantId, t.number),
    index("orders_branch_status_idx").on(t.tenantId, t.branchId, t.operationalStatus),
    index("orders_status_created_idx").on(t.tenantId, t.operationalStatus, t.createdAt),
    index("orders_customer_idx").on(t.customerId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    nameSnapshot: text("name_snapshot").notNull(),
    qty: integer("qty").notNull(),
    basePriceCents: bigint("base_price_cents", { mode: "number" }).notNull(),
    packagingCents: bigint("packaging_cents", { mode: "number" }).notNull().default(0),
    marginCents: bigint("margin_cents", { mode: "number" }).notNull().default(0),
    unitPriceCents: bigint("unit_price_cents", { mode: "number" }).notNull(),
    lineTotalCents: bigint("line_total_cents", { mode: "number" }).notNull(),
    status: text("status").notNull().default("ACTIVE"), // ACTIVE | UNAVAILABLE | REPLACED | CANCELLED
    unavailableReason: text("unavailable_reason"),
    replacementOfItemId: uuid("replacement_of_item_id"),
    customerDecision: text("customer_decision"), // ACCEPTED_REPLACEMENT | CANCELLED_ITEM
    customerDecidedAt: timestamp("customer_decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderItemModifiers = pgTable(
  "order_item_modifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderItemId: uuid("order_item_id")
      .notNull()
      .references(() => orderItems.id, { onDelete: "cascade" }),
    nameSnapshot: text("name_snapshot").notNull(),
    priceDeltaCents: bigint("price_delta_cents", { mode: "number" }).notNull().default(0),
  },
  (t) => [index("order_item_modifiers_item_idx").on(t.orderItemId)],
);

export const orderStatusHistory = pgTable(
  "order_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    actorRole: text("actor_role"),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_status_history_order_idx").on(t.orderId, t.createdAt)],
);

export const orderNotes = pgTable(
  "order_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id),
    kind: text("kind").notNull().default("NOTE"), // NOTE | INCIDENT | SYSTEM
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_notes_order_idx").on(t.orderId, t.createdAt)],
);

export const orderIncidents = pgTable(
  "order_incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    type: text("type").notNull(),
    description: text("description").notNull(),
    evidenceAssetIds: uuid("evidence_asset_ids").array().notNull().default([]),
    reviewerId: uuid("reviewer_id").references(() => users.id),
    decision: text("decision"),
    amountCents: bigint("amount_cents", { mode: "number" }),
    justification: text("justification"),
    status: text("status").notNull().default("OPEN"), // OPEN | UNDER_REVIEW | DECIDED | CLOSED
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_incidents_order_idx").on(t.orderId)],
);

export const deliveryAttempts = pgTable(
  "delivery_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    attemptNo: smallint("attempt_no").notNull(),
    riderId: uuid("rider_id")
      .notNull()
      .references(() => riders.id),
    outcome: text("outcome").notNull().default("IN_PROGRESS"), // IN_PROGRESS | DELIVERED | FAILED
    failureReason: text("failure_reason"),
    notes: text("notes"),
    evidenceAssetId: uuid("evidence_asset_id").references(() => assets.id),
    cashCollectedCents: bigint("cash_collected_cents", { mode: "number" }),
    authorizedBy: uuid("authorized_by").references(() => users.id),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("delivery_attempts_order_attempt_uq").on(t.orderId, t.attemptNo),
    index("delivery_attempts_rider_idx").on(t.riderId, t.startedAt),
  ],
);

export const riderLocationPings = pgTable(
  "rider_location_pings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    riderId: uuid("rider_id")
      .notNull()
      .references(() => riders.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id),
    lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
    lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),
    accuracyM: numeric("accuracy_m", { precision: 8, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("rider_location_pings_rider_idx").on(t.riderId, t.createdAt)],
);

// =============================================================================
// 6. PAGOS
// =============================================================================

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    method: text("method").notNull(), // CASH | YAPE | BANK_TRANSFER
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    status: text("status").notNull().default("PENDING"), // PENDING | PAID | REJECTED | REFUNDED
    proofAssetId: uuid("proof_asset_id").references(() => assets.id),
    reference: text("reference"),
    validatedBy: uuid("validated_by").references(() => users.id),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_order_idx").on(t.orderId), index("payments_status_idx").on(t.tenantId, t.status)],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    type: text("type").notNull(), // CREATED | VALIDATED | REJECTED | CORRECTED | REFUNDED
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
    actorId: uuid("actor_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payment_events_payment_idx").on(t.paymentId, t.createdAt)],
);

export const restaurantPayouts = pgTable("restaurant_payouts", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  orderId: uuid("order_id")
    .notNull()
    .unique()
    .references(() => orders.id),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  status: text("status").notNull().default("PENDING"), // PENDING | CONFIRMED
  method: text("method"),
  reference: text("reference"),
  confirmedBy: uuid("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    paymentId: uuid("payment_id").references(() => payments.id),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    reason: text("reason").notNull(),
    authorizedBy: uuid("authorized_by")
      .notNull()
      .references(() => users.id),
    method: text("method"),
    reference: text("reference"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("refunds_order_idx").on(t.orderId)],
);

// =============================================================================
// 7. FINANZAS DEL REPARTIDOR (GARANTÍA / ADELANTOS / LIQUIDACIONES)
// =============================================================================

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    riderId: uuid("rider_id")
      .notNull()
      .references(() => riders.id),
    businessDate: date("business_date").notNull(),
    cutoffAt: timestamp("cutoff_at", { withTimezone: true }).notNull(),
    cashCollectedCents: bigint("cash_collected_cents", { mode: "number" }).notNull().default(0),
    cashReceivedCents: bigint("cash_received_cents", { mode: "number" }).notNull().default(0),
    advancesDeductedCents: bigint("advances_deducted_cents", { mode: "number" }).notNull().default(0),
    riderFeeReferenceCents: bigint("rider_fee_reference_cents", { mode: "number" }).notNull().default(0),
    riderFeePayableCents: bigint("rider_fee_payable_cents", { mode: "number" }).notNull().default(0),
    riderFeeOverrideReason: text("rider_fee_override_reason"),
    netCents: bigint("net_cents", { mode: "number" }).notNull().default(0),
    status: text("status").notNull().default("DRAFT"), // DRAFT | CONFIRMED
    confirmedBy: uuid("confirmed_by").references(() => users.id),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("settlements_rider_date_uq").on(t.riderId, t.businessDate),
    index("settlements_tenant_date_idx").on(t.tenantId, t.businessDate),
  ],
);

export const riderAdvances = pgTable("rider_advances", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  riderId: uuid("rider_id")
    .notNull()
    .references(() => riders.id),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  purpose: text("purpose").notNull().default("FUEL"),
  authorizedBy: uuid("authorized_by")
    .notNull()
    .references(() => users.id),
  status: text("status").notNull().default("PENDING_DEDUCTION"), // PENDING_DEDUCTION | DEDUCTED
  deductedInSettlementId: uuid("deducted_in_settlement_id").references(() => settlements.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const walletEntries = pgTable(
  "wallet_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    riderId: uuid("rider_id")
      .notNull()
      .references(() => riders.id),
    type: text("type").notNull(), // GUARANTEE_DEPOSIT | GUARANTEE_WITHDRAWAL | CASH_COLLECTED | CASH_SETTLED | ADJUSTMENT
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    advanceId: uuid("advance_id").references(() => riderAdvances.id),
    settlementId: uuid("settlement_id").references(() => settlements.id),
    reason: text("reason"),
    actorId: uuid("actor_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wallet_entries_rider_idx").on(t.riderId, t.createdAt)],
);

// =============================================================================
// 8. TRANSVERSALES E INTEGRACIÓN (VOCERO CRM / OUTBOX / AUDITORÍA)
// =============================================================================

export const ratings = pgTable("ratings", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),
  subjectType: text("subject_type").notNull(), // RESTAURANT | RIDER | CUSTOMER
  subjectId: uuid("subject_id").notNull(),
  raterType: text("rater_type").notNull(), // CUSTOMER | RIDER | STAFF
  stars: smallint("stars").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: text("type").notNull(),
    severity: text("severity").notNull().default("INFO"), // INFO | WARNING | CRITICAL
    orderId: uuid("order_id").references(() => orders.id),
    riderId: uuid("rider_id").references(() => riders.id),
    branchId: uuid("branch_id").references(() => branches.id),
    payload: jsonb("payload").notNull().default({}),
    dedupeKey: text("dedupe_key").notNull(),
    status: text("status").notNull().default("OPEN"), // OPEN | ACK | RESOLVED
    ackedBy: uuid("acked_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("alerts_tenant_dedupe_uq").on(t.tenantId, t.dedupeKey)],
);

export const settings = pgTable(
  "settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    isPlaceholder: boolean("is_placeholder").notNull().default(false),
    updatedBy: uuid("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("settings_tenant_key_uq").on(t.tenantId, t.key)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    actorId: uuid("actor_id").references(() => users.id),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    objectType: text("object_type").notNull(),
    objectId: text("object_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    requestId: text("request_id"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("audit_logs_object_idx").on(t.tenantId, t.objectType, t.objectId),
  ],
);

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    dedupeKey: text("dedupe_key"),
    status: text("status").notNull().default("PENDING"), // PENDING | PROCESSING | SENT | FAILED | DEAD
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [index("outbox_pending_idx").on(t.nextAttemptAt)],
);

export const inboundEvents = pgTable(
  "inbound_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status").notNull().default("RECEIVED"), // RECEIVED | PROCESSED | FAILED | IGNORED
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("inbound_events_provider_ext_uq").on(t.provider, t.externalEventId),
    index("inbound_events_status_idx").on(t.status, t.receivedAt),
  ],
);

export const funnelEvents = pgTable(
  "funnel_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    branchId: uuid("branch_id").references(() => branches.id),
    sessionId: text("session_id").notNull(),
    step: text("step").notNull(), // IMPRESSION | MENU_VIEW | ADD_TO_CART | PURCHASE
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("funnel_events_idx").on(t.tenantId, t.branchId, t.createdAt)],
);

export const promotions = pgTable("promotions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id),
  restaurantId: uuid("restaurant_id").references(() => restaurants.id),
  branchId: uuid("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // DISCOUNT | COUPON | COMBO
  code: text("code"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promotionRules = pgTable("promotion_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  promotionId: uuid("promotion_id")
    .notNull()
    .references(() => promotions.id, { onDelete: "cascade" }),
  rule: jsonb("rule").notNull(),
});

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  keys: jsonb("keys").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
