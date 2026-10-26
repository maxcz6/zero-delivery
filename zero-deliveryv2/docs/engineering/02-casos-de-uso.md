# 02 — Casos de Uso del Sistema

> **Estado:** `[DESIGNED]` · **Versión:** 1.0-mvp · **Fuente:** `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md`

---

## Índice de Casos de Uso

| ID | Nombre | Actor Principal | Módulo | Hito |
|---|---|---|---|---|
| **CU-001** | Autenticación, Gestión de Sesiones y RBAC | Todos los usuarios | `identity` | Hito 0 |
| **CU-002** | Gestión de Restaurantes, Sucursales, Horarios y Zonas | `ADMIN`, `COORDINATOR`, `BRANCH_MANAGER` | `tenancy` | Hito 1 |
| **CU-003** | Gestión de Catálogo, Modificadores y Cartas por Sucursal | `ADMIN`, `COORDINATOR`, `BRANCH_MANAGER` | `catalog` | Hito 1 |
| **CU-004** | Registro Manual de Pedido (con Snapshot e Idempotencia) | `ADMIN`, `COORDINATOR`, `SUPPORT_AGENT` | `orders`, `customers` | Hito 2 |
| **CU-005** | Aceptación, Rechazo y Preparación en Sucursal (con Timeout) | `BRANCH_MANAGER`, `COORDINATOR` | `orders`, `alerts` | Hito 2 |
| **CU-006** | Gestión de Productos Faltantes, Cambio de Dirección y Cancelación | `BRANCH_MANAGER`, `SUPPORT_AGENT`, `COORDINATOR` | `orders` | Hito 2 |
| **CU-007** | Validación Humana de Pago Anticipado y Confirmación de Pago al Restaurante | `COORDINATOR`, `SUPPORT_AGENT`, `ADMIN` | `payments` | Hito 3 |
| **CU-008** | Asignación Manual de Repartidor con Evaluación de Elegibilidad | `COORDINATOR`, `SUPPORT_AGENT`, `ADMIN` | `logistics`, `wallet` | Hito 3 |
| **CU-009** | Handoff Físico y Regla de Liberación (`evaluateReleaseGate`) | `BRANCH_MANAGER`, `RIDER` | `orders`, `logistics` | Hito 3 |
| **CU-010** | Entrega Exitosa y Cobro en Efectivo contra Garantía (Ledger) | `RIDER` | `logistics`, `wallet` | Hito 3 |
| **CU-011** | Entrega Fallida (Máx. 2 Intentos), Devolución e Incidencias Económicas | `RIDER`, `BRANCH_MANAGER`, `COORDINATOR` | `logistics`, `orders` | Hito 3 |
| **CU-012** | Gestión de Billetera de Garantía, Adelantos y Liquidación Diaria (Corte 23:00) | `COORDINATOR`, `ADMIN`, `RIDER` | `wallet` | Hito 3 |
| **CU-013** | Consulta de Dashboard, Reportes por Rol y Exportación CSV | `ADMIN`, `COORDINATOR`, `BRANCH_MANAGER`, `RIDER` | `reporting` | Hito 4 |
| **CU-014** | Pedido Web como Invitado y Seguimiento por Token Público (`SHOULD`) | Cliente Final | `orders`, `catalog` | Hito 4 |
| **CU-015** | Sincronización Omnicanal e Ingesta desde Vocero CRM (Punto de Extensión / R1) | Vocero CRM (`Sistema Externo`), `COORDINATOR` | `integrations` | Hito 0 (Stub) / R1 |

---

## Detalle de Casos de Uso

### CU-001: Autenticación, Gestión de Sesiones y RBAC

| Campo | Contenido |
|---|---|
| **ID** | CU-001 |
| **Nombre** | Autenticación por usuario/contraseña, sesión server-side y autorización RBAC |
| **Descripción** | Permite a un usuario iniciar sesión, obtener una cookie `httpOnly` respaldada en BD y acceder únicamente a las vistas y acciones permitidas por la función central `can()`. |
| **Actores primarios** | `ADMIN`, `COORDINATOR`, `BRANCH_MANAGER`, `SUPPORT_AGENT`, `RIDER` |
| **Actores secundarios** | Servicio de Auditoría (`audit_logs`) |
| **Precondiciones** | El usuario existe en `users`, pertenece a un `tenant` con `status = 'ACTIVE'` y tiene `is_active = true`. |
| **Postcondiciones** | Se crea una fila en `sessions` con el hash del token, se actualiza `last_login_at`, se registra `USER_LOGIN` en `audit_logs` y se redirige al panel según el rol. |

**Happy Path:**
1. El actor ingresa `username` y `password` en `/login`.
2. El sistema valida formato con Zod, verifica rate-limit y comprueba el hash Argon2id.
3. El sistema genera un token aleatorio, guarda su SHA-256 en `sessions`, emite cookie `httpOnly` y registra auditoría.
4. El sistema redirige a la vista principal del rol (`/(staff)` o `/(rider)`).

**Flujo Detallado:**
1. El usuario envía `POST /api/v1/auth/login` con `{ username, password }`.
2. El servicio verifica que la IP/usuario no haya superado el límite de intentos ni tenga `locked_until > now()`.
3. Busca el usuario por `(tenant_id, lower(username))`.
4. Verifica la contraseña usando `@node-rs/argon2`.
5. Reinicia `failed_login_count = 0`, actualiza `last_login_at = now()`, inserta en `sessions` y en `audit_logs`.

**Flujos Alternativos:**
- **4a.** Si el usuario cierra sesión (`POST /api/v1/auth/logout`), el sistema marca `sessions.revoked_at = now()`, borra la cookie y registra `USER_LOGOUT` en `audit_logs`.

**Flujos de Excepción:**
- **2a.** Si supera 5 intentos fallidos consecutivos, fija `locked_until = now() + 15 minutes`, registra `USER_LOCKED` en `audit_logs` y retorna `429 Too Many Requests`.
- **3a/4b.** Si las credenciales son inválidas o el usuario está inactivo, incrementa `failed_login_count`, registra `USER_LOGIN_FAILED` y retorna `401 Unauthorized` con mensaje genérico.

---

### CU-002: Gestión de Restaurantes, Sucursales, Horarios y Zonas

| Campo | Contenido |
|---|---|
| **ID** | CU-002 |
| **Nombre** | Administración de estructura multi-restaurante y cobertura de sucursal |
| **Descripción** | Permite crear restaurantes y sucursales, asignar encargados (`user_branch_access`), definir turnos horarios por día y configurar zonas de reparto con tarifa y pedido mínimo. |
| **Actores primarios** | `ADMIN` (creación global), `COORDINATOR` (toggle apertura y horarios), `BRANCH_MANAGER` (horarios de su propia sucursal) |
| **Precondiciones** | Actor autenticado con permiso `restaurant.manage`, `branch.toggle` o `branch.schedule.edit`. |
| **Postcondiciones** | Sucursal, horarios o zonas actualizadas y auditadas en `audit_logs`. |

**Happy Path:**
1. `ADMIN` crea restaurante y sucursal indicando slug, dirección y teléfono.
2. `ADMIN` o `BRANCH_MANAGER` configura turnos (`branch_schedules`) por día (`0..6`).
3. `ADMIN` configura zonas (`delivery_zones`) con `fee_cents` y `min_order_cents`.
4. `COORDINATOR` puede activar/desactivar temporalmente (`is_open_manual`) una sucursal ante saturación.

**Flujos de Excepción:**
- **2a.** Si un `BRANCH_MANAGER` intenta editar horarios de una sucursal no incluida en su `user_branch_access`, `can()` deniega con `403 Forbidden`.

---

### CU-003: Gestión de Catálogo, Modificadores y Cartas por Sucursal

| Campo | Contenido |
|---|---|
| **ID** | CU-003 |
| **Nombre** | Administración de productos, modificadores, cartas dinámicas y disponibilidad |
| **Descripción** | Permite crear categorías, productos (con indicador `is_fragile`, costo base, empaque y margen), grupos de modificadores y cartas por sucursal (`menus`, `menu_items`). |
| **Actores primarios** | `ADMIN`, `COORDINATOR`, `BRANCH_MANAGER` (en su sucursal) |
| **Precondiciones** | Permiso `product.create`, `product.availability.edit` o `product.price.edit`. |
| **Postcondiciones** | Producto o carta guardada; cambios de precio o disponibilidad quedan en `audit_logs`. |

**Happy Path:**
1. El actor crea o edita un producto indicando `base_price_cents`, `packaging_cents`, `margin_type`, `margin_value` e `is_fragile`.
2. El actor asocia grupos de modificadores (`min_select`, `max_select`, opciones con `price_delta_cents`).
3. El actor publica el producto en la carta de la sucursal (`menu_items`) con `price_cents` e `is_available`.

**Flujos Alternativos y de Excepción:**
- **3a.** Si se solicita eliminar un producto que tiene historial en `order_items`, el sistema **prohíbe el borrado físico** y ejecuta un archivado lógico (`archived_at = now()`, `is_active = false`).

---

### CU-004: Registro Manual de Pedido (con Snapshot e Idempotencia)

| Campo | Contenido |
|---|---|
| **ID** | CU-004 |
| **Nombre** | Creación manual de pedido con deduplicación de cliente y snapshot financiero |
| **Descripción** | Registra un nuevo pedido recibido por atención telefónica/WhatsApp, deduplicando al cliente por teléfono `E.164`, calculando el desglose interno con `ProvisionalPricingPolicy` y guardando snapshots inmutables. |
| **Actores primarios** | `SUPPORT_AGENT`, `COORDINATOR`, `ADMIN` |
| **Actores secundarios** | `BRANCH_MANAGER` (recibe alerta sonora de pedido `NEW`) |
| **Precondiciones** | Sucursal activa y abierta; cabecera/campo `idempotencyKey` presente; cliente no marcado como `risk_flag = 'BLOCKED'`. |
| **Postcondiciones** | Pedido creado en `NEW`, número secuencial asignado por tenant, `order_items` con snapshots, `payment` y `restaurant_payout` en `PENDING`, historial en `order_status_history`, alerta `NEW_ORDER` y evento en `outbox_events`. |

**Flujo Detallado:**
1. El actor envía `POST /api/v1/orders` con `idempotencyKey`, `branchId`, datos del cliente (`phone`, `name`, `address`), `deliveryZoneId`, `paymentMethod` (`CASH | YAPE | BANK_TRANSFER`) e `items[]`.
2. El sistema verifica `can(actor, 'order.create_manual')`.
3. El sistema comprueba si ya existe un pedido con `(tenant_id, idempotency_key)`: si existe, retorna el pedido existente (`200 OK`) sin duplicar.
4. Normaliza el teléfono a `+519XXXXXXXX` y hace upsert en `customers`. Si `customer.risk_flag === 'BLOCKED'`, rechaza la creación salvo override explícito de `COORDINATOR`/`ADMIN`.
5. Calcula el precio de cada ítem con `ProvisionalPricingPolicy` (`base_price_cents`, `packaging_cents`, `margin_cents`, `unit_price_cents` incluyendo modificadores) y verifica que `items_subtotal_cents >= zone.min_order_cents`.
6. En una transacción SQL: inserta `orders` (`number` secuencial vía `next_counter`), `order_items`, `order_item_modifiers`, `payments` (`status = 'PENDING'`), `restaurant_payouts` (`status = 'PENDING'`), `order_status_history` (`NULL -> NEW`), `alerts` (`type = 'NEW_ORDER'`) y `outbox_events`.

---

### CU-005: Aceptación, Rechazo y Preparación en Sucursal (con Timeout)

| Campo | Contenido |
|---|---|
| **ID** | CU-005 |
| **Nombre** | Recepción en sucursal, aceptación/rechazo, preparación y marcado como listo |
| **Descripción** | El encargado de la sucursal acepta el pedido, inicia la preparación (incluso si el pago anticipado aún está `PENDING`) y lo marca como `READY`. |
| **Actores primarios** | `BRANCH_MANAGER`, `COORDINATOR`, `ADMIN` |
| **Precondiciones** | Pedido en estado `NEW` (para aceptar/rechazar), `CONFIRMED` (para preparar) o `PREPARING` (para marcar `READY`). |
| **Postcondiciones** | Estado operativo actualizado con bloqueo optimista (`version + 1`), registrado en `order_status_history`, `audit_logs` y `outbox_events`. |

**Flujos Alternativos:**
- **Timeout de aceptación:** Si transcurren `settings['order.acceptance_timeout_minutes']` (default 5 min) en estado `NEW`, el worker genera una alerta `ACCEPTANCE_TIMEOUT` para el `COORDINATOR`, pero **nunca cancela automáticamente** el pedido (CA-02).
- **Rechazo (`NEW -> REJECTED`):** Exige `reason` obligatorio y notifica a `COORDINATOR` y soporte.

---

### CU-006: Gestión de Productos Faltantes, Cambio de Dirección y Cancelación

| Campo | Contenido |
|---|---|
| **ID** | CU-006 |
| **Nombre** | Manejo de excepciones operativas en el pedido (ítems agotados, dirección, cancelación) |
| **Descripción** | Gestiona el flujo cuando un ítem no está disponible en cocina, el cliente pide cambiar la dirección de entrega o solicita cancelar el pedido. |
| **Actores primarios** | `BRANCH_MANAGER` (marca faltante), `SUPPORT_AGENT` (comunica al cliente / solicita cancelación), `COORDINATOR` / `ADMIN` (autoriza cancelación) |
| **Precondiciones** | Pedido activo antes de `DELIVERED`. |
| **Postcondiciones** | Ítem reemplazado/cancelado con recálculo de totales, nueva dirección aplicada tras aceptación del cliente, o pedido pasado a `CANCELLATION_REQUESTED` -> `CANCELLED`. |

**Flujos Detallados:**
1. **Producto faltante (CA-05):** `BRANCH_MANAGER` marca `order_item.status = 'UNAVAILABLE'` con `unavailable_reason`. Se crea alerta para `COORDINATOR`/`SUPPORT_AGENT`. Tras consultar al cliente, el staff registra `customer_decision` (`ACCEPTED_REPLACEMENT` creando el nuevo ítem con `replacement_of_item_id`, o `CANCELLED_ITEM` descontando su importe del total). El resto del pedido continúa.
2. **Cambio de dirección:** Se selecciona la nueva zona, se recalcula `delivery_fee_cents` y se deja pendiente de confirmación del cliente antes de actualizar `address_snapshot` y `total_cents`.
3. **Cancelación:** `SUPPORT_AGENT` ejecuta transición a `CANCELLATION_REQUESTED` (guardando `prev_status_before_cancel_request`). `COORDINATOR` o `ADMIN` autoriza (`-> CANCELLED`) o deniega (`-> prev_status_before_cancel_request`).

---

### CU-007: Validación Humana de Pago Anticipado y Confirmación de Pago al Restaurante

| Campo | Contenido |
|---|---|
| **ID** | CU-007 |
| **Nombre** | Validación de comprobante (Yape/Transferencia), pago al restaurante y correcciones |
| **Descripción** | Permite validar manualmente el comprobante de pago del cliente, confirmar el abono al restaurante (`restaurant_payouts`) requisito indispensable antes del despacho, y realizar correcciones o reembolsos auditados. |
| **Actores primarios** | `COORDINATOR`, `SUPPORT_AGENT`, `ADMIN` |
| **Precondiciones** | Permiso `payment.validate`, `payout.restaurant.confirm`, `payment.correct` o `refund.manage`. |
| **Postcondiciones** | `payments.status` y `orders.payment_status` en `PAID`; `restaurant_payouts.status` y `orders.restaurant_payout_status` en `CONFIRMED`; eventos inmutables en `payment_events` y `audit_logs`. |

**Reglas críticas:**
- Subir una imagen (`proof_asset_id`) **no** cambia el estado a `PAID`; requiere acción explícita de un usuario con `payment.validate` que registra `validated_by` y `validated_at` (CA-03).
- Toda corrección (`payment.correct`) exige `reason` y registra `before` y `after` en `payment_events` (`type = 'CORRECTED'`) sin borrar el registro original (CA-11).

---

### CU-008: Asignación Manual de Repartidor con Evaluación de Elegibilidad

| Campo | Contenido |
|---|---|
| **ID** | CU-008 |
| **Nombre** | Selección y asignación manual de repartidor validando vehículo y garantía |
| **Descripción** | El Coordinador o Empleado autorizado asigna un repartidor disponible a un pedido `READY`, verificando mediante `canAssignRider()` vehículo adecuado (carro si es frágil y lo requiere) y saldo de garantía suficiente si es en efectivo. |
| **Actores primarios** | `COORDINATOR`, `SUPPORT_AGENT` (si `support.can_assign_rider = true`), `ADMIN` |
| **Precondiciones** | Pedido en `READY` (o `DELIVERY_FAILED` con 2.º intento autorizado). |
| **Postcondiciones** | `orders.rider_id` asignado, `operational_status = 'RIDER_ASSIGNED'`, historial y auditoría registrados. |

**Regla de elegibilidad (`canAssignRider` — CA-06, CA-09):**
1. `rider.is_active === true` y `rider.status === 'AVAILABLE'` (o `'BUSY'` si `settings['rider.allow_multiple_orders']`).
2. Si el pedido exige carro por producto frágil (`is_fragile`), `rider.vehicle_type === 'CAR'`.
3. Si `order.payment_method === 'CASH'`:
   - Si `guarantee_balance < 0` (tiene deuda): **bloqueado siempre**, mostrando monto de deuda.
   - Es exento de garantía si `age >= settings['rider.min_age_for_cash_without_guarantee']` (35 años) **o** `rider.high_trust === true` (registrando qué condición aplicó).
   - Si no es exento: requiere `guarantee_balance >= max(settings['guarantee.min_cents'], order.cash_to_collect_cents)`.
4. Si el pedido ya está pagado (`YAPE` / `BANK_TRANSFER`), el bloqueo de efectivo no impide asignarlo.

---

### CU-009: Handoff Físico y Regla de Liberación (`evaluateReleaseGate`)

| Campo | Contenido |
|---|---|
| **ID** | CU-009 |
| **Nombre** | Entrega física en local (`handoff`) y guarda de salida a ruta (`ON_THE_WAY`) |
| **Descripción** | Garantiza que ningún pedido salga del restaurante sin que el restaurante haya cobrado (`restaurant_payout_status = 'CONFIRMED'`), el encargado haya registrado el `handoff` físico y el pago anticipado del cliente esté validado (`PAID`). |
| **Actores primarios** | `BRANCH_MANAGER` (registra `handoff`), `RIDER` (marca llegada `RIDER_AT_PICKUP` y salida `ON_THE_WAY`) |
| **Precondiciones** | Pedido en `RIDER_ASSIGNED` / `RIDER_AT_PICKUP`. |
| **Postcondiciones** | `handoff_at`, `handoff_by`, `released_at`, `released_by` registrados; pedido en `ON_THE_WAY`; intento `delivery_attempts` iniciado. |

**Flujo Detallado (CA-03, CA-04):**
1. El repartidor llega al local y ejecuta transición `RIDER_ASSIGNED -> RIDER_AT_PICKUP`. Se inicia el temporizador de espera (`rider.pickup_wait_minutes = 15`).
2. `COORDINATOR` o `SUPPORT_AGENT` confirma el pago al restaurante (`restaurant_payout_status = 'CONFIRMED'`).
3. `BRANCH_MANAGER` registra el `handoff` físico. Si `restaurant_payout_status !== 'CONFIRMED'`, el servidor **rechaza** la operación (`409 Conflict` + constraint SQL `orders_handoff_requires_payout_chk`).
4. El repartidor pulsa "Iniciar entrega (`ON_THE_WAY`)". El servidor ejecuta `evaluateReleaseGate(order, payment, payout, rider, handoff)`:
   - Verifica repartidor asignado y elegible.
   - Si `payment_method IN ('YAPE', 'BANK_TRANSFER')`, exige `payment_status === 'PAID'`.
   - Exige `restaurant_payout_status === 'CONFIRMED'`.
   - Exige `handoff_at !== null`.
5. Si todas pasan, pasa a `ON_THE_WAY` y crea `delivery_attempts` (`attempt_no`, `outcome = 'IN_PROGRESS'`).

---

### CU-010: Entrega Exitosa y Cobro en Efectivo contra Garantía (Ledger)

| Campo | Contenido |
|---|---|
| **ID** | CU-010 |
| **Nombre** | Confirmación de entrega al cliente y asiento automático en billetera |
| **Descripción** | El repartidor marca el pedido como `DELIVERED`. Si es en efectivo, registra el importe cobrado y el sistema inserta un asiento `CASH_COLLECTED` negativo en `wallet_entries` dentro de la misma transacción. |
| **Actores primarios** | `RIDER` |
| **Precondiciones** | Pedido en `ON_THE_WAY` asignado al repartidor autenticado. |
| **Postcondiciones** | Pedido en `DELIVERED`, `delivery_attempts.outcome = 'DELIVERED'`, `payments.status = 'PAID'` (si efectivo), asiento inmutable `CASH_COLLECTED (-cash_collected_cents)` en `wallet_entries`. |

**Flujos Alternativos:**
- Si `cash_collected_cents !== order.cash_to_collect_cents`, el sistema exige un motivo obligatorio y abre automáticamente un `order_incident` para revisión del `COORDINATOR`.

---

### CU-011: Entrega Fallida (Máx. 2 Intentos), Devolución e Incidencias Económicas

| Campo | Contenido |
|---|---|
| **ID** | CU-011 |
| **Nombre** | Gestión de entrega fallida, segundo intento autorizado, devolución al local y resolución |
| **Descripción** | Gestiona el caso en que el cliente no recibe el pedido, controlando el límite de 2 intentos, la confirmación física de devolución al restaurante y el registro de pérdidas sin cargos automáticos. |
| **Actores primarios** | `RIDER`, `COORDINATOR`, `BRANCH_MANAGER` |
| **Precondiciones** | Pedido en `ON_THE_WAY`. |
| **Postcondiciones** | `delivery_attempts` actualizado a `FAILED` con motivo y foto opcional; pedido reintentado, devuelto (`RETURNED_TO_RESTAURANT`) o cerrado en `PENDING_RESOLUTION -> CANCELLED`. |

**Flujo Detallado (CA-07, CA-08):**
1. El repartidor marca `DELIVERY_FAILED` indicando `failure_reason`, `notes` y foto opcional (`evidence_asset_id`).
2. Si `attempts_count === 1`: el `COORDINATOR` puede autorizar un 2.º intento (`DELIVERY_FAILED -> RIDER_ASSIGNED` registrando `authorized_by`) o iniciar devolución (`-> RETURN_PENDING`).
3. Si `attempts_count === 2`: el sistema transiciona automáticamente a `PENDING_RESOLUTION` (prohibido un 3.er intento automático).
4. En devolución (`RETURN_PENDING`): cuando el repartidor devuelve el producto al local, el `BRANCH_MANAGER` confirma recepción física (`-> RETURNED_TO_RESTAURANT`).
5. Si existe pérdida económica, el `COORDINATOR` o `ADMIN` registra la decisión justificada en `order_incidents` (`decision`, `amount_cents`, `justification`).

---

### CU-012: Gestión de Billetera de Garantía, Adelantos y Liquidación Diaria (Corte 23:00)

| Campo | Contenido |
|---|---|
| **ID** | CU-012 |
| **Nombre** | Depósitos de garantía, adelantos de combustible y liquidación diaria de repartidores |
| **Descripción** | Administra el libro mayor (`wallet_entries`) del repartidor, los adelantos autorizados por humano (`rider_advances`) y el cierre diario (`settlements`) a las 23:00 (`America/Lima`). |
| **Actores primarios** | `COORDINATOR`, `ADMIN`, `SUPPORT_AGENT` (adelantos si parametrizado), `RIDER` (consulta propia) |
| **Precondiciones** | Permisos `wallet.adjust`, `advance.create`, `settlement.confirm`, `wallet.view_own`. |
| **Postcondiciones** | Asientos `GUARANTEE_DEPOSIT`, `GUARANTEE_WITHDRAWAL`, `ADJUSTMENT` o `CASH_SETTLED` insertados en `wallet_entries`; adelantos marcados `DEDUCTED`; liquidación en `CONFIRMED`. |

**Flujo de Liquidación Diaria (CA-10):**
1. A las `23:00 America/Lima` (o bajo demanda del `COORDINATOR`), el job genera un borrador `settlements` (`status = 'DRAFT'`) por repartidor y `business_date` con:
   - `cash_collected_cents`: suma de cobros en efectivo del día.
   - `advances_deducted_cents`: suma de `rider_advances` en `PENDING_DEDUCTION`.
   - `rider_fee_reference_cents`: suma informativa de `delivery_fee_cents` de pedidos entregados.
2. El `COORDINATOR` ingresa el efectivo realmente entregado por el repartidor (`cash_received_cents`) y, si modifica `rider_fee_payable_cents`, indica `rider_fee_override_reason`.
3. Al confirmar (`settlement.confirm` con bloqueo `SELECT ... FOR UPDATE` sobre `riders`):
   - Inserta asiento `CASH_SETTLED (+cash_received_cents)` en `wallet_entries`.
   - Marca los adelantos incluidos como `DEDUCTED` vinculando `deducted_in_settlement_id`.
   - Si `cash_received_cents < cash_collected_cents`, la diferencia queda reflejada como menor saldo de garantía o deuda (`balance_cents < 0`), bloqueando futuros pedidos en efectivo hasta regularizar.

---

### CU-013: Consulta de Dashboard, Reportes por Rol y Exportación CSV

| Campo | Contenido |
|---|---|
| **ID** | CU-013 |
| **Nombre** | Visualización de indicadores operativos/ventas y exportación en CSV |
| **Descripción** | Presenta métricas filtradas por periodo (`Hoy`, `Ayer`, `7d`, `30d`, `Personalizado` en `America/Lima`) y por alcance de rol, permitiendo exportar el `TabularDataset` resultante a CSV UTF-8 con BOM. |
| **Actores primarios** | `ADMIN`, `COORDINATOR`, `BRANCH_MANAGER`, `RIDER` |
| **Precondiciones** | Permiso de reporte (`report.global_financial`, `report.operational`, `report.branch_sales`). |
| **Postcondiciones** | Reporte visualizado o descargado en streaming CSV respetando exactamente el mismo filtro de seguridad y alcance que la lectura en pantalla (CA-14). |

---

### CU-014: Pedido Web como Invitado y Seguimiento por Token Público (`SHOULD`)

| Campo | Contenido |
|---|---|
| **ID** | CU-014 |
| **Nombre** | Compra en menú público `/m/[branchSlug]` y consulta de estado en `/p/[publicToken]` |
| **Descripción** | Permite al cliente final ver la carta activa de una sucursal, enviar un pedido como invitado y consultar su estado mediante un enlace con token opaco sin exponer el desglose interno ni el GPS del repartidor. |
| **Actores primarios** | Cliente Final |
| **Precondiciones** | Sucursal activa; ruta pública con rate-limiting. |
| **Postcondiciones** | Eventos `funnel_events` (`IMPRESSION`, `MENU_VIEW`, `ADD_TO_CART`, `PURCHASE`) capturados; respuesta servida mediante `CustomerOrderDTO` (sin `base_price_cents`, `packaging_cents`, `margin_cents` ni coordenadas del repartidor — CA-12). |

---

### CU-015: Sincronización Omnicanal e Ingesta desde Vocero CRM (Punto de Extensión / R1)

| Campo | Contenido |
|---|---|
| **ID** | CU-015 |
| **Nombre** | Recepción de despacho desde Vocero CRM y notificación de estados vía `/api/bot/*` |
| **Descripción** | Conecta Zero Delivery con Vocero CRM para recibir eventos de conversación (`EventoDespacho`), descargar comprobantes de pago enviados por WhatsApp y notificar cambios de estado del pedido al cliente. |
| **Actores primarios** | Vocero CRM (`Sistema Externo`), Worker de Outbox (`zero-delivery`) |
| **Precondiciones** | `settings['feature.integration.vocero'] === true` y variables `VOCERO_BASE_URL`, `VOCERO_BOT_API_KEY` configuradas. |
| **Postcondiciones** | Evento registrado idempotentemente en `inbound_events`; mensajes salientes y cambios de etapa enviados a Vocero CRM desde `outbox_events`. |

**Flujo Detallado (CA-13):**
1. Vocero CRM envía `POST /api/webhooks/vocero` con cuerpo `EventoDespacho` y firma `X-Vocero-Signature: sha256=...`.
2. Zero Delivery verifica el flag `feature.integration.vocero` y valida la firma HMAC-SHA256.
3. Inserta en `inbound_events(provider='vocero', external_event_id=dispatchId, payload)`. Si ya existe, responde `200 OK` sin reprocesar.
4. Cuando un pedido cambia de estado en Zero Delivery, el worker lee `outbox_events` y llama a `VoceroCrmAdapter`:
   - Envía mensaje formateado en español (`es-PE`) a `POST {VOCERO_BASE_URL}/api/bot/messages`.
   - Actualiza la ficha del contacto en `PUT {VOCERO_BASE_URL}/api/bot/ficha`.
   - Si falla por red o `5xx`, incrementa `attempts`, programa `next_attempt_at` con exponential backoff y genera alerta si supera el umbral, sin afectar la transacción interna del pedido.
