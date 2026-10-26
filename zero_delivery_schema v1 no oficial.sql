-- =============================================================================
-- ZERO DELIVERY — Esquema PostgreSQL (MVP escalable)
-- Compatible con PostgreSQL 14+
-- Convenciones:
--   * PK uuid (gen_random_uuid()). Fechas en timestamptz (UTC); se muestran en America/Lima.
--   * Dinero: bigint en CÉNTIMOS (S/ 12.50 = 1250). Nunca float.
--   * Enums como text + CHECK (más simples de migrar).
--   * Toda tabla de negocio lleva tenant_id (multi-tenant desde el día 1).
--   * Tablas SOLO-INSERCIÓN (append-only): audit_logs, order_status_history,
--     payment_events, wallet_entries  (+ inbound_events con excepción documentada).
-- Uso:  psql -v ON_ERROR_STOP=1 -f zero_delivery_schema.sql <base_de_datos>
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- búsqueda por nombre/teléfono

-- -----------------------------------------------------------------------------
-- 0. FUNCIONES AUXILIARES
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Bloquea UPDATE/DELETE en tablas de solo-inserción.
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo-inserción: % no permitido', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END $$ LANGUAGE plpgsql;

-- inbound_events: solo se pueden actualizar status/processed_at/error/attempts.
CREATE OR REPLACE FUNCTION inbound_events_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'inbound_events no permite DELETE' USING ERRCODE = 'restrict_violation';
  END IF;
  IF (NEW.id, NEW.provider, NEW.external_event_id, NEW.payload, NEW.received_at)
     IS DISTINCT FROM
     (OLD.id, OLD.provider, OLD.external_event_id, OLD.payload, OLD.received_at) THEN
    RAISE EXCEPTION 'inbound_events: solo status/processed_at/error/attempts son modificables'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Contadores por tenant (número de pedido legible y secuencial).
CREATE TABLE tenant_counters (
  tenant_id  uuid NOT NULL,
  name       text NOT NULL,
  value      bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, name)
);

CREATE OR REPLACE FUNCTION next_counter(p_tenant uuid, p_name text) RETURNS bigint AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO tenant_counters (tenant_id, name, value) VALUES (p_tenant, p_name, 1)
  ON CONFLICT (tenant_id, name) DO UPDATE SET value = tenant_counters.value + 1
  RETURNING value INTO v;
  RETURN v;
END $$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. IDENTIDAD Y ESTRUCTURA
-- -----------------------------------------------------------------------------

CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tenant_counters
  ADD CONSTRAINT tenant_counters_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id);

CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  username           text NOT NULL,
  password_hash      text NOT NULL,                       -- argon2id
  display_name       text NOT NULL,
  role               text NOT NULL CHECK (role IN ('ADMIN','COORDINATOR','BRANCH_MANAGER','SUPPORT_AGENT','RIDER')),
  is_active          boolean NOT NULL DEFAULT true,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  last_login_at      timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_username_uq ON users (tenant_id, lower(username));
CREATE INDEX users_tenant_role_idx ON users (tenant_id, role);

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,                       -- hash del token de la cookie
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  ip          inet,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

CREATE TABLE restaurants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  name        text NOT NULL,
  legal_name  text,
  ruc         text CHECK (ruc IS NULL OR ruc ~ '^[0-9]{11}$'),
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurants_tenant_idx ON restaurants (tenant_id);

CREATE TABLE branches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id),
  restaurant_id   uuid NOT NULL REFERENCES restaurants(id),
  name            text NOT NULL,
  slug            text NOT NULL,
  address         text NOT NULL,
  lat             numeric(9,6) CHECK (lat BETWEEN -90 AND 90),
  lng             numeric(9,6) CHECK (lng BETWEEN -180 AND 180),
  phone           text,
  is_open_manual  boolean NOT NULL DEFAULT true,          -- apertura/cierre temporal (Coordinador)
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);
CREATE INDEX branches_restaurant_idx ON branches (restaurant_id);

CREATE TABLE user_branch_access (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id  uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE branch_schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  day_of_week  smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),   -- 0 = domingo
  shift_no     smallint NOT NULL DEFAULT 1 CHECK (shift_no >= 1),
  opens_at     time NOT NULL,
  closes_at    time NOT NULL,                              -- puede ser < opens_at (cruza medianoche)
  UNIQUE (branch_id, day_of_week, shift_no)
);

CREATE TABLE delivery_zones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  branch_id        uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name             text NOT NULL,
  fee_cents        bigint NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  min_order_cents  bigint NOT NULL DEFAULT 0 CHECK (min_order_cents >= 0),
  radius_km        numeric(6,2) CHECK (radius_km IS NULL OR radius_km > 0),   -- extensión futura
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, name)
);

CREATE TABLE assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  storage_key  text NOT NULL,
  mime         text NOT NULL,
  size_bytes   bigint NOT NULL CHECK (size_bytes >= 0),
  uploaded_by  uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assets_tenant_idx ON assets (tenant_id);

-- -----------------------------------------------------------------------------
-- 2. CATÁLOGO
-- -----------------------------------------------------------------------------

CREATE TABLE categories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  name           text NOT NULL,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE TABLE products (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id),
  category_id      uuid REFERENCES categories(id),
  name             text NOT NULL,
  description      text,
  image_asset_id   uuid REFERENCES assets(id),
  is_fragile       boolean NOT NULL DEFAULT false,        -- sensible/frágil (ej. tortas)
  base_price_cents bigint NOT NULL CHECK (base_price_cents >= 0),
  packaging_cents  bigint NOT NULL DEFAULT 0 CHECK (packaging_cents >= 0),
  -- Margen de Zero Delivery. FIXED => margin_value en CÉNTIMOS; PERCENT => porcentaje (ej. 12.5).
  -- La fórmula definitiva está PENDIENTE (DECISION-01).
  margin_type      text NOT NULL DEFAULT 'FIXED' CHECK (margin_type IN ('FIXED','PERCENT')),
  margin_value     numeric(12,4) NOT NULL DEFAULT 0 CHECK (margin_value >= 0),
  is_active        boolean NOT NULL DEFAULT true,
  archived_at      timestamptz,                           -- nunca borrar productos con historial
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX products_restaurant_idx ON products (restaurant_id) WHERE archived_at IS NULL;
CREATE INDEX products_name_trgm_idx ON products USING gin (name gin_trgm_ops);

CREATE TABLE modifier_groups (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id),
  name           text NOT NULL,
  min_select     smallint NOT NULL DEFAULT 0 CHECK (min_select >= 0),
  max_select     smallint NOT NULL DEFAULT 1 CHECK (max_select >= 1),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (max_select >= min_select)
);

CREATE TABLE modifier_options (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id           uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name               text NOT NULL,
  price_delta_cents  bigint NOT NULL DEFAULT 0,           -- puede ser negativo
  is_active          boolean NOT NULL DEFAULT true,
  sort_order         integer NOT NULL DEFAULT 0
);
CREATE INDEX modifier_options_group_idx ON modifier_options (group_id);

CREATE TABLE product_modifier_groups (
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  group_id    uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, group_id)
);

CREATE TABLE menus (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL REFERENCES tenants(id),
  branch_id                   uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name                        text NOT NULL,
  is_default                  boolean NOT NULL DEFAULT false,
  includes_delivery_in_price  boolean NOT NULL DEFAULT false,
  includes_tax_in_price       boolean NOT NULL DEFAULT false,
  schedule                    jsonb,                       -- vigencia opcional de la carta
  is_active                   boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX menus_one_default_per_branch ON menus (branch_id) WHERE is_default;

CREATE TABLE menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id       uuid NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id),
  price_cents   bigint NOT NULL CHECK (price_cents >= 0),  -- precio mostrado al cliente en esta carta
  is_available  boolean NOT NULL DEFAULT true,             -- disponibilidad por sucursal/carta
  sort_order    integer NOT NULL DEFAULT 0,
  UNIQUE (menu_id, product_id)
);
CREATE INDEX menu_items_product_idx ON menu_items (product_id);

-- -----------------------------------------------------------------------------
-- 3. CLIENTES
-- -----------------------------------------------------------------------------

CREATE TABLE customers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  name         text NOT NULL,
  phone_e164   text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email        text,
  segment      text NOT NULL DEFAULT 'NEW' CHECK (segment IN ('NEW','RECURRING','TOP')),
  -- Filtro de seguridad: SOLO marca manual con motivo (sin recopilación externa de datos).
  risk_flag    text NOT NULL DEFAULT 'NONE' CHECK (risk_flag IN ('NONE','CAUTION','BLOCKED')),
  risk_reason  text,
  risk_set_by  uuid REFERENCES users(id),
  risk_set_at  timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (risk_flag = 'NONE' OR (risk_reason IS NOT NULL AND risk_set_by IS NOT NULL)),
  UNIQUE (tenant_id, phone_e164)                            -- deduplicación por teléfono
);
CREATE INDEX customers_name_trgm_idx ON customers USING gin (name gin_trgm_ops);

CREATE TABLE customer_addresses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label        text,
  address_text text NOT NULL,
  reference    text,
  lat          numeric(9,6) CHECK (lat BETWEEN -90 AND 90),
  lng          numeric(9,6) CHECK (lng BETWEEN -180 AND 180),
  zone_id      uuid REFERENCES delivery_zones(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customer_addresses_customer_idx ON customer_addresses (customer_id);

-- -----------------------------------------------------------------------------
-- 4. REPARTIDORES
-- -----------------------------------------------------------------------------

CREATE TABLE riders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  user_id       uuid UNIQUE REFERENCES users(id),
  full_name     text NOT NULL,
  phone         text NOT NULL,
  birth_date    date NOT NULL,
  fleet_type    text NOT NULL CHECK (fleet_type IN ('OWN','AGENCY','THIRD_PARTY')),
  agency_name   text,                                       -- ej. Turbo Delivery, Wanka Flash
  vehicle_type  text NOT NULL CHECK (vehicle_type IN ('MOTO','CAR')),
  status        text NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('AVAILABLE','BUSY','ON_THE_WAY','OFFLINE')),
  high_trust    boolean NOT NULL DEFAULT false,             -- marca manual (Admin/Coordinador)
  trust_score   numeric(5,2) CHECK (trust_score IS NULL OR trust_score BETWEEN 0 AND 100),  -- extensión futura
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX riders_tenant_status_idx ON riders (tenant_id, status) WHERE is_active;

-- -----------------------------------------------------------------------------
-- 5. PEDIDOS
-- -----------------------------------------------------------------------------

CREATE TABLE orders (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES tenants(id),
  number                 bigint NOT NULL,                  -- legible, secuencial por tenant (trigger)
  branch_id              uuid NOT NULL REFERENCES branches(id),
  customer_id            uuid NOT NULL REFERENCES customers(id),
  address_snapshot       jsonb NOT NULL,                   -- dirección tal como se entregó
  channel                text NOT NULL DEFAULT 'MANUAL' CHECK (channel IN ('MANUAL','WEB','WHATSAPP','CRM')),

  -- Ejes de estado independientes
  operational_status     text NOT NULL DEFAULT 'NEW' CHECK (operational_status IN (
                           'NEW','CONFIRMED','PREPARING','READY','RIDER_ASSIGNED','RIDER_AT_PICKUP',
                           'ON_THE_WAY','DELIVERED','REJECTED','CANCELLATION_REQUESTED','CANCELLED',
                           'DELIVERY_FAILED','RETURN_PENDING','RETURNED_TO_RESTAURANT','PENDING_RESOLUTION')),
  payment_status         text NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING','PAID','REJECTED','REFUNDED')),
  payment_method         text NOT NULL CHECK (payment_method IN ('CASH','YAPE','BANK_TRANSFER')),
  restaurant_payout_status text NOT NULL DEFAULT 'PENDING' CHECK (restaurant_payout_status IN ('PENDING','CONFIRMED')),

  -- Liberación / despacho
  handoff_at             timestamptz,                      -- entrega física al repartidor (Encargado)
  handoff_by             uuid REFERENCES users(id),
  released_at            timestamptz,
  released_by            uuid REFERENCES users(id),

  rider_id               uuid REFERENCES riders(id),
  delivery_zone_id       uuid REFERENCES delivery_zones(id),
  attempts_count         smallint NOT NULL DEFAULT 0 CHECK (attempts_count >= 0),
  prev_status_before_cancel_request text,                  -- para revertir una solicitud denegada
  resolution             text,                             -- cierre de PENDING_RESOLUTION (valores a definir)

  -- Importes (céntimos). unit_price de cada ítem YA incluye modificadores.
  items_subtotal_cents   bigint NOT NULL CHECK (items_subtotal_cents >= 0),
  discount_cents         bigint NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  delivery_fee_cents     bigint NOT NULL DEFAULT 0 CHECK (delivery_fee_cents >= 0),
  tax_cents              bigint NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),   -- MVP = 0
  total_cents            bigint NOT NULL CHECK (total_cents >= 0),
  cash_to_collect_cents  bigint NOT NULL DEFAULT 0 CHECK (cash_to_collect_cents >= 0),
  invoice_requested      boolean NOT NULL DEFAULT false,

  public_token           text NOT NULL UNIQUE
                         DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  idempotency_key        text,
  notes                  text,
  version                integer NOT NULL DEFAULT 1,       -- bloqueo optimista
  created_by             uuid REFERENCES users(id),        -- NULL si vino de invitado/canal
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, number),
  -- Invariante de importes
  CONSTRAINT orders_total_chk CHECK (total_cents = items_subtotal_cents - discount_cents + delivery_fee_cents + tax_cents),
  CONSTRAINT orders_cash_chk  CHECK (cash_to_collect_cents <= total_cents
                                     AND (payment_method = 'CASH' OR cash_to_collect_cents = 0)),
  -- Regla de liberación reforzada en BD: no hay handoff sin pago al restaurante confirmado.
  CONSTRAINT orders_handoff_requires_payout_chk CHECK (handoff_at IS NULL OR restaurant_payout_status = 'CONFIRMED'),
  -- No se puede estar en camino/entregado sin handoff, sin repartidor y (si es anticipado) sin pago validado.
  CONSTRAINT orders_dispatch_gate_chk CHECK (
    operational_status NOT IN ('ON_THE_WAY','DELIVERED')
    OR (handoff_at IS NOT NULL
        AND rider_id IS NOT NULL
        AND (payment_method = 'CASH' OR payment_status IN ('PAID','REFUNDED')))
  )
);
CREATE UNIQUE INDEX orders_idempotency_uq ON orders (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX orders_branch_status_idx   ON orders (tenant_id, branch_id, operational_status, created_at DESC);
CREATE INDEX orders_status_created_idx  ON orders (tenant_id, operational_status, created_at DESC);
CREATE INDEX orders_customer_idx        ON orders (customer_id, created_at DESC);
CREATE INDEX orders_rider_idx           ON orders (rider_id) WHERE rider_id IS NOT NULL;
CREATE INDEX orders_created_idx         ON orders (tenant_id, created_at DESC);
CREATE INDEX orders_payment_pending_idx ON orders (tenant_id) WHERE payment_status = 'PENDING' AND payment_method <> 'CASH';

-- Asigna número secuencial por tenant y aumenta la versión en cada UPDATE.
CREATE OR REPLACE FUNCTION orders_before_write() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.number IS NULL OR NEW.number = 0 THEN
      NEW.number := next_counter(NEW.tenant_id, 'order_number');
    END IF;
  ELSE
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- number es NOT NULL: el trigger lo rellena si se inserta 0.
-- Uso desde la app: INSERT ... (number) VALUES (0, ...)
CREATE TRIGGER orders_before_write_trg
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_before_write();

CREATE TABLE order_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            uuid NOT NULL REFERENCES products(id),
  name_snapshot         text NOT NULL,
  qty                   integer NOT NULL CHECK (qty > 0),
  -- Desglose INTERNO (nunca se expone al cliente)
  base_price_cents      bigint NOT NULL CHECK (base_price_cents >= 0),
  packaging_cents       bigint NOT NULL DEFAULT 0 CHECK (packaging_cents >= 0),
  margin_cents          bigint NOT NULL DEFAULT 0 CHECK (margin_cents >= 0),   -- PROVISIONAL
  unit_price_cents      bigint NOT NULL CHECK (unit_price_cents >= 0),         -- incluye modificadores
  line_total_cents      bigint NOT NULL CHECK (line_total_cents >= 0),
  status                text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','UNAVAILABLE','REPLACED','CANCELLED')),
  unavailable_reason    text,
  replacement_of_item_id uuid REFERENCES order_items(id),
  customer_decision     text CHECK (customer_decision IN ('ACCEPTED_REPLACEMENT','CANCELLED_ITEM')),
  customer_decided_at   timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_items_line_chk CHECK (line_total_cents = qty * unit_price_cents)
);
CREATE INDEX order_items_order_idx ON order_items (order_id);
CREATE INDEX order_items_product_idx ON order_items (product_id);

CREATE TABLE order_item_modifiers (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id      uuid NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  name_snapshot      text NOT NULL,
  price_delta_cents  bigint NOT NULL DEFAULT 0
);
CREATE INDEX order_item_modifiers_item_idx ON order_item_modifiers (order_item_id);

CREATE TABLE order_status_history (                          -- SOLO-INSERCIÓN
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  order_id     uuid NOT NULL REFERENCES orders(id),
  from_status  text,
  to_status    text NOT NULL,
  actor_id     uuid REFERENCES users(id),                   -- NULL = sistema
  actor_role   text,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_status_history_order_idx ON order_status_history (order_id, created_at);

CREATE TABLE order_notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  author_id   uuid REFERENCES users(id),
  kind        text NOT NULL DEFAULT 'NOTE' CHECK (kind IN ('NOTE','INCIDENT','SYSTEM')),
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_notes_order_idx ON order_notes (order_id, created_at);

CREATE TABLE order_incidents (                               -- pérdidas e incidencias económicas
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id),
  order_id           uuid NOT NULL REFERENCES orders(id),
  type               text NOT NULL,
  description        text NOT NULL,
  evidence_asset_ids uuid[] NOT NULL DEFAULT '{}',
  reviewer_id        uuid REFERENCES users(id),
  decision           text,
  amount_cents       bigint CHECK (amount_cents IS NULL OR amount_cents >= 0),
  justification      text,
  status             text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','UNDER_REVIEW','DECIDED','CLOSED')),
  created_by         uuid REFERENCES users(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- Nunca se carga una pérdida sin decisión justificada
  CHECK (status NOT IN ('DECIDED','CLOSED') OR (decision IS NOT NULL AND justification IS NOT NULL AND reviewer_id IS NOT NULL))
);
CREATE INDEX order_incidents_order_idx ON order_incidents (order_id);

CREATE TABLE delivery_attempts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id),
  order_id              uuid NOT NULL REFERENCES orders(id),
  attempt_no            smallint NOT NULL CHECK (attempt_no >= 1),
  rider_id              uuid NOT NULL REFERENCES riders(id),
  outcome               text NOT NULL DEFAULT 'IN_PROGRESS' CHECK (outcome IN ('IN_PROGRESS','DELIVERED','FAILED')),
  failure_reason        text,
  notes                 text,
  evidence_asset_id     uuid REFERENCES assets(id),          -- foto opcional
  cash_collected_cents  bigint CHECK (cash_collected_cents IS NULL OR cash_collected_cents >= 0),
  authorized_by         uuid REFERENCES users(id),           -- obligatorio en el 2.º intento (lo valida la app)
  started_at            timestamptz NOT NULL DEFAULT now(),
  ended_at              timestamptz,
  UNIQUE (order_id, attempt_no),
  CHECK (outcome <> 'FAILED' OR failure_reason IS NOT NULL)
);
CREATE INDEX delivery_attempts_rider_idx ON delivery_attempts (rider_id, started_at DESC);

CREATE TABLE rider_location_pings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id   uuid NOT NULL REFERENCES riders(id) ON DELETE CASCADE,
  order_id   uuid REFERENCES orders(id),
  lat        numeric(9,6) NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng        numeric(9,6) NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m numeric(8,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rider_location_pings_rider_idx ON rider_location_pings (rider_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. PAGOS
-- -----------------------------------------------------------------------------

CREATE TABLE payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  order_id      uuid NOT NULL REFERENCES orders(id),
  method        text NOT NULL CHECK (method IN ('CASH','YAPE','BANK_TRANSFER')),
  amount_cents  bigint NOT NULL CHECK (amount_cents > 0),
  status        text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PAID','REJECTED','REFUNDED')),
  proof_asset_id uuid REFERENCES assets(id),                 -- imagen subida: NO equivale a pago validado
  reference     text,                                         -- nº de operación
  validated_by  uuid REFERENCES users(id),
  validated_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (status NOT IN ('PAID','REFUNDED') OR (validated_by IS NOT NULL AND validated_at IS NOT NULL))
);
CREATE INDEX payments_order_idx ON payments (order_id);
CREATE INDEX payments_status_idx ON payments (tenant_id, status);

CREATE TABLE payment_events (                                -- SOLO-INSERCIÓN
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  payment_id  uuid NOT NULL REFERENCES payments(id),
  type        text NOT NULL CHECK (type IN ('CREATED','VALIDATED','REJECTED','CORRECTED','REFUNDED')),
  before      jsonb,
  after       jsonb,
  reason      text,
  actor_id    uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Corregir exige motivo y valores anterior/nuevo
  CHECK (type <> 'CORRECTED' OR (reason IS NOT NULL AND before IS NOT NULL AND after IS NOT NULL))
);
CREATE INDEX payment_events_payment_idx ON payment_events (payment_id, created_at);

CREATE TABLE restaurant_payouts (                            -- pago al restaurante antes del despacho
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  order_id      uuid NOT NULL UNIQUE REFERENCES orders(id),
  amount_cents  bigint NOT NULL CHECK (amount_cents >= 0),
  status        text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED')),
  method        text,
  reference     text,
  confirmed_by  uuid REFERENCES users(id),
  confirmed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'CONFIRMED' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL))
);

CREATE TABLE refunds (                                       -- manuales (sin API de reembolso)
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  order_id      uuid NOT NULL REFERENCES orders(id),
  payment_id    uuid REFERENCES payments(id),
  amount_cents  bigint NOT NULL CHECK (amount_cents > 0),
  reason        text NOT NULL,
  authorized_by uuid NOT NULL REFERENCES users(id),
  method        text,
  reference     text,
  confirmed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_order_idx ON refunds (order_id);

-- -----------------------------------------------------------------------------
-- 7. FINANZAS DEL REPARTIDOR (garantía / adelantos / liquidaciones)
-- -----------------------------------------------------------------------------

CREATE TABLE settlements (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   uuid NOT NULL REFERENCES tenants(id),
  rider_id                    uuid NOT NULL REFERENCES riders(id),
  business_date               date NOT NULL,                  -- día operativo (America/Lima)
  cutoff_at                   timestamptz NOT NULL,
  cash_collected_cents        bigint NOT NULL DEFAULT 0 CHECK (cash_collected_cents >= 0),
  cash_received_cents         bigint NOT NULL DEFAULT 0 CHECK (cash_received_cents >= 0),
  advances_deducted_cents     bigint NOT NULL DEFAULT 0 CHECK (advances_deducted_cents >= 0),
  rider_fee_reference_cents   bigint NOT NULL DEFAULT 0 CHECK (rider_fee_reference_cents >= 0),  -- informativo
  rider_fee_payable_cents     bigint NOT NULL DEFAULT 0 CHECK (rider_fee_payable_cents >= 0),    -- editable con motivo (DECISION-03)
  rider_fee_override_reason   text,
  net_cents                   bigint NOT NULL DEFAULT 0,       -- fee_payable - advances - (collected - received)
  status                      text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','CONFIRMED')),
  confirmed_by                uuid REFERENCES users(id),
  confirmed_at                timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rider_id, business_date),
  CHECK (status <> 'CONFIRMED' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL)),
  CHECK (rider_fee_payable_cents = rider_fee_reference_cents OR rider_fee_override_reason IS NOT NULL)
);
CREATE INDEX settlements_tenant_date_idx ON settlements (tenant_id, business_date DESC);

CREATE TABLE rider_advances (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     uuid NOT NULL REFERENCES tenants(id),
  rider_id                      uuid NOT NULL REFERENCES riders(id),
  amount_cents                  bigint NOT NULL CHECK (amount_cents > 0),
  purpose                       text NOT NULL DEFAULT 'FUEL',
  authorized_by                 uuid NOT NULL REFERENCES users(id),   -- siempre intervención humana
  status                        text NOT NULL DEFAULT 'PENDING_DEDUCTION' CHECK (status IN ('PENDING_DEDUCTION','DEDUCTED')),
  deducted_in_settlement_id     uuid REFERENCES settlements(id),
  created_at                    timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'DEDUCTED') = (deducted_in_settlement_id IS NOT NULL))   -- no se descuenta dos veces
);
CREATE INDEX rider_advances_pending_idx ON rider_advances (rider_id) WHERE status = 'PENDING_DEDUCTION';

CREATE TABLE wallet_entries (                                -- LIBRO MAYOR — SOLO-INSERCIÓN
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  rider_id      uuid NOT NULL REFERENCES riders(id),
  type          text NOT NULL CHECK (type IN ('GUARANTEE_DEPOSIT','GUARANTEE_WITHDRAWAL','CASH_COLLECTED','CASH_SETTLED','ADJUSTMENT')),
  amount_cents  bigint NOT NULL,                              -- con signo: + aumenta garantía disponible
  order_id      uuid REFERENCES orders(id),
  advance_id    uuid REFERENCES rider_advances(id),
  settlement_id uuid REFERENCES settlements(id),
  reason        text,
  actor_id      uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_sign_chk CHECK (
       (type IN ('GUARANTEE_DEPOSIT','CASH_SETTLED') AND amount_cents > 0)
    OR (type IN ('GUARANTEE_WITHDRAWAL','CASH_COLLECTED') AND amount_cents < 0)
    OR (type = 'ADJUSTMENT' AND amount_cents <> 0 AND reason IS NOT NULL)
  ),
  CONSTRAINT wallet_cash_collected_order_chk CHECK (type <> 'CASH_COLLECTED' OR order_id IS NOT NULL),
  CONSTRAINT wallet_settled_settlement_chk   CHECK (type <> 'CASH_SETTLED'   OR settlement_id IS NOT NULL)
);
CREATE INDEX wallet_entries_rider_idx ON wallet_entries (rider_id, created_at);
-- Un pedido solo puede generar un cobro en efectivo en el ledger.
CREATE UNIQUE INDEX wallet_one_collection_per_order ON wallet_entries (order_id) WHERE type = 'CASH_COLLECTED';
-- Una liquidación solo registra un asiento de efectivo recibido.
CREATE UNIQUE INDEX wallet_one_settled_per_settlement ON wallet_entries (settlement_id) WHERE type = 'CASH_SETTLED';

-- Saldo de garantía disponible = suma del ledger (siempre derivable).
CREATE OR REPLACE FUNCTION rider_guarantee_balance(p_rider uuid) RETURNS bigint AS $$
  SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM wallet_entries WHERE rider_id = p_rider;
$$ LANGUAGE sql STABLE;

CREATE VIEW v_rider_guarantee_balance AS
SELECT r.id AS rider_id, r.tenant_id, r.full_name,
       COALESCE(SUM(w.amount_cents), 0)::bigint AS balance_cents,
       COALESCE(SUM(w.amount_cents), 0) < 0     AS has_debt
FROM riders r
LEFT JOIN wallet_entries w ON w.rider_id = r.id
GROUP BY r.id, r.tenant_id, r.full_name;

-- -----------------------------------------------------------------------------
-- 8. CALIFICACIONES, ALERTAS, CONFIGURACIÓN, AUDITORÍA, INTEGRACIÓN
-- -----------------------------------------------------------------------------

CREATE TABLE ratings (                                       -- estructura lista; uso mínimo en MVP
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id),
  order_id      uuid NOT NULL REFERENCES orders(id),
  subject_type  text NOT NULL CHECK (subject_type IN ('RESTAURANT','RIDER','CUSTOMER')),
  subject_id    uuid NOT NULL,
  rater_type    text NOT NULL CHECK (rater_type IN ('CUSTOMER','RIDER','STAFF')),
  stars         smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, subject_type, rater_type)
);
CREATE INDEX ratings_subject_idx ON ratings (subject_type, subject_id);

CREATE TABLE alerts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  type        text NOT NULL,                                   -- NEW_ORDER, ACCEPTANCE_TIMEOUT, PREP_DELAY, NO_RIDER, ...
  severity    text NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO','WARNING','CRITICAL')),
  order_id    uuid REFERENCES orders(id),
  rider_id    uuid REFERENCES riders(id),
  branch_id   uuid REFERENCES branches(id),
  payload     jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key  text NOT NULL,
  status      text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ACK','RESOLVED')),
  acked_by    uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  UNIQUE (tenant_id, dedupe_key)
);
CREATE INDEX alerts_open_idx ON alerts (tenant_id, created_at DESC) WHERE status <> 'RESOLVED';

CREATE TABLE settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  key         text NOT NULL,
  value       jsonb NOT NULL,
  is_placeholder boolean NOT NULL DEFAULT false,               -- true = valor NO aprobado
  updated_by  uuid REFERENCES users(id),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

CREATE TABLE audit_logs (                                    -- SOLO-INSERCIÓN
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  actor_id     uuid REFERENCES users(id),
  actor_role   text,
  action       text NOT NULL,
  object_type  text NOT NULL,
  object_id    text,
  before       jsonb,
  after        jsonb,
  request_id   text,
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_tenant_created_idx ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX audit_logs_object_idx ON audit_logs (tenant_id, object_type, object_id);
CREATE INDEX audit_logs_actor_idx ON audit_logs (tenant_id, actor_id, created_at DESC);
-- Escalado: particionar por mes (PARTITION BY RANGE (created_at)) cuando crezca.

CREATE TABLE outbox_events (                                 -- efectos secundarios (notificaciones, CRM)
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id),
  type             text NOT NULL,
  payload          jsonb NOT NULL,
  dedupe_key       text,
  status           text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SENT','FAILED','DEAD')),
  attempts         integer NOT NULL DEFAULT 0,
  last_error       text,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  processed_at     timestamptz
);
CREATE UNIQUE INDEX outbox_dedupe_uq ON outbox_events (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX outbox_pending_idx ON outbox_events (next_attempt_at) WHERE status IN ('PENDING','FAILED');

CREATE TABLE inbound_events (                                -- webhooks entrantes (idempotencia)
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           text NOT NULL,
  external_event_id  text NOT NULL,
  payload            jsonb NOT NULL,
  status             text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PROCESSED','FAILED','IGNORED')),
  attempts           integer NOT NULL DEFAULT 0,
  error              text,
  received_at        timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,
  UNIQUE (provider, external_event_id)
);
CREATE INDEX inbound_events_status_idx ON inbound_events (status, received_at);

CREATE TABLE funnel_events (                                 -- captura para el embudo (reporte posterior)
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id),
  branch_id   uuid REFERENCES branches(id),
  session_id  text NOT NULL,
  step        text NOT NULL CHECK (step IN ('IMPRESSION','MENU_VIEW','ADD_TO_CART','PURCHASE')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX funnel_events_idx ON funnel_events (tenant_id, branch_id, created_at);

-- Tablas creadas vacías para el futuro (promociones, push web)
CREATE TABLE promotions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id),
  restaurant_id uuid REFERENCES restaurants(id),
  branch_id    uuid REFERENCES branches(id),
  name         text NOT NULL,
  kind         text NOT NULL CHECK (kind IN ('DISCOUNT','COUPON','COMBO')),
  code         text,
  starts_at    timestamptz,
  ends_at      timestamptz,
  is_active    boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE promotion_rules (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id  uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  rule          jsonb NOT NULL
);
CREATE TABLE push_subscriptions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    text NOT NULL UNIQUE,
  keys        jsonb NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 9. TRIGGERS: solo-inserción y updated_at
-- -----------------------------------------------------------------------------

CREATE TRIGGER audit_logs_append_only        BEFORE UPDATE OR DELETE ON audit_logs         FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER order_status_history_append_only BEFORE UPDATE OR DELETE ON order_status_history FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER payment_events_append_only    BEFORE UPDATE OR DELETE ON payment_events     FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER wallet_entries_append_only    BEFORE UPDATE OR DELETE ON wallet_entries     FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER inbound_events_guard_trg      BEFORE UPDATE OR DELETE ON inbound_events     FOR EACH ROW EXECUTE FUNCTION inbound_events_guard();

-- TRUNCATE también debe bloquearse en las tablas críticas
CREATE TRIGGER audit_logs_no_truncate          BEFORE TRUNCATE ON audit_logs          FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER order_status_history_no_truncate BEFORE TRUNCATE ON order_status_history FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER payment_events_no_truncate      BEFORE TRUNCATE ON payment_events      FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();
CREATE TRIGGER wallet_entries_no_truncate      BEFORE TRUNCATE ON wallet_entries      FOR EACH STATEMENT EXECUTE FUNCTION forbid_mutation();

-- updated_at automático en toda tabla que tenga esa columna
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t.table_name || '_set_updated_at', t.table_name);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 10. CONFIGURACIÓN POR DEFECTO (valores PLACEHOLDER = NO aprobados)
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION seed_default_settings(p_tenant uuid) RETURNS void AS $$
BEGIN
  INSERT INTO settings (tenant_id, key, value, is_placeholder) VALUES
    (p_tenant, 'order.acceptance_timeout_minutes',            '5'::jsonb,      true),   -- DECISION-05
    (p_tenant, 'order.prep_delay_threshold_minutes',          '30'::jsonb,     true),   -- DECISION-05
    (p_tenant, 'order.no_rider_threshold_minutes',            '10'::jsonb,     true),   -- DECISION-05
    (p_tenant, 'rider.pickup_wait_minutes',                   '15'::jsonb,     false),  -- aprobado
    (p_tenant, 'rider.min_age_for_cash_without_guarantee',    '35'::jsonb,     true),   -- doc original; DECISION-02
    (p_tenant, 'rider.allow_multiple_orders',                 'false'::jsonb,  true),
    (p_tenant, 'guarantee.min_cents',                         '0'::jsonb,      true),   -- DECISION-02
    (p_tenant, 'delivery.max_attempts',                       '2'::jsonb,      false),  -- aprobado
    (p_tenant, 'settlement.cutoff_time',                      '"23:00"'::jsonb,true),   -- confirmar procedimiento
    (p_tenant, 'customer.top_min_orders',                     '10'::jsonb,     true),
    (p_tenant, 'reports.branch_manager_can_view_sales',       'false'::jsonb,  true),   -- DECISION-04
    (p_tenant, 'reports.coordinator_can_view_funnel',         'false'::jsonb,  true),   -- DECISION-04
    (p_tenant, 'support.can_assign_rider',                    'true'::jsonb,   false),
    (p_tenant, 'support.can_create_advance',                  'false'::jsonb,  true),
    (p_tenant, 'feature.integration.vocero',                  'false'::jsonb,  false),
    (p_tenant, 'feature.integration.whatsapp',                'false'::jsonb,  false),
    (p_tenant, 'locale.timezone',                             '"America/Lima"'::jsonb, false),
    (p_tenant, 'locale.currency',                             '"PEN"'::jsonb,  false)
  ON CONFLICT (tenant_id, key) DO NOTHING;
END $$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 11. OPCIONAL / ENDURECIMIENTO (descomentar según el entorno)
-- -----------------------------------------------------------------------------

-- Rol de la aplicación SIN poder alterar tablas de solo-inserción:
--   CREATE ROLE zd_app LOGIN PASSWORD '<desde variable de entorno>';
--   GRANT USAGE ON SCHEMA public TO zd_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zd_app;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zd_app;
--   REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs, order_status_history, payment_events, wallet_entries FROM zd_app;
--   REVOKE DELETE, TRUNCATE ON inbound_events FROM zd_app;

-- Aislamiento por tenant con Row Level Security (segunda barrera; la app fija el tenant por sesión):
--   ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY orders_tenant_isolation ON orders
--     USING (tenant_id = current_setting('app.tenant_id')::uuid);
--   -- y SELECT set_config('app.tenant_id', '<uuid>', true) al inicio de cada transacción.

-- Primer arranque (ejemplo):
--   INSERT INTO tenants (name, slug) VALUES ('Zero Delivery', 'zero-delivery') RETURNING id;
--   SELECT seed_default_settings('<tenant_id>');

COMMIT;
