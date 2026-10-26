# Zero Delivery — Especificación de construcción del MVP (para agente de codificación)

**Versión:** 1.0-mvp
**Origen:** Derivado de *"Zero Delivery — Especificación integral v1.1"* (borrador consolidado).
**Idioma de la UI:** Español (Perú, `es-PE`) · **Moneda:** Soles (S/) · **Zona horaria:** `America/Lima`
**Idioma del código:** inglés (tablas, columnas, enums, variables). Los textos visibles al usuario van en español.

---

## 0. Cómo debes trabajar (léelo primero)

Eres el agente que construye Zero Delivery. Este documento es tu fuente de verdad. Si existe el documento original (`docs/zero-delivery-spec-v1.1.md`) y contradice a este, **este prevalece**.

**Reglas de trabajo:**

1. Trabaja **por hitos** (sección 17), en orden. No empieces un hito sin cumplir los criterios de salida del anterior.
2. Al cerrar cada hito: `lint` + `typecheck` + tests en verde, migraciones aplicadas desde cero, `seed` funcionando, y un resumen breve en `docs/CHANGELOG.md`.
3. **No inventes reglas de negocio.** Todo lo marcado `PENDIENTE` (sección 16) se implementa como **parámetro configurable** con un valor por defecto marcado `PLACEHOLDER` y un comentario `// TODO(DECISION-XX)`. Nunca lo dejes escrito como constante en el código.
4. Cuando tengas que asumir algo no cubierto aquí, regístralo en `docs/ASSUMPTIONS.md` (fecha, supuesto, motivo) y continúa. No te detengas a preguntar salvo que el supuesto sea irreversible (p. ej. borrar datos financieros).
5. **Autorización siempre en el servidor.** Ocultar botones no es seguridad.
6. **No construyas nada del apartado "Fuera del MVP"** (sección 5), pero sí deja los **puntos de extensión** indicados (interfaces, tablas, colas) para que agregarlo después no requiera reescribir.
7. Prefiere simple y correcto sobre sofisticado. Un monolito modular bien separado, no microservicios.
8. Versiones de librerías: verifica la versión estable actual al instalar, fíjala en `package.json` y no uses APIs deprecadas.

---

## 1. Contexto del producto

Zero Delivery es una **plataforma multi-restaurante** operada por una agencia de delivery. Centraliza pedidos, preparación, asignación de repartidores, validación de pagos (Yape/transferencia/efectivo), garantías y liquidaciones de repartidores, clientes, alertas y reportes.

Hay dos "mundos" que el sistema debe separar:

- **La agencia** (Administrador, Coordinador, Empleado): opera la logística y el dinero.
- **El restaurante independiente** (Encargado): recibe, prepara y entrega el paquete físico al repartidor.
- **El repartidor** (flota propia, de agencia o tercero): entrega y, a veces, cobra en efectivo.

El MVP debe permitir operar **un día real completo** de punta a punta: pedido → aceptación → preparación → pago validado → asignación → entrega (o fallo) → liquidación del repartidor → reporte del día.

---

## 2. Principios de diseño (MVP hoy, escalable mañana)

| Principio | Qué implica en la práctica |
|---|---|
| **Monolito modular** | Una sola app Next.js; módulos con fronteras claras (`src/modules/*`). Se podrá extraer un módulo o el worker a su propio servicio sin reescribir la lógica. |
| **Multi-tenant desde el día 1** | Toda tabla de negocio lleva `tenant_id`. El MVP corre con un solo tenant sembrado (la agencia), pero ninguna consulta debe poder cruzar tenants. |
| **Lógica fuera de la UI** | Server Actions y Route Handlers son capas delgadas que llaman a *servicios de aplicación*. Los jobs y webhooks llaman a los mismos servicios. |
| **Puertos y adaptadores** | Todo lo externo (WhatsApp, Vocero CRM, almacenamiento, exportadores, notificaciones, pricing) está detrás de una interfaz. El MVP trae adaptadores simples o *stubs*. |
| **Estado explícito** | Los pedidos se rigen por una **máquina de estados** con tabla de transiciones, roles y guardas. Estado operativo y estado de pago son **independientes**. |
| **Dinero = libro mayor inmutable** | Importes en **céntimos enteros**. Garantías, cobros y liquidaciones se modelan como **asientos de solo-inserción** (*append-only ledger*). Nunca se edita ni borra un asiento: se corrige con otro asiento. |
| **Auditoría inmutable** | `audit_logs` solo permite `INSERT` (reforzado con trigger/permisos en la BD). |
| **Idempotencia** | Creación de pedidos, webhooks y reintentos usan claves de idempotencia/deduplicación. |
| **Efectos secundarios vía *outbox*** | Notificaciones e integraciones salientes se encolan en una tabla `outbox_events` dentro de la misma transacción y las procesa un worker. |
| **Configuración, no constantes** | Umbrales, tiempos, montos y permisos finos viven en `settings` (por tenant). |

---

## 3. Stack tecnológico

**Fijo (requerido por el negocio):**

- **Frontend e interfaz:** Next.js (App Router) + TypeScript estricto. **PWA** instalable y **responsive** (móvil y escritorio).
- **Base de datos:** PostgreSQL (único sistema de persistencia principal).
- **Backend:** servicios protegidos y centralizados en el servidor (lógica de negocio, reglas comerciales, control de acceso por rol, auditoría).
- **Integraciones y omnicanalidad:** API + webhooks con Vocero CRM; adaptadores independientes para chatbot y notificaciones por WhatsApp.
- **Exportación:** generación nativa de **CSV, Excel y PDF**.

**Recomendado (puedes cambiarlo documentando el motivo en un ADR en `docs/adr/`):**

| Área | Elección | Nota |
|---|---|---|
| Gestor de paquetes | `pnpm` | |
| ORM / migraciones | **Drizzle ORM** + `drizzle-kit` | Migraciones SQL; usa SQL crudo para triggers y `CHECK`. |
| Validación | **Zod** | Mismo esquema para formularios, API y servicios. |
| Auth | **Sesiones propias en BD** + cookie `httpOnly`, `Secure`, `SameSite=Lax`; hash **argon2id** (`@node-rs/argon2`) | Login por `username` + contraseña. |
| UI | Tailwind CSS + shadcn/ui | Mobile-first para Repartidor y Encargado. |
| Datos en cliente | TanStack Query (polling para "tiempo real"), TanStack Table | |
| Formularios | react-hook-form + zod resolver | |
| PWA | **Serwist** (service worker) + `manifest.webmanifest` | Offline solo para *app shell* y lecturas cacheadas. |
| Jobs / colas | **pg-boss** (cola sobre PostgreSQL) | Sin Redis en el MVP. |
| Logs | pino (JSON, sin datos personales) | |
| Archivos | Puerto `StoragePort`; adaptador local en dev, S3-compatible en prod | |
| CSV / Excel / PDF | CSV propio por *streaming* (con BOM UTF-8) · `exceljs` · `pdfkit` | Evita navegadores headless. |
| Tests | Vitest (unit/integración con Postgres real) + Playwright (e2e) | |
| Contenedores | `docker compose` (app + postgres) | |
| CI | GitHub Actions: lint, typecheck, test | |

---

## 4. Arquitectura y estructura del repositorio

```
/
├─ docs/                      # este spec, ADRs, ASSUMPTIONS.md, CHANGELOG.md, runbooks
├─ drizzle/                   # migraciones SQL generadas + personalizadas (triggers)
├─ public/                    # íconos PWA, manifest
├─ scripts/                   # seed.ts, backup.sh, restore.sh
├─ src/
│  ├─ app/                    # Next.js App Router (solo UI + handlers delgados)
│  │  ├─ (auth)/login
│  │  ├─ (staff)/             # coordinador / empleado / admin / encargado
│  │  ├─ (rider)/             # vista móvil del repartidor
│  │  ├─ (public)/m/[branchSlug], p/[publicToken]   # menú y estado de pedido (cliente)
│  │  └─ api/v1/..., api/webhooks/[provider]
│  ├─ modules/                # un directorio por módulo de negocio
│  │  ├─ identity/            # usuarios, sesiones, roles, policy (RBAC)
│  │  ├─ tenancy/             # restaurantes, sucursales, horarios, zonas
│  │  ├─ catalog/             # categorías, productos, modificadores, cartas, disponibilidad
│  │  ├─ customers/
│  │  ├─ orders/              # pedidos, máquina de estados, kanban, incidencias
│  │  ├─ payments/            # pagos de clientes, validación, pago al restaurante, reembolsos
│  │  ├─ logistics/           # repartidores, asignación, intentos, devoluciones
│  │  ├─ wallet/              # garantía, adelantos, liquidaciones (ledger)
│  │  ├─ reporting/           # dashboard, reportes, exportadores
│  │  ├─ alerts/
│  │  ├─ audit/
│  │  ├─ settings/
│  │  └─ integrations/        # ports + adapters (vocero, whatsapp, notifications)
│  │      Cada módulo: domain/ (tipos, reglas puras) · application/ (servicios) · infra/ (repos, adapters) · ui/
│  ├─ shared/                 # money, time, phone, errors, result, ids, logger, i18n (es-PE)
│  ├─ db/                     # schema Drizzle, cliente, helpers de transacción
│  └─ worker/                 # entrypoint de pg-boss (jobs programados y outbox)
└─ tests/                     # e2e y fixtures
```

**Reglas de dependencia (hazlas cumplir con una regla de ESLint o `dependency-cruiser`):**

- `app/` → `modules/*/application` (nunca a `infra` ni a la BD directamente).
- `domain/` no importa nada de Next, de la BD ni de librerías de infraestructura.
- Los módulos se comunican por sus **servicios públicos** (`index.ts` de cada módulo), no importando archivos internos de otro módulo.
- Las integraciones externas solo se invocan a través de **puertos**.

**Contexto del actor.** Cada servicio de aplicación recibe un `ActorContext` y **debe** autorizar antes de actuar:

```ts
type ActorContext = {
  tenantId: string;
  userId: string;
  role: 'ADMIN' | 'COORDINATOR' | 'BRANCH_MANAGER' | 'SUPPORT_AGENT' | 'RIDER';
  branchIds: string[];          // alcance de sucursales (vacío = según rol)
  requestId: string;            // correlación para auditoría y logs
};

// Toda autorización pasa por aquí. Única fuente de verdad.
function can(actor: ActorContext, action: PermissionKey, resource?: ResourceRef): Decision;
```

Nombres de roles en código ↔ UI en español: `ADMIN` Administrador · `COORDINATOR` Coordinador · `BRANCH_MANAGER` Encargado · `SUPPORT_AGENT` Empleado (atención al cliente) · `RIDER` Repartidor.

---

## 5. Alcance: MVP vs. fuera del MVP

### 5.1 Dentro del MVP (en orden de prioridad)

**MUST** (sin esto no hay MVP):

- Autenticación usuario/contraseña, 5 roles, RBAC en servidor, auditoría.
- Restaurantes, sucursales, horarios por sucursal, activar/desactivar sucursal, zonas de reparto simples (nombre + tarifa + pedido mínimo).
- Catálogo: categorías, productos (con marca *frágil/sensible* y archivado), modificadores con recálculo de precio, cartas con precio por carta, disponibilidad por sucursal, imágenes.
- Pedidos: **registro manual** por personal autorizado, snapshot de precios, desglose interno de costos oculto al cliente, estados, Kanban por rol, aceptar/rechazar con alerta por timeout, preparación, "listo", historial y notas, búsqueda y filtros.
- Productos faltantes (el cliente decide reemplazo o cancelar el ítem), solicitud/autorización de cancelación, cambio de dirección con nuevo costo aceptado.
- Pagos: efectivo, Yape, transferencia. Validación humana de comprobantes. **Regla de liberación**. Pago al restaurante confirmado antes del despacho. Corrección de pagos con auditoría. Reembolso manual registrado.
- Logística: perfil de repartidor, asignación manual (Coordinador/Empleado/Admin) con **elegibilidad**, vista móvil del repartidor, estados de entrega, **ubicación compartida manualmente**, entrega fallida (hasta 2 intentos), devolución al restaurante.
- Finanzas del repartidor: garantía (ledger), bloqueo de efectivo si garantía insuficiente o hay deuda, adelantos, liquidación diaria con corte configurable.
- Dashboard por rol y periodos (Hoy, Ayer, 7 días, 30 días, personalizado). Reportes de ventas, operativos y de clientes (básico). **Exportación CSV**.
- Alertas operativas dentro de la app (con sonido para pedidos nuevos).
- PWA instalable. Backups y procedimiento de restauración.

**SHOULD** (si el tiempo lo permite, dentro del hito 4):

- Menú público `/m/[branchSlug]` y compra como invitado + página de estado `/p/[publicToken]`.
- Captura de eventos de embudo (`funnel_events`) sin reporte aún.
- Calificación del cliente por parte del repartidor (guardado simple).

### 5.2 Fuera del MVP (NO construir; solo dejar el punto de extensión)

| Funcionalidad | Punto de extensión que SÍ debes dejar |
|---|---|
| Integración real con **Vocero CRM** (API/webhooks) | `CrmPort` + endpoint `/api/webhooks/[provider]` con tabla `inbound_events` (idempotencia) y firma HMAC por proveedor, **desactivado por feature flag**. |
| **WhatsApp** y **chatbot** | `NotificationPort`/`MessagingPort`, `outbox_events`, plantillas de mensajes por evento. Adaptador MVP: `InAppNotifier` + `ConsoleNotifier`. |
| Exportación **Excel y PDF** | Interfaz `Exporter` ya con `csv`; `xlsx` y `pdf` se registran después sin cambiar los reportes. |
| Asignación **automática** de repartidores | `AssignmentStrategy` (interfaz); MVP implementa solo `ManualStrategy`. |
| **Puntaje de confianza** del repartidor | Columna `trust_score` nula + interfaz `TrustScorer`. No sancionar automáticamente. |
| **Promociones**, cupones, combos | Tablas vacías `promotions`, `promotion_rules`; `PricingPolicy` recibe `discounts[]` (vacío en MVP). |
| Embudo de conversión (reporte) | Solo se capturan eventos (SHOULD). |
| Tarifas dinámicas por distancia/vehículo, geocodificación, polígonos | `DeliveryFeePolicy` (interfaz); MVP = tarifa fija por zona. |
| GPS continuo, mapa en tiempo real | Tabla `rider_location_pings` ya existe; MVP solo guarda la ubicación compartida a mano. |
| Calificaciones del cliente al restaurante/repartidor, regla "N pedidos = 5 estrellas" | Tabla `ratings` creada; **no** implementar la conversión pedidos→estrellas (marcada "revisar" en el spec original). |
| Facturación electrónica / SUNAT, pasarela de tarjetas | `tax_cents` y `invoice_requested` en el pedido; sin cálculo ni emisión. |
| Notificaciones push web | `push_subscriptions` queda para después. |
| App nativa de repartidor | La API `/api/v1` ya es consumible por cualquier cliente. |

---

## 6. Roles y permisos (matriz a implementar)

Define las acciones como `PermissionKey` y mapea cada una a roles en **un solo archivo** (`modules/identity/domain/permissions.ts`). Escribe un test **table-driven** que recorra *rol × acción* y compare contra esta matriz.

Leyenda: ✔ permitido · — no · *(p)* permitido con parámetro/permiso configurable · *(propio)* solo en su alcance (sucursal o asignación).

| Acción (`PermissionKey`) | ADMIN | COORDINATOR | BRANCH_MANAGER | SUPPORT_AGENT | RIDER |
|---|:-:|:-:|:-:|:-:|:-:|
| `user.manage` (crear usuarios, asignar roles) | ✔ | — | — | — | — |
| `settings.global.manage` (reglas globales) | ✔ | — | — | — | — |
| `restaurant.manage` (crear restaurantes/sucursales) | ✔ | — | — | — | — |
| `branch.toggle` (activar/desactivar temporalmente) | ✔ | ✔ | — | — | — |
| `branch.schedule.edit` | ✔ | ✔ | ✔ propio | — | — |
| `product.create` | ✔ | ✔ | ✔ propio | — | — |
| `product.availability.edit` | ✔ | ✔ | ✔ propio | — | — |
| `product.price.edit` | ✔ | ✔ (dentro de reglas) | ✔ propio (dentro de reglas) | — | — |
| `order.create_manual` | ✔ | ✔ | — | ✔ | — |
| `order.view` | ✔ todas | ✔ todas (operativo) | ✔ propio, ver nota A | ✔ lectura avanzada | ✔ solo asignados |
| `order.accept_reject` | ✔ | ✔ | ✔ propio | — | — |
| `order.start_prepare` / `order.mark_ready` | ✔ (override auditado) | — | ✔ propio | — | — |
| `order.handoff_to_rider` (registrar entrega física al repartidor) | ✔ (override auditado) | — | ✔ propio | — | — |
| `order.assign_rider` | ✔ | ✔ | — | ✔ *(p)* | — |
| `order.note.add` | ✔ | ✔ | ✔ | ✔ | ✔ (incidencia) |
| `order.cancel.request` | ✔ | ✔ | — | ✔ | — |
| `order.cancel.authorize` | ✔ | ✔ | — | — | — |
| `order.address_change.manage` | ✔ | ✔ | — | ✔ (solicita) | — |
| `payment.validate` (Yape/transferencia) | ✔ | ✔ | — | ✔ | — |
| `payout.restaurant.confirm` (pago al restaurante) | ✔ | ✔ | — | ✔ | — |
| `payment.correct` (con motivo) | ✔ | ✔ | — | — | — |
| `refund.manage` | ✔ | ✔ | — | — | — |
| `rider.manage` (perfil, flota, vehículo) | ✔ | ✔ | — | — | — |
| `delivery.update_own` (cerca del local, en camino, entregado, fallida) | ✔ (override) | — | — | — | ✔ propio |
| `delivery.second_attempt.authorize` | ✔ | ✔ | — | — | — |
| `return.confirm_physical` | ✔ | ✔ | ✔ propio | — | — |
| `return.resolve` | ✔ | ✔ | — | — | — |
| `wallet.view_own` | — | — | — | — | ✔ |
| `wallet.view_any` | ✔ | ✔ | — | ✔ (solo lectura) | — |
| `wallet.adjust` (ajuste manual de garantía) | ✔ | ✔ (con motivo) | — | — | — |
| `advance.create` | ✔ | ✔ | — | ✔ *(p)* | — |
| `settlement.confirm` | ✔ | ✔ | — | — | — |
| `incident.loss.decide` | ✔ | ✔ | — | — | — |
| `customer.history.view` | ✔ | ✔ | — | ✔ | — |
| `customer.risk_flag.set` | ✔ | ✔ | — | — | — |
| `report.global_financial` | ✔ | — | — | — | — |
| `report.operational` | ✔ global | ✔ global | ✔ propio | — | ✔ métricas propias |
| `report.branch_sales` | ✔ | ✔ | *(p)* setting, default **off** | — | — |
| `report.funnel` | ✔ | *(p)* setting, default **off** | — | — | — |
| `audit.view` | ✔ | — | — | — | — |
| `audit.delete` / `ledger.delete` | **nadie** | **nadie** | **nadie** | **nadie** | **nadie** |
| `export.*` | igual que el permiso de lectura del reporte | | | | |

**Nota A (Encargado):** ve el pedido desde `NEW` hasta `READY` y el momento del *handoff*. Después de la salida del local **solo ve el estado final** (`DELIVERED` / `DELIVERY_FAILED` y devolución). **Nunca** ve mapa, ubicación del repartidor ni datos del cliente más allá de lo necesario para preparar.

**Reglas transversales de datos personales:**

- El **Repartidor** ve nombre/teléfono/dirección del cliente **solo** de pedidos asignados a él y solo mientras estén activos o en revisión.
- El **Empleado** ve historial individual del cliente cuando atiende, sin reportes macro.
- El **Cliente** consulta estados del pedido; **no** ve la ubicación del repartidor ni el desglose interno de costos.
- Toda consulta se filtra por `tenant_id` y por alcance de sucursales del actor.

---

## 7. Reglas de negocio resueltas (implementar tal cual)

### 7.1 Aceptación y preparación

- `BRANCH_MANAGER` y `COORDINATOR` aceptan o rechazan. El tiempo límite de aceptación es **configurable** (`order.acceptance_timeout_minutes`).
- Si vence el tiempo: **alerta al Coordinador**. **No** se cancela automáticamente.
- La preparación puede empezar con pago anticipado **pendiente**, pero el pedido **no puede salir** hasta cumplir la regla de liberación.

### 7.2 Regla de liberación (guarda de despacho) — *crítica*

Un pedido solo puede pasar a `ON_THE_WAY` si **todas** se cumplen:

1. Hay repartidor asignado y **elegible** para ese pedido (7.5).
2. Si el método es **Yape o transferencia**: `payment_status = PAID` (validado por un humano autorizado, **no** basta con subir una imagen).
3. El **pago al restaurante está confirmado** (`restaurant_payout.status = CONFIRMED`) — aplica a efectivo y a pago anticipado.
4. El Encargado registró el **handoff** (entrega física al repartidor). El Encargado **solo** debe registrarlo después de que el pago al restaurante esté confirmado: el sistema debe **rechazar** el handoff si el payout no está confirmado.

Registrar siempre **quién** autorizó la liberación y **cuándo**.

Implementa esto como una función pura y testeable: `evaluateReleaseGate(order, payment, payout, rider, handoff) → { ok: boolean; failures: ReleaseFailure[] }`.

### 7.3 Pagos

- Métodos del MVP: `CASH`, `YAPE`, `BANK_TRANSFER`. (Tarjeta: fuera.)
- Estado de pago (independiente del operativo): `PENDING`, `PAID`, `REJECTED`, `REFUNDED`.
- **Yape/transferencia van directo al local**: no afectan la garantía del repartidor. El repartidor ve "ya pagado — sin cobro".
- **Efectivo contra entrega:** el repartidor cobra al cliente, registra el importe cobrado y se genera un asiento en su billetera (ver 10).
- **Corrección de pagos** (`ADMIN`/`COORDINATOR`): exige `reason`, guarda **valor anterior y nuevo**, conserva el historial. Nunca borrar el registro original. Modela `payments` + `payment_events` (solo-inserción).
- **Reembolsos:** manuales, autorizados por Coordinador/Admin. Se registran motivo, importe, autor, fecha y confirmación. **No** asumas API de reembolso de Yape/bancos.

### 7.4 Productos faltantes, cancelaciones y cambio de dirección

- **Falta producto:** el Encargado marca el ítem como no disponible con motivo → el sistema notifica al cliente (vía canal/staff) y al Coordinador → el cliente decide **reemplazo** (se registra decisión y diferencia de precio) o **cancelar solo ese ítem**. El resto del pedido continúa.
- **Cancelación:** `SUPPORT_AGENT`/`COORDINATOR`/`ADMIN` registran *solicitud*; `COORDINATOR`/`ADMIN` **autorizan**. Si ya empezó la preparación, el Coordinador revisa y cualquier cobro debe justificarse y comunicarse. (Los permisos exactos por interfaz están pendientes → parametrizables.)
- **Cambio de dirección:** recalcula costo de entrega → comunica al cliente → **requiere su aceptación** del costo adicional antes de continuar. Si no acepta, se detiene el cambio y el Coordinador decide.

### 7.5 Elegibilidad del repartidor para un pedido

`canAssignRider(rider, order) → { ok: boolean; reasons: string[] }`:

- `rider.status = AVAILABLE` (o `BUSY` solo si `settings.rider.allow_multiple_orders`).
- Vehículo adecuado: si el pedido contiene un producto **frágil** y el pedido exige carro, el vehículo debe ser `CAR`.
- **Si el pedido es en efectivo:**
  - Exento si cumple la regla configurable de excepción: `age >= settings.rider.min_age_for_cash_without_guarantee` (valor del doc original: **35**, `PENDIENTE` confirmar) **o** está marcado `high_trust = true` por Admin/Coordinador. Registrar qué condición habilitó la excepción.
  - Si no está exento: `guarantee_balance >= max(settings.guarantee.min_cents, cash_to_collect_cents)`.
  - Si `guarantee_balance < 0` (deuda): **bloquear** y mostrar importe pendiente y motivo.
- Para pedidos **sin cobro** (ya pagados) el bloqueo de efectivo **no** aplica: distinguir "bloqueado para efectivo" de "no disponible".

### 7.6 Entregas fallidas y devoluciones

- El repartidor registra motivo, observaciones, hora y foto **opcional** (sin recolectar datos personales innecesarios). Se crea un `delivery_attempt` con `attempt_no`.
- **Máximo 2 intentos** (`delivery.max_attempts = 2`). El segundo intento **requiere autorización del Coordinador**.
- Si el 2.º intento falla → `PENDING_RESOLUTION`. **No** se programa un 3.º automáticamente.
- Devolución: `RETURN_PENDING` → el Encargado confirma recepción física (`RETURNED_TO_RESTAURANT`) → el Coordinador decide cierre (`CANCELLED` con `resolution`) o reintento autorizado (si `attempt_no < 2`).
- Las pérdidas/incidencias económicas se registran en `order_incidents` con evidencia, responsable de revisión, decisión, importe y justificación. **Nunca** cargar automáticamente una pérdida a un repartidor, restaurante o Coordinador.

### 7.7 Espera en el restaurante

- El repartidor espera **hasta 15 minutos** (`rider.pickup_wait_minutes = 15`). El sistema registra la llegada (`RIDER_AT_PICKUP`) y calcula el tiempo transcurrido.
- Qué ocurre después de los 15 min está `PENDIENTE` (DECISION-07). MVP: solo **alerta** al Coordinador. No reasignar ni compensar automáticamente.

### 7.8 Precios y desglose interno

- Cada `order_item` guarda **snapshot**: `base_price_cents`, `packaging_cents`, `margin_cents`, `unit_price_cents`, nombre del producto y modificadores. Cambios posteriores del catálogo **no** alteran pedidos pasados.
- El cliente ve **un precio final** (o según configuración de la carta: `menus.includes_delivery_in_price`, `menus.includes_tax_in_price`). El desglose `base + envase + delivery` y el margen son **internos**: usa DTOs distintos (`CustomerOrderDTO` vs `StaffOrderDTO`) y un test que verifique que el DTO público **no** contiene campos internos.
- **Margen** (ingreso de Zero Delivery): por producto, `margin_type ∈ {FIXED, PERCENT}` y `margin_value`. **La fórmula definitiva NO está aprobada** (DECISION-01). Implementa `PricingPolicy` con una `ProvisionalPricingPolicy` aislada en un solo archivo:
  `unit_price = base + packaging + margin`, donde `margin = FIXED ? value : round(base * value/100)`.
  Márcala `PROVISIONAL`, sin tratamiento de descuentos ni impuestos, y **no** la uses para reportes financieros oficiales hasta que se apruebe.
- **Impuestos:** `tax_cents = 0` en el MVP; `invoice_requested` solo se guarda.
- **Importante conceptual:** el dinero cobrado al cliente **no** es ingreso de Zero Delivery; pertenece al restaurante, a la tarifa de entrega y al margen. No lo mezcles en los reportes.

### 7.9 Clientes

- Identificación y deduplicación por **teléfono normalizado a E.164** (`+519XXXXXXXX`; móvil peruano: 9 dígitos empezando en 9). Compras **como invitado** permitidas.
- Segmentación: `NEW`, `RECURRING`, `TOP` (umbral configurable `customer.top_min_orders`).
- **Filtro de seguridad de clientes (antes llamado "doxeo"):** implementa **solo** un indicador manual `risk_flag ∈ {NONE, CAUTION, BLOCKED}` con `reason`, fijado por Coordinador/Admin y auditado. **No** implementes búsqueda, scraping ni recopilación de datos personales de fuentes externas. Aplica minimización de datos.

### 7.10 Geolocalización

- La ubicación del repartidor se comparte **manualmente** (botón "Compartir ubicación" → `navigator.geolocation` en primer plano → guarda último ping).
- Admin/Coordinador/Empleado (solo lectura) pueden ver el último ping. **El cliente nunca.** No hay mapa en tiempo real en el MVP; muestra enlace "Abrir en Google Maps" (`https://www.google.com/maps/search/?api=1&query=lat,lng`), sin API key.

---

## 8. Máquina de estados del pedido

**Dos ejes independientes:**

- `operational_status` (logística) — esta sección.
- `payment_status` (`PENDING | PAID | REJECTED | REFUNDED`) — sección 7.3.
- Además: `restaurant_payout_status` (`PENDING | CONFIRMED`) y `handoff_at` (nullable).

**Estados operativos** (etiquetas UI en español entre paréntesis):

`NEW` (Nuevo) · `CONFIRMED` (Confirmado) · `PREPARING` (En preparación) · `READY` (Listo) · `RIDER_ASSIGNED` (Repartidor asignado) · `RIDER_AT_PICKUP` (Rider cerca del punto de retiro) · `ON_THE_WAY` (En camino) · `DELIVERED` (Entregado)

Alternativos: `REJECTED` (Rechazado) · `CANCELLATION_REQUESTED` (Cancelación solicitada) · `CANCELLED` (Cancelado) · `DELIVERY_FAILED` (Entrega fallida) · `RETURN_PENDING` (Devolución pendiente) · `RETURNED_TO_RESTAURANT` (Devuelto al restaurante) · `PENDING_RESOLUTION` (Pendiente de resolución)

**Tabla de transiciones (propuesta a aprobar; impleméntala como dato, no como `if` dispersos):**

```ts
type Transition = {
  from: OrderStatus; to: OrderStatus;
  roles: Role[];                 // quién puede ejecutarla
  guards: GuardId[];             // funciones puras que deben pasar
  requiresReason?: boolean;
  audit: true;
};
```

| De → A | Roles | Guardas / notas |
|---|---|---|
| `NEW → CONFIRMED` | BRANCH_MANAGER, COORDINATOR, ADMIN | Sucursal abierta; productos disponibles. |
| `NEW → REJECTED` | BRANCH_MANAGER, COORDINATOR, ADMIN | Motivo obligatorio. |
| `CONFIRMED → PREPARING` | BRANCH_MANAGER, ADMIN(override) | |
| `PREPARING → READY` | BRANCH_MANAGER, ADMIN(override) | |
| `READY → RIDER_ASSIGNED` | COORDINATOR, SUPPORT_AGENT(p), ADMIN | `canAssignRider` ok. *(MVP: solo desde `READY`; la tabla permite relajarlo luego.)* |
| `RIDER_ASSIGNED → RIDER_AT_PICKUP` | RIDER | Es el repartidor asignado. |
| *(evento)* `handoff` | BRANCH_MANAGER, ADMIN(override) | Guarda `handoff_at`; **rechazar si `restaurant_payout_status ≠ CONFIRMED`**. |
| `RIDER_AT_PICKUP → ON_THE_WAY` | RIDER | **`evaluateReleaseGate` ok** (incluye handoff). |
| `ON_THE_WAY → DELIVERED` | RIDER | Si efectivo: exige importe cobrado → asiento de billetera. |
| `ON_THE_WAY → DELIVERY_FAILED` | RIDER | Motivo obligatorio; crea `delivery_attempt`. |
| `DELIVERY_FAILED → RIDER_ASSIGNED` | COORDINATOR, ADMIN | 2.º intento: exige `attempt_no < 2` y autorización. |
| `DELIVERY_FAILED → RETURN_PENDING` | RIDER, COORDINATOR | |
| `DELIVERY_FAILED → PENDING_RESOLUTION` | sistema | Cuando `attempt_no = 2`. |
| `RETURN_PENDING → RETURNED_TO_RESTAURANT` | BRANCH_MANAGER, COORDINATOR, ADMIN | Confirmación física. |
| `RETURNED_TO_RESTAURANT → PENDING_RESOLUTION` | COORDINATOR, ADMIN | |
| `PENDING_RESOLUTION → CANCELLED` | COORDINATOR, ADMIN | `resolution` obligatorio. |
| `PENDING_RESOLUTION → RIDER_ASSIGNED` | COORDINATOR, ADMIN | Solo si `attempt_no < 2`. |
| `{NEW..READY, RIDER_ASSIGNED, RIDER_AT_PICKUP} → CANCELLATION_REQUESTED` | SUPPORT_AGENT, COORDINATOR, ADMIN | Motivo. Guarda el estado previo. |
| `CANCELLATION_REQUESTED → CANCELLED` | COORDINATOR, ADMIN | Autorización. |
| `CANCELLATION_REQUESTED → <estado previo>` | COORDINATOR, ADMIN | Si se deniega. |
| Cualquier estado → cualquiera (corrección de error) | ADMIN | Motivo obligatorio y auditoría reforzada. |

**Implementación obligatoria:**

- Cada transición corre en **una transacción** con `SELECT … FOR UPDATE` sobre el pedido y **bloqueo optimista** (`orders.version`).
- Una transición repetida (misma de→a) es **idempotente** (no duplica historial ni efectos) o devuelve `409` claro.
- Cada transición escribe en `order_status_history` (de, a, actor, fecha/hora, motivo) **y** en `audit_logs`, y encola eventos en `outbox_events`.
- El Kanban solo muestra y permite las columnas/acciones que el rol puede ejecutar.

---

## 9. Modelo de datos (PostgreSQL)

**Convenciones:**

- PK `uuid` (v7 si es posible). Todas las tablas de negocio: `tenant_id`, `created_at`, `updated_at` (`timestamptz`, UTC).
- Dinero: `bigint` en **céntimos** + `currency char(3) default 'PEN'`. Nunca `float`.
- Borrado lógico/archivado (`archived_at`) para catálogo. **Nunca** borrar físicamente productos con historial.
- Enums como `text` con `CHECK` (más fáciles de migrar) o `pg enum`.
- Índices en `(tenant_id, …)` en todo lo consultado por alcance. Índices por `status`, `branch_id`, `created_at` en `orders`.
- **Solo-inserción** (trigger `BEFORE UPDATE OR DELETE → RAISE EXCEPTION` y `REVOKE UPDATE, DELETE` al rol de la app): `audit_logs`, `order_status_history`, `payment_events`, `wallet_entries`, `inbound_events` (solo `status` actualizable en esta última; documenta la excepción).
- Aislamiento: todo acceso a datos pasa por repositorios que **exigen** `tenantId`. (Endurecimiento posterior: RLS de PostgreSQL.)

**Tablas (columnas clave; completa lo evidente):**

*Identidad y estructura*

- `tenants(id, name, slug, status)`
- `users(id, tenant_id, username UNIQUE per tenant, password_hash, display_name, role, is_active, last_login_at)`
- `sessions(id, user_id, expires_at, ip, user_agent)`
- `user_branch_access(user_id, branch_id)`
- `restaurants(id, tenant_id, name, legal_name?, is_active)`
- `branches(id, tenant_id, restaurant_id, name, slug, address, lat?, lng?, phone, is_open_manual bool, is_active)`
- `branch_schedules(id, branch_id, day_of_week 0-6, opens_at, closes_at, shift_no)`
- `delivery_zones(id, tenant_id, branch_id, name, fee_cents, min_order_cents, radius_km?, is_active)`

*Catálogo*

- `categories(id, tenant_id, restaurant_id, name, sort)`
- `products(id, tenant_id, restaurant_id, category_id, name, description, image_asset_id?, is_fragile bool, margin_type, margin_value, packaging_cents, base_price_cents, is_active, archived_at)`
- `modifier_groups(id, tenant_id, name, min_select, max_select)`, `modifier_options(id, group_id, name, price_delta_cents, is_active)`, `product_modifier_groups(product_id, group_id)`
- `menus(id, tenant_id, branch_id, name, is_default, includes_delivery_in_price, includes_tax_in_price, is_active, schedule jsonb?)`
- `menu_items(id, menu_id, product_id, price_cents, is_available)` *(disponibilidad y precio por sucursal/carta)*
- `assets(id, tenant_id, storage_key, mime, size, uploaded_by)`

*Clientes*

- `customers(id, tenant_id, name, phone_e164 UNIQUE per tenant, email?, segment, risk_flag, risk_reason?, notes?)`
- `customer_addresses(id, customer_id, label, address_text, reference?, lat?, lng?, zone_id?)`

*Pedidos*

- `orders(id, tenant_id, number (secuencial legible por tenant), branch_id, customer_id, address_snapshot jsonb, channel (MANUAL|WEB|WHATSAPP|CRM), operational_status, payment_status, payment_method, restaurant_payout_status, handoff_at?, handoff_by?, released_at?, released_by?, rider_id?, delivery_zone_id?, items_subtotal_cents, discount_cents, delivery_fee_cents, tax_cents, total_cents, cash_to_collect_cents, invoice_requested, public_token, idempotency_key UNIQUE, requested_cancellation_prev_status?, resolution?, notes, version, created_by)`
- `order_items(id, order_id, product_id, name_snapshot, qty, base_price_cents, packaging_cents, margin_cents, unit_price_cents, line_total_cents, status (ACTIVE|UNAVAILABLE|REPLACED|CANCELLED), replacement_of?, customer_decision?)`
- `order_item_modifiers(id, order_item_id, name_snapshot, price_delta_cents)`
- `order_status_history(id, order_id, from_status, to_status, actor_id, reason?, created_at)`
- `order_notes(id, order_id, author_id, body, kind)`
- `order_incidents(id, order_id, type, description, evidence_asset_ids[], reviewer_id, decision?, amount_cents?, justification?, status)`
- `delivery_attempts(id, order_id, attempt_no, rider_id, outcome, failure_reason?, notes?, evidence_asset_id?, cash_collected_cents?, started_at, ended_at)`

*Pagos*

- `payments(id, order_id, method, amount_cents, status, proof_asset_id?, reference?, validated_by?, validated_at?)`
- `payment_events(id, payment_id, type (CREATED|VALIDATED|REJECTED|CORRECTED|REFUNDED), before jsonb?, after jsonb?, reason?, actor_id, created_at)`
- `restaurant_payouts(id, order_id, amount_cents, status, confirmed_by?, confirmed_at?, method?, reference?)`
- `refunds(id, order_id, payment_id, amount_cents, reason, authorized_by, confirmed_at?, method?)`

*Repartidores y billetera*

- `riders(id, tenant_id, user_id, full_name, phone, birth_date, fleet_type (OWN|AGENCY|THIRD_PARTY), agency_name?, vehicle_type (MOTO|CAR), status, high_trust bool, trust_score numeric?, is_active)`
- `rider_location_pings(id, rider_id, lat, lng, accuracy?, order_id?, created_at)`
- `wallet_entries(id, tenant_id, rider_id, type, amount_cents (con signo), order_id?, advance_id?, settlement_id?, reason?, actor_id, created_at)` — **solo-inserción**
  Tipos: `GUARANTEE_DEPOSIT(+)`, `GUARANTEE_WITHDRAWAL(−)`, `CASH_COLLECTED(−)`, `CASH_SETTLED(+)`, `ADJUSTMENT(±, con motivo)`.
- `rider_advances(id, rider_id, amount_cents, purpose, authorized_by, status (PENDING_DEDUCTION|DEDUCTED), deducted_in_settlement_id?)`
- `settlements(id, tenant_id, rider_id, business_date, cutoff_at, cash_collected_cents, cash_received_cents, advances_deducted_cents, rider_fee_reference_cents, rider_fee_payable_cents, net_cents, status (DRAFT|CONFIRMED), confirmed_by?, confirmed_at?)`

*Transversales*

- `ratings(id, order_id, subject_type (RESTAURANT|RIDER|CUSTOMER), subject_id, rater_type, stars 1-5, comment?)` *(estructura; uso mínimo en MVP)*
- `alerts(id, tenant_id, type, severity, order_id?, rider_id?, branch_id?, payload jsonb, dedupe_key UNIQUE, status (OPEN|ACK|RESOLVED), created_at)`
- `settings(id, tenant_id, key, value jsonb, updated_by, updated_at)` + historial de cambios en `audit_logs`
- `audit_logs(id, tenant_id, actor_id, actor_role, action, object_type, object_id, before jsonb?, after jsonb?, request_id, ip, created_at)` — **solo-inserción**
- `outbox_events(id, tenant_id, type, payload jsonb, status, attempts, next_attempt_at, created_at)`
- `inbound_events(id, provider, external_event_id, payload jsonb, status, received_at, UNIQUE(provider, external_event_id))`
- `funnel_events(id, tenant_id, branch_id, session_id, step (IMPRESSION|MENU_VIEW|ADD_TO_CART|PURCHASE), created_at)` *(SHOULD)*
- Vacías pero creadas: `promotions`, `promotion_rules`, `push_subscriptions`.

---

## 10. Garantía, adelantos y liquidación (libro mayor)

**Modelo conceptual:** la garantía del repartidor es un saldo respaldo. Cuando cobra efectivo, ese importe **reduce** su garantía disponible hasta que lo entrega en la liquidación.

- `guarantee_balance(rider) = SUM(wallet_entries.amount_cents)` — calculado o materializado, **siempre derivable del ledger**.
- **Cobrar efectivo** (al marcar `DELIVERED`): asiento `CASH_COLLECTED` negativo por `cash_collected_cents`. Validar que el importe coincide con `cash_to_collect_cents` (si difiere, exigir motivo y crear `order_incident`).
- **Liquidación diaria** (`settlements`): el Coordinador registra el efectivo **realmente recibido** (`cash_received_cents`) → asiento `CASH_SETTLED` positivo por ese importe. Si recibió menos de lo cobrado, la diferencia **permanece** como garantía reducida/deuda (nunca se "perdona" automáticamente).
- **Deuda:** `guarantee_balance < 0` ⇒ bloqueo de nuevos pedidos en efectivo hasta regularizar. Mostrar importe y motivo. La regularización queda registrada (depósito o ajuste).
- **Adelantos** (combustible): los crea un humano autorizado (Coordinador, o Empleado con permiso). No se pagan desde el sistema. Quedan `PENDING_DEDUCTION` y se **descuentan en la siguiente liquidación diaria** (`advances_deducted_cents`).
- **Corte:** `settlement.cutoff_time = "23:00"` (`America/Lima`, configurable). Un job programado genera los borradores (`DRAFT`) por repartidor y día; un humano los confirma.
- **Pago al repartidor:** la fórmula **no está definida** (DECISION-03). MVP: `rider_fee_reference_cents` = suma informativa de tarifas de entrega de los pedidos entregados; `rider_fee_payable_cents` es **editable por el Coordinador con motivo**. `net_cents = rider_fee_payable − advances_deducted − (cash_collected − cash_received)`.
- Concurrencia: serializar escrituras por repartidor con `SELECT … FOR UPDATE` sobre la fila `riders`.
- Invariantes a testear: el saldo nunca se edita directamente; ningún `UPDATE/DELETE` sobre `wallet_entries`; una liquidación confirmada no puede reconfirmarse; adelanto no se descuenta dos veces.

---

## 11. API y módulos de aplicación

- Mutaciones de UI: Server Actions **o** Route Handlers `/api/v1/*`, ambos solo llaman a servicios de aplicación. Valida con Zod en el borde.
- `/api/v1` debe ser coherente y versionada (la usará una futura app nativa): recursos REST (`/orders`, `/orders/:id/transitions`, `/riders`, `/payments`, `/settlements`, …), paginación por cursor, errores con formato uniforme (`{ code, message, details?, requestId }`).
- Creación de pedidos exige cabecera/campo `Idempotency-Key`.
- "Tiempo real" del MVP: **polling** (5–10 s) con ETag/`If-None-Match` o `updated_since`, encapsulado en un hook `useLiveOrders`. Deja la interfaz lista para cambiar a SSE/WebSocket/`LISTEN/NOTIFY` sin tocar los componentes.
- Rate limiting en login y endpoints públicos (en memoria en el MVP; interfaz para Redis después).

---

## 12. Integraciones y notificaciones (puertos)

```ts
interface NotificationPort {           // WhatsApp, in-app, SMS, push…
  send(msg: OutboundMessage): Promise<SendResult>;
}
interface CrmPort {                    // Vocero CRM u otro
  upsertCustomer(c: CrmCustomer): Promise<void>;
  pushOrder(o: CrmOrder): Promise<void>;
  pushOrderStatus(orderId: string, status: string): Promise<void>;
}
interface StoragePort { put(...): Promise<AssetRef>; getUrl(...): Promise<string>; }
interface Exporter { readonly format: 'csv'|'xlsx'|'pdf'; export(ds: TabularDataset): ReadableStream | Buffer; }
interface AssignmentStrategy { propose(order: Order, candidates: Rider[]): Rider[]; }
interface PricingPolicy { price(item: ItemInput, ctx: PricingCtx): PricedItem; }
interface DeliveryFeePolicy { fee(order: OrderDraft, zone: DeliveryZone): number; }
```

- **Outbox:** al cambiar el estado de un pedido se inserta un evento en `outbox_events` en la misma transacción. Un worker (pg-boss) los consume, llama al adaptador y reintenta con *backoff*. Los reintentos **no** pueden duplicar efectos (clave de deduplicación por evento).
- **Webhooks entrantes:** `POST /api/webhooks/[provider]` verifica firma HMAC (secreto por proveedor en variable de entorno), inserta en `inbound_events` con `UNIQUE(provider, external_event_id)` (duplicado ⇒ responde 200 sin reprocesar), y procesa de forma asíncrona. **Detrás de feature flag, apagado**, hasta verificar la documentación real de Vocero CRM (endpoints, auth, eventos, límites) — **no asumas** ninguna función de su API.
- **Fallos de integración:** registrar error, crear alerta, reintentar, permitir revisar eventos no procesados. Las operaciones internas siguen funcionando.
- Mensajes operativos previstos (plantillas por evento): confirmación, cambio de estado, pago pendiente/validado, listo, repartidor asignado, retraso, cancelación, entrega fallida, resolución/devolución. En el MVP los entrega `InAppNotifier`; `ConsoleNotifier` en dev.
- **Acciones sensibles del bot** (asignar, cancelar, validar pagos) siempre requieren autorización humana: modélalo como "propuestas" que un humano aprueba.

---

## 13. Reportes, dashboard y exportación

- Cada reporte es un servicio que devuelve un `TabularDataset { columns, rows, meta }` **ya filtrado por el alcance del actor**. Los exportadores solo formatean ese dataset; así los permisos de exportación = permisos de lectura (CA-14).
- Dashboard (según rol): pedidos del día, ventas del día, en preparación, en camino, entregados, cancelados, entregas fallidas, demorados, tiempo promedio de preparación, clientes nuevos/recurrentes, alertas. Filtro de periodo: **Hoy, Ayer, Últimos 7 días, Últimos 30 días, Personalizado** (en `America/Lima`; cuidado con los límites de día).
- **MVP:** RF-15 ventas (por día/semana/mes, por producto/categoría, ticket promedio, ranking), RF-16 operativos (tiempos de preparación y entrega, % éxito vs fallidas, demorados, motivos de cancelación), RF-17 clientes (nuevos vs recurrentes, frecuencia, ticket por usuario, ranking Top). RF-18 embudo: solo captura.
- Calificación promedio y panel personal del repartidor (entregas exitosas/fallidas, estrellas, saldo de garantía).
- **CSV:** *streaming*, UTF-8 **con BOM**, separador coma, importes con 2 decimales, fechas `dd/MM/yyyy HH:mm` en `America/Lima`.
- Consultas pesadas: usa agregaciones SQL (no cargar todo en memoria). Prevé vistas materializadas o tablas resumen cuando haga falta (ver sección 19).

---

## 14. PWA y UX

- Manifest completo (nombre, íconos 192/512 y *maskable*, `display: standalone`, `lang: es-PE`, `theme_color`). Service worker con Serwist.
- **Offline en el MVP:** *app shell* + últimas lecturas cacheadas. **Las escrituras requieren conexión**: muestra un aviso claro; **no** implementes cola offline de mutaciones.
- No asumas GPS en segundo plano ni notificaciones push garantizadas en todos los navegadores.
- **Vistas por rol:**
  - *Repartidor* (móvil, botones grandes, una acción principal por pantalla): mis pedidos → detalle (dirección, productos, frágil, **cobro: efectivo S/ X o "ya pagado"**) → botones de estado → registrar cobro/fallo → compartir ubicación → mi saldo y métricas.
  - *Encargado* (móvil/tablet): lista de pedidos nuevos con **sonido** y aceptar/rechazar, preparar, listo, registrar handoff, marcar producto no disponible.
  - *Coordinador/Empleado/Admin* (escritorio primero, responsive): Kanban, mapa-lista de repartidores (lista con último ping), validación de pagos, asignación, alertas, finanzas.
- Formato `es-PE`: `S/ 1,234.50`, fechas `dd/MM/yyyy`, hora de 24 h. Validar celular peruano (9 dígitos, inicia en 9), DNI (8 dígitos), RUC (11 dígitos).
- Accesibilidad: contraste suficiente, foco visible, etiquetas en formularios, tamaños táctiles ≥ 44 px, estados siempre con texto además de color.
- Todos los textos en un diccionario i18n (`es-PE`), no *hardcodeados* en componentes.

---

## 15. Seguridad, privacidad y auditoría

- Contraseñas con **argon2id**; política mínima (longitud ≥ 10) y bloqueo/ralentización por intentos fallidos; cierre de sesión e invalidación server-side.
- Cookies `httpOnly`, `Secure`, `SameSite=Lax`; verificación de `Origin` en mutaciones; cabeceras de seguridad (CSP, `X-Content-Type-Options`, `Referrer-Policy`).
- **Ninguna credencial en el código.** `.env.example` documentado; secretos por variables de entorno; validar el entorno al arrancar con Zod.
- Autorización en cada servicio (`can(...)`), **filtrado por `tenant_id` y alcance** en cada consulta. Tests que intenten saltarse permisos llamando directo a la API (CA-01).
- Subida de archivos: validar tipo/tamaño, nombres generados, nunca servir desde una ruta controlada por el usuario.
- Datos personales: minimización; logs **sin** teléfonos/direcciones; el repartidor solo ve lo necesario y solo de sus pedidos.
- **Auditar** (actor, rol, fecha/hora, acción, objeto, antes/después): inicios de sesión y eventos de seguridad, cambios de permisos/roles, productos, precios y tarifas, pagos y correcciones, liberaciones, asignaciones/reasignaciones, cambios de estado, liquidaciones, garantías y adelantos, cancelaciones y devoluciones, cambios de configuración.
- Errores: manejo seguro (sin *stack traces* al cliente), `requestId` en la respuesta.
- Backups: `scripts/backup.sh` (`pg_dump`, cifrado, rotación) y `scripts/restore.sh`; runbook en `docs/runbooks/backup-restore.md`. **Prueba la restauración** en el hito 4.

---

## 16. Parámetros configurables y decisiones pendientes

Implementa un servicio `settings` tipado (clave, tipo, default, validación, alcance tenant) y una pantalla de Admin para editarlos (con auditoría). **Los valores `PLACEHOLDER` no están aprobados.**

| Clave | Default | Estado |
|---|---|---|
| `order.acceptance_timeout_minutes` | 5 | PLACEHOLDER (DECISION-05) |
| `order.prep_delay_threshold_minutes` | 30 | PLACEHOLDER (DECISION-05) |
| `order.no_rider_threshold_minutes` | 10 | PLACEHOLDER (DECISION-05) |
| `rider.pickup_wait_minutes` | 15 | **Aprobado** (acción posterior pendiente: DECISION-07) |
| `rider.min_age_for_cash_without_guarantee` | 35 | Del doc original; confirmar (DECISION-02) |
| `rider.allow_multiple_orders` | false | PLACEHOLDER |
| `guarantee.min_cents` | 0 | PLACEHOLDER (DECISION-02) |
| `delivery.max_attempts` | 2 | **Aprobado** |
| `settlement.cutoff_time` | "23:00" | Del doc original; confirmar procedimiento |
| `customer.top_min_orders` | 10 | PLACEHOLDER |
| `reports.branch_manager_can_view_sales` | false | PENDIENTE (DECISION-04) |
| `reports.coordinator_can_view_funnel` | false | PENDIENTE (DECISION-04) |
| `support.can_assign_rider` | true | Aprobado (con permisos) |
| `support.can_create_advance` | false | PENDIENTE |
| `feature.integration.vocero` / `feature.integration.whatsapp` | false | Apagado hasta validar API |

**Decisiones pendientes que NO debes resolver tú** (impleméntalas aislado y configurable):

- **DECISION-01** Fórmula del margen (base del %, tratamiento de descuentos, modificadores, envases, impuestos, excepciones).
- **DECISION-02** Monto mínimo de garantía, edad mínima, nivel de confianza, fórmula/pesos del puntaje de confianza.
- **DECISION-03** Fórmula de pago al repartidor; procedimiento de conciliación del efectivo.
- **DECISION-04** Acceso del Encargado a ventas de su sucursal; acceso del Coordinador al embudo.
- **DECISION-05** Tiempos de aceptación y umbrales de retraso/alerta.
- **DECISION-06** Catálogo final de estados y transiciones por rol (la tabla de la sección 8 es **propuesta**).
- **DECISION-07** Acción posterior a los 15 min de espera; condiciones de rechazo definitivo y cierre.
- **DECISION-08** Definición o retiro del RF-22 (no inventar su contenido).
- **DECISION-09** Documentación real de Vocero CRM y capacidades de WhatsApp.
- **DECISION-10** Objetivos medibles (rendimiento, disponibilidad, RPO/RTO, retención de datos).

**Objetivos de ingeniería provisionales** (propuestos, no aprobados; úsalos para no diseñar a ciegas): carga del Kanban < 1 s (p95) con 500 pedidos activos; transición de estado < 500 ms (p95); sin pérdida de datos confirmados.

---

## 17. Plan de hitos

> Cada hito termina con: tests en verde, migraciones desde cero, `seed` actualizado, `docs/CHANGELOG.md` y checklist de criterios de salida.

### Hito 0 — Fundación
Repo, TypeScript estricto, ESLint/Prettier, reglas de dependencias, Vitest y Playwright, `docker compose` con Postgres, CI, Drizzle + migraciones, utilidades (`money`, `time` con `America/Lima`, `phone` E.164, `errors`, `result`, logger), PWA *shell* (manifest + service worker), i18n `es-PE`, servicio `settings`, servicio `audit` + trigger *append-only*, **auth** (login/logout/sesiones/rate limit), **motor de permisos `can()`** con test table-driven, layout por rol, script de seed.
**Salida:** inicio de sesión por rol muestra navegación distinta; test de matriz de permisos verde; login genera auditoría; la app es instalable.

### Hito 1 — Estructura y catálogo
Administración de usuarios y roles (Admin), restaurantes, sucursales, horarios, activar/desactivar sucursal, zonas de reparto simples, categorías, productos (frágil, archivado), modificadores, cartas con precio, disponibilidad por sucursal, subida de imágenes (`StoragePort` local), alcance de sucursales por usuario.
**Salida:** el Admin crea restaurante → sucursal → carta; el Encargado gestiona solo su sucursal; un producto con pedidos no puede borrarse (solo archivarse); un usuario sin permiso recibe 403 al llamar la API directamente.

### Hito 2 — Pedidos (núcleo operativo)
Clientes (dedupe por teléfono), direcciones, **creación manual de pedidos** con `PricingPolicy` provisional + snapshots + idempotencia, DTOs staff/cliente, **motor de la máquina de estados** con tabla de transiciones, Kanban filtrado por rol (polling), aceptar/rechazar con alerta por timeout, preparación/listo, productos faltantes con decisión del cliente, solicitud/autorización de cancelación, cambio de dirección, historial/notas, búsqueda y filtros (pedido, cliente, sucursal, estado, método de pago, repartidor, fecha), alertas de pedido nuevo con sonido.
**Salida:** CA-01, CA-02, CA-05 verdes; flujo `NEW → READY` completo entre Encargado y Coordinador; el DTO público no filtra campos internos.

### Hito 3 — Pagos, logística y finanzas del repartidor
Pagos (efectivo/Yape/transferencia), comprobantes, validación humana, **pago al restaurante**, **regla de liberación** (`evaluateReleaseGate`), correcciones y reembolsos con auditoría, perfiles de repartidor, **elegibilidad** y asignación manual, **vista móvil del repartidor**, estados de entrega, ubicación compartida manualmente, cobro en efectivo → **ledger**, entrega fallida (2 intentos) y devolución, adelantos, **liquidación diaria** con corte y job de borradores, incidencias económicas, bloqueo por garantía/deuda.
**Salida:** CA-03, CA-04, CA-06 a CA-11 verdes; intentos de saltarse la guarda de liberación fallan; invariantes del ledger probadas (incluida concurrencia).

### Hito 4 — Dashboard, reportes, alertas y endurecimiento
Dashboard por rol y periodos, reportes RF-15/16/17, **exportación CSV**, centro de alertas con *dedupe*, visor de auditoría (Admin), panel personal del repartidor, (SHOULD) menú público + compra invitado + página de estado + captura de embudo, backups y **prueba de restauración**, revisión de seguridad (checklist sección 15), datos de carga para validar los objetivos provisionales, e2e del camino feliz, documentación (`README`, runbooks).
**Salida:** CA-12, CA-14, CA-15 verdes; el e2e "pedido completo del día" pasa en CI; todo lo MUST implementado.

### Después del MVP (en este orden sugerido)
- **R1 Integraciones:** validar documentación real de Vocero CRM → adaptador `CrmPort`; adaptador de WhatsApp en `NotificationPort`; chatbot (menú, estado, pedido) con acciones sensibles por aprobación humana; encender feature flags.
- **R2 Reportería:** exportadores Excel y PDF; embudo de conversión; ventas financieras (cuando se apruebe el margen).
- **R3 Marketing y confianza:** promociones/cupones/combos (por sucursal); calificaciones completas; `TrustScorer`.
- **R4 Logística avanzada:** `AutoAssignStrategy`, tarifas por distancia/vehículo, geocodificación, mapa, GPS opcional, push web.
- **R5 Escala:** ver sección 19.

---

## 18. Pruebas y criterios de aceptación

**Pirámide de pruebas:**

- **Unit (dominio puro):** máquina de estados (cada transición permitida y cada prohibida), `evaluateReleaseGate`, `canAssignRider`, `PricingPolicy`, utilidades de dinero/teléfono/fechas, invariantes del ledger.
- **Matriz de permisos:** test generado *rol × acción* contra la tabla de la sección 6.
- **Integración (Postgres real):** servicios con transacciones y bloqueos; triggers *append-only* (intentar `UPDATE/DELETE` debe fallar); idempotencia de pedidos y webhooks; aislamiento por `tenant_id`; concurrencia (dos transiciones simultáneas, dos cobros simultáneos al mismo repartidor).
- **E2E (Playwright):** camino feliz de un pedido en efectivo y otro con Yape; entrega fallida con segundo intento; bloqueo por garantía insuficiente.

**Criterios de aceptación (de la especificación original) y dónde se cierran:**

| ID | Criterio | Hito |
|---|---|---|
| CA-01 | Un usuario no autorizado no puede ejecutar acciones restringidas ni modificando la UI ni llamando al servidor directamente. | 0–4 |
| CA-02 | Encargado y Coordinador aceptan/rechazan; sin respuesta ⇒ alerta al Coordinador, sin cancelación automática. | 2 |
| CA-03 | Pago anticipado pendiente no impide preparar, pero sí despachar. | 3 |
| CA-04 | El sistema impide el despacho si no se cumplen pago y asignación aplicables. | 3 |
| CA-05 | Producto faltante: se registra, se informa a cliente y Coordinador, se conserva la decisión del cliente. | 2 |
| CA-06 | Asignación (manual) respeta disponibilidad, permisos y garantía. | 3 |
| CA-07 | Entrega fallida registra motivo, fecha, intento y evidencia; 2.º intento exige Coordinador. | 3 |
| CA-08 | Encargado confirma recepción física; Coordinador decide reintento o cierre. | 3 |
| CA-09 | Garantía insuficiente bloquea nuevos pedidos en efectivo. | 3 |
| CA-10 | Adelanto: autorización humana, registrado, descontado en la siguiente liquidación diaria. | 3 |
| CA-11 | Toda corrección de pago registra motivo, actor, valor anterior y nuevo. | 3 |
| CA-12 | Cada rol consulta solo los datos personales necesarios. | 2–4 |
| CA-13 | Eventos duplicados no generan pedidos/pagos duplicados; fallos quedan registrados y alertan. | 0 (infra) · R1 (real) |
| CA-14 | CSV (y luego Excel/PDF) respetan los permisos de lectura. | 4 |
| CA-15 | Las copias se generan y pueden restaurarse. | 4 |

**Definición de "hecho" para cualquier funcionalidad:** lógica en servicio (no en la UI) · autorización con `can()` · validación Zod · auditoría si es sensible · test de dominio + test de permisos · textos en `es-PE` · sin datos personales en logs · documentada si introduce un supuesto.

---

## 19. Ruta de escalado (para no reescribir después)

| Cuando… | Haz esto |
|---|---|
| Más de un restaurante/agencia real | Activar alta de `tenants` (ya existe `tenant_id`); añadir RLS de PostgreSQL como segunda barrera. |
| El polling pesa o se necesita inmediatez | Cambiar `useLiveOrders` a SSE/WebSocket alimentado por `LISTEN/NOTIFY` o un bus; la API no cambia. |
| El worker compite con la web | Desplegar `src/worker` como proceso separado (misma base de código). |
| Reportes lentos | Tablas resumen / vistas materializadas refrescadas por job; réplica de lectura para reportes. |
| Tablas enormes (`audit_logs`, `order_status_history`, `wallet_entries`) | Particionado por mes; archivado en frío. |
| Límites de tasa/sesiones distribuidos | Introducir Redis detrás de las interfaces de rate-limit y caché. |
| Más integraciones | Un adaptador nuevo por puerto; considerar un bus (p. ej. NATS/SQS) detrás del *outbox*. |
| Repartidores necesitan app nativa/GPS continuo | App React Native/Flutter consumiendo `/api/v1`; activar `rider_location_pings` continuo. |
| Observabilidad | Sentry + OpenTelemetry (trazas con `requestId`), métricas de colas y de transiciones. |
| Despliegue serio | Contenedores, migraciones automáticas en CI/CD, entornos *staging*/*prod*, secretos gestionados. |

---

## 20. Prohibiciones y fuera de alcance

- No implementes una fórmula financiera "definitiva" (margen, pago a repartidores, impuestos).
- No cargues pérdidas automáticamente a nadie.
- No borres definitivamente auditorías, pagos, asientos de billetera ni productos con historial.
- No uses `float` para dinero; no uses `Date` local — todo en UTC y convierte a `America/Lima` en la presentación.
- No muestres al cliente el desglose interno, el margen ni la ubicación GPS del repartidor.
- No hagas búsquedas ni recopilación de datos personales externos de clientes.
- No supongas capacidades de la API de Vocero CRM ni de WhatsApp.
- No agregues dependencias pesadas (navegadores headless, brokers, Redis) en el MVP sin un ADR que lo justifique.
- No marques una contradicción del spec original como resuelta por tu cuenta: regístrala en `docs/ASSUMPTIONS.md`.

---

## 21. Primer mensaje para el agente (kickoff)

> Lee `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md` completo. Empieza por el **Hito 0**. Antes de escribir código: (1) propón en `docs/adr/0001-stack.md` las versiones exactas del stack y cualquier desviación respecto a la sección 3; (2) crea `docs/ASSUMPTIONS.md`; (3) genera la estructura de carpetas de la sección 4 con las reglas de dependencia como lint. Luego implementa el Hito 0 y detente al cumplir sus criterios de salida, mostrando: salida de `lint`, `typecheck`, tests y un resumen de lo construido y de los supuestos tomados tambien ten en cuenta que esto es importante :Arquitectura y Stack Tecnológico Elegido

Frontend (BFF): Next.js (App Router) con TypeScript para la interfaz, utilizando Zustand para el estado global, TanStack Query para el manejo de caché/peticiones asíncronas y Tailwind CSS.

Backend: NestJS con TypeScript, funcionando bajo una arquitectura de microservicios orientada a eventos.

Bases de Datos: PostgreSQL (con extensión PostGIS para geolocalización) para usuarios y transacciones financieras; MongoDB para los catálogos/menús; Redis para caché y sincronización de WebSockets (Pub/Sub).

Estructura de Código: Monorepositorio (Monorepo) usando Turborepo o Pnpm Workspaces, permitiendo compartir tipos (Type Safety E2E), esquemas de validación (Zod) e interfaces entre el frontend y el backend en la carpeta packages/shared-types.

Despliegue (MVP): Un único servidor VPS orquestado con Docker Compose (contenedores independientes para cada servicio) y un proxy inverso (Nginx o Traefik), descartando Kubernetes inicialmente por su alto consumo de recursos.

Diseño de la Base de Datos (Lógica Financiera)

Uso estricto de enteros (Céntimos): El dinero se almacena en PostgreSQL usando tipos INT o BIGINT (ej. S/ 150.75 se guarda como 15075). La división entre 100 se realiza única y exclusivamente en el frontend para renderizar la vista, evitando motores de coma flotante o tipos DECIMAL.

Modelo de Partida Doble (Ledger): Para billeteras virtuales y créditos, se utilizan dos tablas. billeteras actúa como caché visual del saldo actual, mientras que transacciones actúa como un libro mayor inmutable que registra ingresos (positivos) y egresos (negativos). El saldo total debe ser siempre la suma exacta del historial.

Retiros (Cashout) Manuales: Se separan en dos fases. Al solicitar el retiro, la base de datos resta los céntimos inmediatamente y crea un registro "Pendiente". El operador humano realiza la transferencia bancaria real y cambia el estado a "Completado" en el panel CRUD, o a "Rechazado" (devolviendo los fondos mediante una nueva transacción compensatoria).

Problemas Transaccionales Abordados y Soluciones

Prevención de cobros duplicados (Nivel Servidor): Implementación de Llaves de Idempotencia (UUID v4) generadas por el frontend. Si la red falla y reintenta, el backend reconoce el UUID y no procesa el pago dos veces.

Condiciones de Carrera (Nivel Base de Datos): Uso de transacciones ACID y bloqueos pesimistas (SELECT ... FOR UPDATE). Si dos peticiones de pago entran al mismo milisegundo, la base de datos bloquea la fila hasta que la primera termine, abortando la segunda automáticamente.

Prevención de múltiples clics (Nivel Frontend): Uso de desactivación visual de botones (estado disabled/loading), Debouncing (agrupación de clics rápidos) y Throttling (bloqueo por intervalo de tiempo) para evitar peticiones repetidas accidentales a la API.

Fallas de Red o Pasarelas: Uso del Patrón Saga para orquestar transacciones distribuidas, asegurando que si un pago falla, se emita un evento automático para revertir cualquier cambio previo en la orden..

