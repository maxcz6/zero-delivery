# 05 — Catálogo de API y Contratos de Integración

> **Estado:** `[DESIGNED]` · **Versión:** 1.0-mvp · **Fuente:** `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md` §11–§12 + `vocero-crm/docs/openapi.json`

---

## 1. Convenciones Generales de la API (`/api/v1/*`)

- **Formato:** JSON (`application/json`), codificación UTF-8.
- **Autenticación:** Cookie de sesión `zd_session` (`httpOnly`, `Secure`, `SameSite=Lax`) para clientes web/PWA, o cabecera `Authorization: Bearer <token>` para clientes API futuros.
- **Idempotencia:** Las mutaciones de creación de pedidos (`POST /api/v1/orders`) exigen la cabecera `Idempotency-Key` (UUID v4) o el campo `idempotencyKey`.
- **Formato uniforme de error:**
  ```json
  {
    "error": {
      "code": "RELEASE_GATE_FAILED",
      "message": "El pedido no cumple las condiciones de liberación para salir a ruta.",
      "details": {
        "failures": ["RESTAURANT_PAYOUT_NOT_CONFIRMED", "HANDOFF_NOT_REGISTERED"]
      },
      "requestId": "req_01jc8x9z..."
    }
  }
  ```

---

## 2. Endpoints de Autenticación y Sesión (`identity`)

### `POST /api/v1/auth/login`

| Campo | Valor |
|---|---|
| **Descripción** | Inicia sesión con usuario y contraseña (Argon2id) y emite cookie `zd_session`. |
| **Auth** | Público (con rate-limit por IP y bloqueo tras 5 intentos fallidos). |
| **Caso de Uso** | CU-001 |

**Request Body:**
```json
{
  "tenantSlug": "zero-delivery",
  "username": "coord.lima",
  "password": "PasswordSeguro123!"
}
```

**Responses:**
| Código | Descripción | Body |
|---|---|---|
| `200` | Sesión iniciada | `{ "user": { "id": "uuid", "username": "coord.lima", "displayName": "Coordinador Lima", "role": "COORDINATOR", "branchIds": [] } }` |
| `401` | Credenciales inválidas | `{ "error": { "code": "INVALID_CREDENTIALS", "message": "Usuario o contraseña incorrectos.", "requestId": "..." } }` |
| `429` | Cuenta bloqueada temporalmente | `{ "error": { "code": "ACCOUNT_LOCKED", "message": "Demasiados intentos fallidos. Intente más tarde.", "requestId": "..." } }` |

### `POST /api/v1/auth/logout`
- **Auth:** Requerida · **CU:** CU-001 · **Respuesta `200`:** `{ "ok": true }` (revoca la sesión en BD y limpia la cookie).

### `GET /api/v1/auth/me`
- **Auth:** Requerida · **CU:** CU-001 · **Respuesta `200`:** Devuelve el `ActorContext` actual y sus permisos efectivos.

---

## 3. Endpoints de Estructura y Catálogo (`tenancy` & `catalog`)

| Método | Ruta | Permiso (`PermissionKey`) | Caso de Uso | Descripción |
|---|---|---|---|---|
| `GET` | `/api/v1/restaurants` | Autenticado (filtrado por alcance) | CU-002 | Lista restaurantes y sucursales del tenant. |
| `POST` | `/api/v1/restaurants` | `restaurant.manage` | CU-002 | Crea un restaurante (`name`, `legalName`, `ruc`). |
| `POST` | `/api/v1/branches` | `restaurant.manage` | CU-002 | Crea una sucursal (`restaurantId`, `name`, `slug`, `address`, `phone`). |
| `PATCH` | `/api/v1/branches/:branchId/toggle` | `branch.toggle` | CU-002 | Activa o desactiva temporalmente `is_open_manual`. |
| `PUT` | `/api/v1/branches/:branchId/schedules` | `branch.schedule.edit` | CU-002 | Reemplaza los turnos horarios de la sucursal. |
| `POST` | `/api/v1/branches/:branchId/zones` | `restaurant.manage` | CU-002 | Crea zona de reparto (`name`, `feeCents`, `minOrderCents`). |
| `GET` | `/api/v1/products` | Autenticado | CU-003 | Lista productos activos (excluye `archived_at IS NOT NULL` salvo filtro). |
| `POST` | `/api/v1/products` | `product.create` | CU-003 | Crea producto con `basePriceCents`, `packagingCents`, `marginType`, `marginValue`, `isFragile`. |
| `DELETE` | `/api/v1/products/:productId` | `product.create` | CU-003 | Si tiene `order_items`, archiva (`archived_at = now()`); nunca borra historial. |
| `PATCH` | `/api/v1/menu-items/:menuItemId/availability` | `product.availability.edit` | CU-003 | Cambia `is_available` en la carta de la sucursal. |
| `PATCH` | `/api/v1/menu-items/:menuItemId/price` | `product.price.edit` | CU-003 | Actualiza `price_cents` en la carta (auditado). |

---

## 4. Endpoints de Pedidos y Máquina de Estados (`orders`)

### `POST /api/v1/orders`

| Campo | Valor |
|---|---|
| **Descripción** | Registra un pedido manual calculando snapshots con `ProvisionalPricingPolicy`. |
| **Cabeceras** | `Idempotency-Key: <uuid>` (obligatorio) |
| **Permiso** | `order.create_manual` (`ADMIN`, `COORDINATOR`, `SUPPORT_AGENT`) |
| **Caso de Uso** | CU-004 |

**Request Body:**
```json
{
  "branchId": "uuid-branch",
  "deliveryZoneId": "uuid-zone",
  "paymentMethod": "YAPE",
  "invoiceRequested": false,
  "customer": {
    "name": "María Quispe",
    "phone": "987654321",
    "addressText": "Av. Arequipa 1234, Lince",
    "reference": "Frente al parque"
  },
  "items": [
    {
      "productId": "uuid-prod",
      "qty": 2,
      "modifierOptionIds": ["uuid-mod-1"]
    }
  ],
  "notes": "Sin ají"
}
```

**Responses:**
| Código | Descripción | Body |
|---|---|---|
| `201` / `200` | Creado (o recuperado por idempotencia) | `{ "order": StaffOrderDTO }` |
| `403` | Sin permiso o cliente bloqueado (`risk_flag = 'BLOCKED'`) | `{ "error": { "code": "CUSTOMER_BLOCKED", "message": "..." } }` |
| `422` | Pedido menor al mínimo de zona o validación fallida | `{ "error": { "code": "VALIDATION_ERROR", "details": ... } }` |

---

### `POST /api/v1/orders/:orderId/transitions`

| Campo | Valor |
|---|---|
| **Descripción** | Ejecuta una transición en la máquina de estados con `SELECT ... FOR UPDATE` y control de `version`. |
| **Permiso** | Evaluado según la tabla de transiciones (`ORDER_TRANSITIONS`) y `can()`. |
| **Caso de Uso** | CU-005, CU-006, CU-008, CU-009, CU-010, CU-011 |

**Request Body:**
```json
{
  "toStatus": "ON_THE_WAY",
  "expectedVersion": 4,
  "reason": "Opcional salvo en rechazos, fallos o cancelaciones",
  "riderId": "uuid-rider-opcional",
  "cashCollectedCents": 4500,
  "evidenceAssetId": "uuid-asset-opcional"
}
```

**Responses:**
| Código | Descripción | Body |
|---|---|---|
| `200` | Transición aplicada (o idempotente si ya estaba en `toStatus`) | `{ "order": StaffOrderDTO }` |
| `403` | Rol no autorizado para esta transición | `{ "error": { "code": "FORBIDDEN_TRANSITION", "message": "..." } }` |
| `409` | Guarda fallida (`RELEASE_GATE_FAILED`, `RIDER_NOT_ELIGIBLE`, `VERSION_CONFLICT`) | `{ "error": { "code": "RELEASE_GATE_FAILED", "details": { "failures": [...] } } }` |

---

### `POST /api/v1/orders/:orderId/handoff`

| Campo | Valor |
|---|---|
| **Descripción** | El Encargado registra la entrega física del paquete al repartidor. **Falla con `409` si `restaurant_payout_status !== 'CONFIRMED'`**. |
| **Permiso** | `order.handoff_to_rider` (`BRANCH_MANAGER` propio, `ADMIN` override) |
| **Caso de Uso** | CU-009 |

---

## 5. Endpoints de Pagos, Logística y Billetera (`payments`, `logistics`, `wallet`)

| Método | Ruta | Permiso (`PermissionKey`) | Caso de Uso | Descripción |
|---|---|---|---|---|
| `POST` | `/api/v1/orders/:orderId/payment/validate` | `payment.validate` | CU-007 | Valida comprobante Yape/Transferencia (`status -> PAID`). |
| `POST` | `/api/v1/orders/:orderId/payment/correct` | `payment.correct` | CU-007 | Corrige un pago exigiendo `reason`, guardando `before` y `after` en `payment_events`. |
| `POST` | `/api/v1/orders/:orderId/payout/confirm` | `payout.restaurant.confirm` | CU-007 | Confirma el pago al restaurante (`restaurant_payout_status -> CONFIRMED`). |
| `POST` | `/api/v1/orders/:orderId/refunds` | `refund.manage` | CU-007 | Registra reembolso manual autorizado. |
| `POST` | `/api/v1/riders/:riderId/location` | `delivery.update_own` | CU-009 | Guarda ping manual de ubicación (`lat`, `lng`, `accuracyM`). |
| `GET` | `/api/v1/riders/:riderId/wallet` | `wallet.view_own` / `wallet.view_any` | CU-012 | Devuelve `balanceCents`, `hasDebt` y asientos de `wallet_entries`. |
| `POST` | `/api/v1/riders/:riderId/wallet/adjust` | `wallet.adjust` | CU-012 | Inserta asiento `GUARANTEE_DEPOSIT`, `GUARANTEE_WITHDRAWAL` o `ADJUSTMENT` (con `reason`). |
| `POST` | `/api/v1/riders/:riderId/advances` | `advance.create` | CU-012 | Registra adelanto de combustible (`PENDING_DEDUCTION`). |
| `POST` | `/api/v1/settlements/generate-drafts` | `settlement.confirm` | CU-012 | Genera borradores de liquidación para la fecha operativa (`America/Lima`). |
| `POST` | `/api/v1/settlements/:settlementId/confirm` | `settlement.confirm` | CU-012 | Confirma liquidación diaria, inserta `CASH_SETTLED` y descuenta adelantos. |

---

## 6. Endpoints de Reportes, Alertas, Configuración y Público

| Método | Ruta | Permiso (`PermissionKey`) | Caso de Uso | Descripción |
|---|---|---|---|---|
| `GET` | `/api/v1/reports/:reportType` | `report.*` | CU-013 | Devuelve `TabularDataset` (`sales`, `operational`, `customers`) filtrado por el rol y sucursal. |
| `GET` | `/api/v1/reports/:reportType/export?format=csv` | `export.*` (= permiso de lectura) | CU-013 | Descarga en streaming CSV UTF-8 con BOM del `TabularDataset`. |
| `GET` | `/api/v1/alerts` | Autenticado (alcance) | CU-005 | Lista alertas abiertas (`NEW_ORDER`, `ACCEPTANCE_TIMEOUT`, `PREP_DELAY`, etc.). |
| `GET` / `PATCH` | `/api/v1/settings` | `settings.global.manage` | Todos | Consulta o actualiza parámetros configurables de la tabla `settings` (auditado). |
| `GET` | `/api/v1/public/branches/:branchSlug/menu` | Público (rate-limited) | CU-014 | Devuelve carta activa de la sucursal sin costos internos. |
| `GET` | `/api/v1/public/orders/:publicToken` | Público (rate-limited) | CU-014 | Devuelve `CustomerOrderDTO` (sin `margin_cents`, sin `base_price_cents` y sin GPS del repartidor). |

---

## 7. Contratos de Integración con Vocero CRM (`integrations`)

### 7.1 Webhook Entrante desde Vocero CRM (`POST /api/webhooks/vocero`)

Compatible byte a byte con `src/server/brains/contract.ts` de `vocero-crm`:

- **Cabeceras requeridas:**
  - `X-Vocero-Signature: sha256=<HMAC-SHA256(rawBody, VOCERO_BOT_API_KEY)>`
  - `X-Vocero-Dispatch-Id: <dispatchId>`
  - `X-Vocero-Organization: <orgId>`
- **Comportamiento:**
  - Si `settings['feature.integration.vocero'] === false`, devuelve `404 Not Found` (siguiendo la convención de módulos apagados).
  - Si la firma HMAC no coincide, devuelve `401 Unauthorized`.
  - Inserta en `inbound_events` con `UNIQUE(provider='vocero', external_event_id=dispatchId)` y responde `200 { "ok": true }`.

### 7.2 Healthcheck para el Interruptor de Agente de Vocero CRM (`GET /api/webhooks/vocero/health`)

- **Propósito:** Vocero CRM consulta `BRAIN_HEALTH_URL` antes de permitir activar el despacho hacia Zero Delivery.
- **Respuesta `200`:** `{ "ok": true, "service": "zero-delivery", "voceroIntegrationEnabled": true }`.

### 7.3 Llamadas Salientes de Zero Delivery hacia Vocero CRM (`VoceroCrmAdapter`)

Autenticadas con `X-API-Key: <VOCERO_BOT_API_KEY>`:

1. **`POST {VOCERO_BASE_URL}/api/bot/messages`** — Envía notificaciones de cambio de estado del pedido (`CONFIRMED`, `READY`, `ON_THE_WAY`, `DELIVERED`, `DELIVERY_FAILED`) al hilo del cliente.
2. **`PUT {VOCERO_BASE_URL}/api/bot/ficha`** — Sincroniza en la ficha del contacto en Vocero CRM el resumen operativo (`{ ultimoPedido: "#1042", estadoPedido: "ON_THE_WAY", segmento: "RECURRING" }`).
3. **`POST {VOCERO_BASE_URL}/api/bot/stage`** — Mueve al lead en el pipeline de Vocero CRM cuando el pedido avanza.
4. **`POST {VOCERO_BASE_URL}/api/bot/handoff`** — Devuelve la conversación a un agente humano en Vocero CRM (`reason: "cliente" | "error"`) cuando hay un producto agotado o entrega fallida.
5. **`GET {VOCERO_BASE_URL}/api/bot/media/{mediaId}`** — Descarga imágenes de comprobantes Yape/Transferencia enviadas por el cliente a WhatsApp sin exponer el token de Meta.
