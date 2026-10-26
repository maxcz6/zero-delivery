# Zero Delivery — Especificación de construcción del MVP (para agente de codificación)

**Versión:** 1.0-mvp
**Origen:** Derivado de *"Zero Delivery — Especificación integral v1.1"* (borrador consolidado).
**Idioma de la UI:** Español (Perú, `es-PE`) · **Moneda:** Soles (S/) · **Zona horaria:** `America/Lima`
**Idioma de persistencia:** español en tablas, columnas y valores de dominio del SQL, con identificadores `snake_case` ASCII. Los contratos REST/TypeScript pueden usar nombres lógicos en inglés si los mapean explícitamente. Los textos visibles al usuario van en español.

---

## 0. Cómo debes trabajar (léelo primero)

Eres el agente que construye Zero Delivery. Este documento es la fuente de verdad de requisitos funcionales; el DDL [`0001_esquema_zero_delivery_es.sql`](../0001_esquema_zero_delivery_es.sql) es la fuente de verdad de nombres y restricciones físicas de PostgreSQL. Si existe el documento original (`docs/zero-delivery-spec-v1.1.md`) y contradice a este, este prevalece para el comportamiento funcional.

**Reglas de trabajo:**

1. Trabaja **por hitos** (sección 17), en orden. No empieces un hito sin cumplir los criterios de salida del anterior.
2. Al cerrar cada hito: `lint` + `typecheck` + tests en verde, migraciones aplicadas desde cero, `seed` funcionando, y un resumen breve en `docs/CHANGELOG.md`.
3. **No inventes reglas de negocio.** Todo lo marcado `PENDIENTE` (sección 16) se implementa como **parámetro configurable** con un valor por defecto marcado `PLACEHOLDER` y un comentario `// TODO(DECISION-XX)`. Nunca lo dejes escrito como constante en el código.
4. Cuando tengas que asumir algo no cubierto aquí, regístralo en `docs/ASSUMPTIONS.md` (fecha, supuesto, motivo) y continúa. No te detengas a preguntar salvo que el supuesto sea irreversible (p. ej. borrar datos financieros).
5. **Autorización siempre en el servidor.** Ocultar botones no es seguridad.
6. **No construyas nada del apartado "Fuera del MVP"** (sección 5), pero sí deja los **puntos de extensión** indicados (interfaces, tablas, colas) para que agregarlo después no requiera reescribir.
7. La estructura actual es un monorepo `pnpm` con Next.js en `apps/web` y NestJS en `apps/api`. Mantén una API NestJS modular para el MVP; no declares microservicios independientes hasta que existan aplicaciones/procesos separados y contratos de eventos implementados.
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
| **Monorepo por capas** | `apps/web` (Next.js) presenta la interfaz y puede actuar como BFF; `apps/api` (NestJS) concentra la API y las reglas de negocio; `packages/*` comparte tipos, configuración y acceso a datos. |
| **API modular** | NestJS se organiza por módulos de negocio con dominio, aplicación e infraestructura. RabbitMQ está provisionado para mensajería, pero no convierte por sí solo la API actual en microservicios. |
| **Multi-tenant desde el día 1** | Las entidades principales del SQL llevan `inquilino_id`; las tablas relacionales obtienen el alcance por sus claves foráneas. Toda consulta debe filtrar por el inquilino autenticado. |
| **Lógica fuera de la UI** | Next.js solo prepara/presenta datos y llama a NestJS. NestJS valida, autoriza y ejecuta servicios de aplicación; los workers/event consumers deben reutilizar esos servicios. |
| **Puertos y adaptadores** | Todo lo externo (WhatsApp, Vocero CRM, almacenamiento, exportadores, notificaciones, pricing) está detrás de una interfaz. El MVP trae adaptadores simples o *stubs*. |
| **Estado explícito** | Los pedidos se rigen por una **máquina de estados** con tabla de transiciones, roles y guardas. Estado operativo y estado de pago son **independientes**. |
| **Dinero = libro mayor inmutable** | Importes en **céntimos enteros**. Garantías, cobros y liquidaciones se modelan como **asientos de solo-inserción** (*append-only ledger*). Nunca se edita ni borra un asiento: se corrige con otro asiento. |
| **Auditoría inmutable** | `registro_auditoria` solo permite `INSERT` (reforzado con trigger en la BD). |
| **Idempotencia** | Creación de pedidos, webhooks y reintentos usan `clave_idempotencia`/`clave_deduplicacion` y las restricciones únicas del SQL. |
| **Efectos secundarios vía *outbox*** | Los eventos salientes se escriben en `eventos_salida` dentro de la transacción de negocio. Un worker podrá publicarlos en RabbitMQ y aplicar reintentos idempotentes. |
| **Configuración, no constantes** | Umbrales, tiempos, montos y permisos finos viven en `configuraciones` (por inquilino). |

---

## 3. Stack tecnológico

**Base del monorepo instalada (manifiestos y lockfile):**

| Área | Tecnología | Estado |
|---|---|---|
| Workspace | `pnpm` workspaces | Configurado en la raíz. |
| Frontend/BFF | Next.js 15.5.28, React 19.3.1, TypeScript | Manifiesto en `apps/web`; la aplicación aún requiere implementación. |
| Estado del frontend | Zustand, TanStack Query, Zod | Dependencias declaradas en `apps/web`. |
| Backend/API | NestJS 11.2.8, TypeScript, Express | Manifiesto en `apps/api`; es una API modular, no un conjunto de microservicios implementados. |
| Acceso a datos relacional | TypeORM 0.3.31, `@nestjs/typeorm`, `pg` | Declarado en `packages/database` y `apps/api`. |
| Almacenamiento documental | Driver oficial `mongodb` | Instalado; el SQL vigente aún guarda catálogo y cartas en PostgreSQL. No usar ambos como fuentes de verdad del mismo dato. |
| Caché/estado temporal | Redis 7.4.2 en Compose, `ioredis` | Provisionado; el uso funcional está pendiente. |
| Mensajería | RabbitMQ 4.1.4-management en Compose, `@nestjs/microservices` | Broker provisionado; consumers, publishers y transporte RabbitMQ todavía no están implementados. |
| Docker | Compose con PostgreSQL, MongoDB, Redis y RabbitMQ | No define contenedores de web/API, proxy inverso ni monta automáticamente el SQL canónico. |
| Tipos compartidos | `packages/shared-types` + Zod | Workspace preparado; contratos compartidos aún por crear. |
| Configuración TypeScript | `packages/config` | Workspace preparado. |
| Base relacional | PostgreSQL 16.10 en Compose | Fuente de verdad del esquema SQL vigente, incluidas las entidades del catálogo. |

**Decisiones que rigen esta especificación:**

- El esquema canónico es [`0001_esquema_zero_delivery_es.sql`](../0001_esquema_zero_delivery_es.sql). Sus identificadores y valores de dominio están en español y deben mapearse explícitamente desde TypeORM. No renombres tablas/columnas ni regeneres la base desde entidades sin una migración revisada.
- El SQL actual solo define PostgreSQL. No define colecciones MongoDB, persistencia de sesiones/carritos en Redis ni tablas de cashout. MongoDB y Redis están disponibles en Docker, pero son servicios provisionados, no fuentes de datos usadas por este esquema.
- Las coordenadas están guardadas como `numeric` de latitud/longitud. El esquema no instala PostGIS. No documentes consultas geoespaciales PostGIS hasta que una migración añada la extensión y sus tipos/índices.
- Las tablas `eventos_salida` y `eventos_entrada` conservan el patrón outbox/inbox en PostgreSQL. RabbitMQ puede servir como transporte de eventos, pero la escritura de dominio y el outbox deben permanecer en una transacción PostgreSQL; no se afirma que haya una Saga implementada.
- El esquema persiste importes como `bigint` en céntimos, usa `text` con `CHECK` para estados y aplica triggers de inmutabilidad en tablas financieras/auditoría.

**Dependencias previstas para completar el MVP** (no confundir con lo ya instalado): Tailwind CSS, PWA/service worker, pruebas, autenticación, logging, exportación y proxy inverso deben añadirse al workspace cuando se implementen y validarse con sus manifiestos/lockfile.

---

## 4. Arquitectura y estructura del repositorio

El monorepo actual separa interfaz y API. Next.js puede actuar como BFF; NestJS es la frontera del servidor para autenticación, autorización, reglas de negocio, transacciones y acceso a PostgreSQL. Para el MVP la API se mantiene como una aplicación NestJS modular. RabbitMQ habilita mensajería asíncrona, pero no se deben llamar microservicios separados a módulos que se ejecutan dentro del mismo proceso.

```text
/
├─ 0001_esquema_zero_delivery_es.sql  # esquema PostgreSQL canónico actual
├─ docs/                              # especificación, ADRs, supuestos y runbooks
├─ apps/
│  ├─ web/                            # Next.js App Router; interfaz y BFF/proxy
│  └─ api/                            # NestJS; API y módulos de negocio
└─ packages/
   ├─ shared-types/                   # contratos y validaciones Zod compartidas
   ├─ database/                       # TypeORM, drivers y mapeos del esquema SQL
   └─ config/                         # configuración común TypeScript
```

Al implementar, ubica las pantallas/rutas en `apps/web`, los módulos NestJS (`identity`, `tenancy`, `catalog`, `customers`, `orders`, `payments`, `logistics`, `wallet`, `reporting`, `alerts`, `audit`, `settings`, `integrations`) en `apps/api`, y entidades/repositorios/adaptadores en `packages/database` o en módulos de infraestructura de la API. Los contratos consumidos por ambas aplicaciones viven en `packages/shared-types`. El esquema SQL actual no se mueve ni se traduce de nuevo en esta etapa.

**Reglas de dependencia:**

- `apps/web` consume la API/contratos públicos; no accede directamente a la base de datos.
- Controladores NestJS validan la entrada y delegan en servicios de aplicación; no contienen reglas financieras.
- Dominio/aplicación no importan React, Next.js ni detalles concretos del driver.
- TypeORM debe mapear de forma explícita los nombres españoles del SQL vigente. El SQL es la autoridad para restricciones, índices, triggers y funciones.
- Los módulos se comunican por sus servicios/contratos públicos; eventos externos pasan por outbox/inbox y RabbitMQ cuando se implemente su transporte.

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
| Integración real con **Vocero CRM** (API/webhooks) | `CrmPort` + endpoint NestJS `/api/webhooks/[provider]` con tabla `eventos_entrada` (idempotencia) y firma HMAC por proveedor, **desactivado por feature flag**. |
| **WhatsApp** y **chatbot** | `NotificationPort`/`MessagingPort`, `eventos_salida`, plantillas de mensajes por evento. Adaptador MVP: `InAppNotifier` + `ConsoleNotifier`. |
| Exportación **Excel y PDF** | Interfaz `Exporter` ya con `csv`; `xlsx` y `pdf` se registran después sin cambiar los reportes. |
| Asignación **automática** de repartidores | `AssignmentStrategy` (interfaz); MVP implementa solo `ManualStrategy`. |
| **Puntaje de confianza** del repartidor | Columna `puntaje_confianza` nula + interfaz `TrustScorer`. No sancionar automáticamente. |
| **Promociones**, cupones, combos | Tablas vacías `promotions`, `promotion_rules`; `PricingPolicy` recibe `discounts[]` (vacío en MVP). |
| Embudo de conversión (reporte) | Solo se capturan eventos (SHOULD). |
| Tarifas dinámicas por distancia/vehículo, geocodificación, polígonos | `DeliveryFeePolicy` (interfaz); MVP = tarifa fija por zona. |
| GPS continuo, mapa en tiempo real | `ubicaciones_repartidor` ya existe; MVP solo guarda la ubicación compartida a mano. |
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
- Toda consulta se filtra por `inquilino_id` (nombre real del SQL; `tenantId` en los tipos de aplicación) y por alcance de sucursales del actor.

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
3. El **pago al restaurante está confirmado** (`pagos_restaurante.estado = CONFIRMADO` y `pedidos.estado_pago_restaurante = CONFIRMADO`) — aplica a efectivo y a pago anticipado.
4. El Encargado registró el **handoff** (entrega física al repartidor). El Encargado **solo** debe registrarlo después de que el pago al restaurante esté confirmado: el sistema debe **rechazar** el handoff si el payout no está confirmado.

Registrar siempre **quién** autorizó la liberación y **cuándo**.

Implementa esto como una función pura y testeable: `evaluateReleaseGate(order, payment, payout, rider, handoff) → { ok: boolean; failures: ReleaseFailure[] }`. Persiste el estado agregado en `pedidos` y el detalle de confirmación en `pagos_restaurante`.

### 7.3 Pagos

- Métodos del MVP: `CASH`, `YAPE`, `BANK_TRANSFER`. (Tarjeta: fuera.)
- Estado de pago (independiente del operativo): `PENDING`, `PAID`, `REJECTED`, `REFUNDED`.
- **Yape/transferencia van directo al local**: no afectan la garantía del repartidor. El repartidor ve "ya pagado — sin cobro".
- **Efectivo contra entrega:** el repartidor cobra al cliente, registra el importe cobrado y se genera un asiento en `movimientos_billetera` (ver 10).
- **Corrección de pagos** (`ADMIN`/`COORDINATOR`): exige motivo, guarda **valor anterior y nuevo**, conserva el historial. Nunca borrar el registro original. Modela `pagos` + `eventos_pago` (solo-inserción).
- **Reembolsos:** manuales, autorizados por Coordinador/Admin. Se registran motivo, importe, autor, fecha y confirmación. **No** asumas API de reembolso de Yape/bancos.

### 7.4 Productos faltantes, cancelaciones y cambio de dirección

- **Falta producto:** el Encargado marca el ítem como no disponible con motivo → el sistema notifica al cliente (vía canal/staff) y al Coordinador → el cliente decide **reemplazo** (se registra decisión y diferencia de precio) o **cancelar solo ese ítem**. El resto del pedido continúa. Los renglones se guardan en `detalle_pedido` y `modificadores_detalle_pedido`; sus nombres/estados deben ajustarse al SQL vigente antes de implementar esta acción.
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

- El repartidor registra motivo, observaciones, hora y foto **opcional** (sin recolectar datos personales innecesarios). Se crea un registro en `intentos_entrega` con número de intento.
- **Máximo 2 intentos** (`delivery.max_attempts = 2`). El segundo intento **requiere autorización del Coordinador**.
- Si el 2.º intento falla → `PENDING_RESOLUTION`. **No** se programa un 3.º automáticamente.
- Devolución: `RETURN_PENDING` → el Encargado confirma recepción física (`RETURNED_TO_RESTAURANT`) → el Coordinador decide cierre (`CANCELLED` con `resolution`) o reintento autorizado (si `attempt_no < 2`).
- Las pérdidas/incidencias económicas se registran en `incidencias_pedido` con evidencia, responsable de revisión, decisión, importe y justificación. **Nunca** cargar automáticamente una pérdida a un repartidor, restaurante o Coordinador.

### 7.7 Espera en el restaurante

- El repartidor espera **hasta 15 minutos** (`rider.pickup_wait_minutes = 15`). El sistema registra la llegada (`RIDER_AT_PICKUP`) y calcula el tiempo transcurrido.
- Qué ocurre después de los 15 min está `PENDIENTE` (DECISION-07). MVP: solo **alerta** al Coordinador. No reasignar ni compensar automáticamente.

### 7.8 Precios y desglose interno

- Cada ítem de `detalle_pedido` guarda **snapshot**: `precio_base_centavos`, `empaque_centavos`, `margen_centavos`, `precio_unitario_centavos`, nombre y modificadores. Cambios posteriores del catálogo **no** alteran pedidos pasados.
- El cliente ve **un precio final** (o según configuración de la carta: `cartas.incluye_entrega_en_precio`, `cartas.incluye_impuesto_en_precio`). El desglose de base, empaque y margen es **interno**: usa DTOs distintos (`CustomerOrderDTO` vs `StaffOrderDTO`) y un test que verifique que el DTO público **no** contiene campos internos.
- **Margen** (ingreso de Zero Delivery): por producto, `productos.tipo_margen ∈ {FIJO, PORCENTAJE}` y `productos.valor_margen`. **La fórmula definitiva NO está aprobada** (DECISION-01). Implementa `PricingPolicy` con una `ProvisionalPricingPolicy` aislada en un solo archivo:
  `unit_price = base + packaging + margin`, donde `margin = FIXED ? value : round(base * value/100)`.
  Márcala `PROVISIONAL`, sin tratamiento de descuentos ni impuestos, y **no** la uses para reportes financieros oficiales hasta que se apruebe.
- **Impuestos:** `tax_cents = 0` en el MVP; `invoice_requested` solo se guarda.
- **Importante conceptual:** el dinero cobrado al cliente **no** es ingreso de Zero Delivery; pertenece al restaurante, a la tarifa de entrega y al margen. No lo mezcles en los reportes.

### 7.9 Clientes

- Identificación y deduplicación por **teléfono normalizado a E.164** (`+519XXXXXXXX`; móvil peruano: 9 dígitos empezando en 9). Compras **como invitado** permitidas.
- Segmentación: `NEW`, `RECURRING`, `TOP` (umbral configurable `customer.top_min_orders`).
- **Filtro de seguridad de clientes (antes llamado "doxeo"):** implementa **solo** un indicador manual (`clientes.marca_riesgo ∈ {NINGUNO, PRECAUCION, BLOQUEADO}`) con `motivo_riesgo`, fijado por Coordinador/Admin y auditado. **No** implementes búsqueda, scraping ni recopilación de datos personales de fuentes externas. Aplica minimización de datos.

### 7.10 Geolocalización

- La ubicación del repartidor se comparte **manualmente** (botón "Compartir ubicación" → `navigator.geolocation` en primer plano → guarda último ping).
- Admin/Coordinador/Empleado (solo lectura) pueden ver el último ping. **El cliente nunca.** No hay mapa en tiempo real en el MVP; muestra enlace "Abrir en Google Maps" (`https://www.google.com/maps/search/?api=1&query=lat,lng`), sin API key.

---

## 8. Máquina de estados del pedido

**Dos ejes independientes:**

- `operational_status` (logística) — esta sección.
- `payment_status` (`PENDING | PAID | REJECTED | REFUNDED`) — sección 7.3.
- Además: `restaurant_payout_status` (`PENDING | CONFIRMED`) y `handoff_at` (nullable).

Los nombres y estados ingleses de esta sección son identificadores lógicos de dominio/API. PostgreSQL persiste los nombres/valores españoles del mapeo en la sección 9.

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

- Cada transición corre en **una transacción** con `SELECT … FOR UPDATE` sobre `pedidos` y **bloqueo optimista** (`pedidos.version`, incrementado por trigger).
- Una transición repetida (misma de→a) es **idempotente** (no duplica historial ni efectos) o devuelve `409` claro.
- Cada transición escribe en `historial_estados_pedido` (estado anterior/nuevo, actor, fecha/hora, motivo) **y** en `registro_auditoria`, y encola eventos en `eventos_salida`.
- El Kanban solo muestra y permite las columnas/acciones que el rol puede ejecutar.

---

## 9. Modelo de datos (PostgreSQL)

La única definición normativa de tablas, columnas, valores `CHECK`, índices, claves foráneas, vistas, funciones y triggers es [`0001_esquema_zero_delivery_es.sql`](../0001_esquema_zero_delivery_es.sql). Esta sección describe sus dominios; no es un segundo DDL.

**Reglas que refleja el SQL vigente:**

- PostgreSQL con PK `uuid` generadas mediante `gen_random_uuid()`; fechas `timestamptz` en UTC. No todas las tablas tienen `actualizado_en` ni una columna de tenant directa; algunas tablas relacionales heredan el alcance por sus FK.
- Las tablas de dominio usan nombres y valores de estado en español, `snake_case` ASCII, y estados como `text` con `CHECK`. Las entidades TypeORM deben mapear esos nombres literalmente.
- Los importes son `bigint` en céntimos; S/ 150.75 se persiste como `15075`. El esquema no define una columna de moneda, por lo que el MVP interpreta PEN según el contexto de producto; no agregues ni presupongas una columna `currency`.
- Coordenadas geográficas se almacenan como latitud/longitud `numeric`; el SQL habilita `pg_trgm`, no PostGIS.
- El catálogo está actualmente en PostgreSQL. Aunque MongoDB está configurado como servicio y su driver está instalado, no existe una colección ni una migración de catálogo a MongoDB en el esquema canónico.
- No hay tablas `billeteras`, `transacciones` o `cashouts`: el saldo de garantía se deriva de `movimientos_billetera`; los retiros bancarios no están modelados.
- Inmutabilidad aplicada por triggers: `registro_auditoria`, `historial_estados_pedido`, `eventos_pago` y `movimientos_billetera` son solo-inserción. `eventos_entrada` impide borrar y solo permite actualizar campos de procesamiento; `eventos_salida` sí cambia estado/intentos para operar la outbox.
- El aislamiento multi-tenant se aplica con `inquilino_id` donde está definido y por relaciones FK en tablas dependientes. La aplicación debe filtrar cada consulta por el tenant del actor; RLS no está configurado en este SQL.

**Entidades existentes, agrupadas por dominio** (los nombres entre acentos graves son los nombres exactos del SQL):

| Dominio | Tablas |
|---|---|
| Identidad y organización | `inquilinos`, `contadores_inquilino`, `usuarios`, `sesiones`, `restaurantes`, `sucursales`, `acceso_usuario_sucursal`, `horarios_sucursal`, `zonas_entrega` |
| Archivos y catálogo | `archivos`, `categorias`, `productos`, `grupos_modificadores`, `opciones_modificador`, `productos_grupos_modificadores`, `cartas`, `items_carta` |
| Clientes y logística | `clientes`, `direcciones_cliente`, `repartidores`, `ubicaciones_repartidor` |
| Pedidos | `pedidos`, `detalle_pedido`, `modificadores_detalle_pedido`, `historial_estados_pedido`, `notas_pedido`, `incidencias_pedido`, `intentos_entrega` |
| Pagos y finanzas | `pagos`, `eventos_pago`, `pagos_restaurante`, `reembolsos`, `liquidaciones`, `adelantos_repartidor`, `movimientos_billetera` |
| Operación transversal | `calificaciones`, `alertas`, `configuraciones`, `registro_auditoria`, `eventos_salida`, `eventos_entrada`, `eventos_embudo`, `promociones`, `reglas_promocion`, `suscripciones_push` |

**Mapeo de vocabulario del dominio a PostgreSQL:**

| Concepto en esta especificación/API | Tabla y columnas principales del SQL |
|---|---|
| Tenant | `inquilinos`; alcance: `inquilino_id` |
| Usuarios y sesiones | `usuarios`, `sesiones`; roles: `ADMINISTRADOR`, `COORDINADOR`, `ENCARGADO_SUCURSAL`, `AGENTE_SOPORTE`, `REPARTIDOR` |
| Sucursales y catálogo | `sucursales`, `categorias`, `productos`, `grupos_modificadores`, `opciones_modificador`, `cartas`, `items_carta` |
| Clientes y direcciones | `clientes`, `direcciones_cliente` |
| Pedido y renglones | `pedidos`, `detalle_pedido`, `modificadores_detalle_pedido` |
| Pagos y payout | `pagos`, `eventos_pago`, `pagos_restaurante`, `reembolsos` |
| Entregas y rider | `repartidores`, `intentos_entrega`, `ubicaciones_repartidor` |
| Ledger y liquidación | `movimientos_billetera`, `adelantos_repartidor`, `liquidaciones` |
| Auditoría y eventos | `registro_auditoria`, `eventos_salida`, `eventos_entrada` |

**Campos críticos: nombres lógicos usados en esta especificación → columnas PostgreSQL:**

| Entidad/campo lógico | Nombre exacto en PostgreSQL |
|---|---|
| Tenant `id` | `inquilinos.id` |
| User `username`, `password_hash`, `display_name`, `role`, `is_active` | `usuarios.nombre_usuario`, `hash_contrasena`, `nombre_mostrado`, `rol`, `esta_activo` |
| Order `number`, `branch_id`, `customer_id`, `address_snapshot`, `channel` | `pedidos.numero`, `sucursal_id`, `cliente_id`, `direccion_snapshot`, `canal` |
| Order `operational_status`, `payment_status`, `payment_method`, `restaurant_payout_status` | `pedidos.estado_operativo`, `estado_pago`, `metodo_pago`, `estado_pago_restaurante` |
| Order `handoff_at/by`, `released_at/by`, `rider_id`, `delivery_zone_id` | `pedidos.traspaso_en/por`, `liberado_en/por`, `repartidor_id`, `zona_entrega_id` |
| Order money fields (`items_subtotal`, `discount`, `delivery_fee`, `tax`, `total`, `cash_to_collect`) | `pedidos.subtotal_items_centavos`, `descuento_centavos`, `tarifa_entrega_centavos`, `impuesto_centavos`, `total_centavos`, `efectivo_por_cobrar_centavos` |
| Order `public_token`, `idempotency_key`, `version` | `pedidos.token_publico`, `clave_idempotencia`, `version` |
| Order item snapshot/price/status | `detalle_pedido` (`nombre_snapshot`, `cantidad`, `precio_base_centavos`, `empaque_centavos`, `margen_centavos`, `precio_unitario_centavos`, `total_linea_centavos`, `estado`); modificadores en `modificadores_detalle_pedido` |
| Payment `amount`, `proof`, `validated_by/at` | `pagos.monto_centavos`, `archivo_comprobante_id`, `validado_por`, `validado_en` |
| Wallet `type`, `amount`, `order_id`, `advance_id`, `settlement_id` | `movimientos_billetera.tipo`, `monto_centavos`, `pedido_id`, `adelanto_id`, `liquidacion_id` |
| Branch `lat/lng`, delivery zone `fee/min_order` | `sucursales.latitud/longitud`, `zonas_entrega.tarifa_centavos/pedido_minimo_centavos` |

Los identificadores ingleses usados en reglas, UI o contratos son vocabulario lógico de la aplicación, no nombres de tablas/columnas ni valores para escribir directamente en PostgreSQL, salvo que la tabla de mapeo indique lo contrario. Los mapeos principales de estados son:

| Contrato lógico | Valor SQL |
|---|---|
| `NEW`, `CONFIRMED`, `PREPARING`, `READY` | `NUEVO`, `CONFIRMADO`, `EN_PREPARACION`, `LISTO` |
| `RIDER_ASSIGNED`, `RIDER_AT_PICKUP`, `ON_THE_WAY`, `DELIVERED` | `REPARTIDOR_ASIGNADO`, `REPARTIDOR_EN_RECOJO`, `EN_CAMINO`, `ENTREGADO` |
| `REJECTED`, `CANCELLATION_REQUESTED`, `CANCELLED` | `RECHAZADO`, `CANCELACION_SOLICITADA`, `CANCELADO` |
| `DELIVERY_FAILED`, `RETURN_PENDING`, `RETURNED_TO_RESTAURANT`, `PENDING_RESOLUTION` | `ENTREGA_FALLIDA`, `DEVOLUCION_PENDIENTE`, `DEVUELTO_A_RESTAURANTE`, `PENDIENTE_RESOLUCION` |
| `PENDING`, `PAID`, `REJECTED`, `REFUNDED` (pago) | `PENDIENTE`, `PAGADO`, `RECHAZADO`, `REEMBOLSADO` |
| `CASH`, `YAPE`, `BANK_TRANSFER` | `EFECTIVO`, `YAPE`, `TRANSFERENCIA_BANCARIA` |
| `ADMIN`, `COORDINATOR`, `BRANCH_MANAGER`, `SUPPORT_AGENT`, `RIDER` | `ADMINISTRADOR`, `COORDINADOR`, `ENCARGADO_SUCURSAL`, `AGENTE_SOPORTE`, `REPARTIDOR` |

Antes de crear o cambiar una entidad TypeORM, contrasta sus nombres, nulabilidad, defaults y restricciones con el SQL. No uses `synchronize: true` para desplegar ni permitas que TypeORM reemplace triggers/funciones del esquema.

---

## 10. Garantía, adelantos y liquidación (libro mayor)

**Modelo implementado en el SQL:** no hay una tabla de saldo/caché `billeteras`. `movimientos_billetera` es el ledger append-only y el saldo de garantía es la suma de `monto_centavos` por repartidor, expuesta por `vista_saldo_garantia_repartidor`. No existe una tabla `cashouts`; los retiros bancarios manuales siguen fuera del esquema.

- **Cobro en efectivo:** al completar la entrega se registra `EFECTIVO_COBRADO` negativo en `movimientos_billetera`, vinculado a `pedido_id`. Validar contra `pedidos.efectivo_por_cobrar_centavos`; cualquier diferencia requiere motivo e incidencia. El índice único parcial del SQL impide más de un asiento de cobro por pedido.
- **Liquidación** (`liquidaciones`): registra `efectivo_cobrado_centavos`, `efectivo_recibido_centavos`, adelantos, tarifa y neto. El efectivo recibido genera `EFECTIVO_LIQUIDADO` positivo; diferencias no se perdonan automáticamente.
- **Garantía/deuda:** saldo menor que cero bloquea nuevas asignaciones en efectivo. Depósitos, retiros y ajustes se representan como `DEPOSITO_GARANTIA`, `RETIRO_GARANTIA` y `AJUSTE`; ajustes requieren motivo.
- **Adelantos** (`adelantos_repartidor`): autorización humana y deducción vinculada a una sola `liquidacion_id`; la restricción CHECK impide marcar deducido sin liquidación.
- **Corte:** `configuraciones` almacena el umbral/corte por inquilino. La aplicación debe crear o completar `liquidaciones` y luego permitir confirmación humana; el SQL no crea por sí solo un worker ni un calendario.
- **Fórmula de pago al repartidor:** sigue pendiente (DECISION-03). El SQL conserva tarifa de referencia y pagable; si difieren, requiere `motivo_ajuste_tarifa_repartidor`.
- **Concurrencia:** realizar transacción ACID y bloquear la fila `repartidores` con `SELECT … FOR UPDATE` al actualizar el ledger/liquidación. Las restricciones SQL protegen invariantes adicionales, pero no reemplazan la autorización ni la lógica de servicio.
- Invariantes: no editar/borrar `movimientos_billetera`; no confirmar dos veces una liquidación; no deducir dos veces un adelanto; idempotencia por pedido/liquidación según índices únicos del esquema.

---

## 11. API y módulos de aplicación

- Las mutaciones de UI pasan por Next.js/BFF hacia NestJS. Los controladores NestJS validan el borde y llaman a servicios de aplicación; no dupliques reglas de negocio en Server Actions.
- NestJS expone `/api/v1` coherente y versionada (la usará una futura app nativa); Next.js puede pasar solicitudes por su BFF. Recursos REST lógicos (`/orders`, `/orders/:id/transitions`, `/riders`, `/payments`, `/settlements`, …), paginación por cursor y errores uniformes (`{ code, message, details?, requestId }`). Los nombres REST no alteran los nombres españoles del SQL.
- Creación de pedidos exige cabecera/campo `Idempotency-Key`.
- "Tiempo real" del MVP: **polling** (5–10 s) con ETag/`If-None-Match` o `updated_since`, encapsulado en un hook `useLiveOrders`. Deja la interfaz lista para cambiar a SSE/WebSocket/`LISTEN/NOTIFY` sin tocar los componentes.
- Rate limiting en login y endpoints públicos (en memoria inicialmente; Redis ya está provisionado para una implementación distribuida posterior).

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

- **Outbox:** al cambiar el estado de un pedido se inserta un evento en `eventos_salida` en la misma transacción. Un worker (por implementar) publicará en RabbitMQ y llamará al adaptador con reintentos *backoff*. Los reintentos **no** pueden duplicar efectos (clave de deduplicación por evento). No se usa pg-boss.
- **Webhooks entrantes:** `POST /api/webhooks/[provider]` en NestJS verifica firma HMAC (secreto por proveedor en variable de entorno), inserta en `eventos_entrada` con `UNIQUE(proveedor, id_evento_externo)` (duplicado ⇒ responde 200 sin reprocesar), y procesa de forma asíncrona. **Detrás de feature flag, apagado**, hasta verificar la documentación real de Vocero CRM (endpoints, auth, eventos, límites) — **no asumas** ninguna función de su API.
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
- **Offline en el MVP:** *app shell* + últimas lecturas cacheadas. **Las escrituras requieren conexión**: muestra un aviso claro; **no** implementes cola offline de mutaciones. La dependencia PWA/service worker aún debe añadirse al workspace.
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
- Autorización en cada servicio (`can(...)`), **filtrado por `inquilino_id` y alcance** en cada consulta. Tests que intenten saltarse permisos llamando directo a la API (CA-01).
- Subida de archivos: validar tipo/tamaño, nombres generados, nunca servir desde una ruta controlada por el usuario.
- Datos personales: minimización; logs **sin** teléfonos/direcciones; el repartidor solo ve lo necesario y solo de sus pedidos.
- **Auditar** (actor, rol, fecha/hora, acción, objeto, antes/después): inicios de sesión y eventos de seguridad, cambios de permisos/roles, productos, precios y tarifas, pagos y correcciones, liberaciones, asignaciones/reasignaciones, cambios de estado, liquidaciones, garantías y adelantos, cancelaciones y devoluciones, cambios de configuración.
- Errores: manejo seguro (sin *stack traces* al cliente), `requestId` en la respuesta.
- Sesiones server-side en `sesiones`: conserva únicamente `hash_token`, con expiración y revocación; no guardar el token de cookie en claro.
- Backups: `scripts/backup.sh` (`pg_dump`, cifrado, rotación) y `scripts/restore.sh`; runbook en `docs/runbooks/backup-restore.md`. **Prueba la restauración** en el hito 4.

---

## 16. Parámetros configurables y decisiones pendientes

Implementa el servicio de configuración tipado sobre `configuraciones` (clave real, tipo, default, validación y alcance por inquilino) y una pantalla de Admin para editarlos con auditoría. La primera columna es la clave lógica de aplicación y la segunda es la clave persistida por el SQL. **Los valores `PLACEHOLDER` no están aprobados.**

| Clave lógica | Clave exacta de `configuraciones.clave` | Default / estado |
|---|---|---|
| `order.acceptance_timeout_minutes` | `pedido.minutos_espera_aceptacion` | 5 · PLACEHOLDER (DECISION-05) |
| `order.prep_delay_threshold_minutes` | `pedido.minutos_umbral_demora_preparacion` | 30 · PLACEHOLDER (DECISION-05) |
| `order.no_rider_threshold_minutes` | `pedido.minutos_umbral_sin_repartidor` | 10 · PLACEHOLDER (DECISION-05) |
| `rider.pickup_wait_minutes` | `repartidor.minutos_espera_recojo` | 15 · **Aprobado** (acción posterior pendiente: DECISION-07) |
| `rider.min_age_for_cash_without_guarantee` | `repartidor.edad_minima_efectivo_sin_garantia` | 35 · Del doc original; confirmar (DECISION-02) |
| `rider.allow_multiple_orders` | `repartidor.permitir_multiples_pedidos` | false · PLACEHOLDER |
| `guarantee.min_cents` | `garantia.minimo_centavos` | 0 · PLACEHOLDER (DECISION-02) |
| `delivery.max_attempts` | `entrega.maximo_intentos` | 2 · **Aprobado** |
| `settlement.cutoff_time` | `liquidacion.hora_corte` | "23:00" · Del doc original; confirmar procedimiento |
| `customer.top_min_orders` | `cliente.minimo_pedidos_top` | 10 · PLACEHOLDER |
| `reports.branch_manager_can_view_sales` | `reportes.encargado_sucursal_puede_ver_ventas` | false · PENDIENTE (DECISION-04) |
| `reports.coordinator_can_view_funnel` | `reportes.coordinador_puede_ver_embudo` | false · PENDIENTE (DECISION-04) |
| `support.can_assign_rider` | `soporte.puede_asignar_repartidor` | true · Aprobado (con permisos) |
| `support.can_create_advance` | `soporte.puede_crear_adelanto` | false · PENDIENTE |
| `feature.integration.vocero` | `funcionalidad.integracion.vocero` | false · Apagado hasta validar API |
| `feature.integration.whatsapp` | `funcionalidad.integracion.whatsapp` | false · Apagado hasta validar API |
| `localization.timezone` | `localizacion.zona_horaria` | `America/Lima` |
| `localization.currency` | `localizacion.moneda` | `PEN` |

La función `sembrar_configuracion_predeterminada()` del SQL crea estos valores. Usa las claves reales en PostgreSQL y traduce a las claves lógicas únicamente en la capa de aplicación.

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
Monorepo pnpm, TypeScript estricto, ESLint/Prettier, reglas de dependencias, Vitest y Playwright, Docker Compose para PostgreSQL/MongoDB/Redis/RabbitMQ, CI, mapeo TypeORM del SQL canónico y ejecución versionada del esquema desde base vacía, utilidades (`money`, `time` con `America/Lima`, `phone` E.164, `errors`, `result`, logger), PWA *shell* (manifest + service worker), i18n `es-PE`, servicios `configuraciones`/`registro_auditoria`, **auth** (login/logout/sesiones/rate limit), **motor de permisos `can()`** con test table-driven, layout por rol, script de seed. El Compose actual provisiona solo dependencias; no construye `apps/web`/`apps/api` ni aplica automáticamente el SQL.
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
- **Integración (Postgres real):** servicios con transacciones y bloqueos; triggers *append-only* (intentar `UPDATE/DELETE` debe fallar); idempotencia de pedidos y webhooks; aislamiento por `inquilino_id`; concurrencia (dos transiciones simultáneas, dos cobros simultáneos al mismo repartidor).
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
| Más de un restaurante/agencia real | Activar alta de `inquilinos` (ya existe `inquilino_id`); añadir RLS de PostgreSQL como segunda barrera. |
| El polling pesa o se necesita inmediatez | Cambiar `useLiveOrders` a SSE/WebSocket alimentado por `LISTEN/NOTIFY` o un bus; la API no cambia. |
| El worker compite con la API | Desplegar un proceso worker NestJS separado (misma base de código) que consuma la outbox y RabbitMQ. |
| Reportes lentos | Tablas resumen / vistas materializadas refrescadas por job; réplica de lectura para reportes. |
| Tablas enormes (`registro_auditoria`, `historial_estados_pedido`, `movimientos_billetera`) | Particionado por mes; archivado en frío. |
| Límites de tasa/sesiones distribuidos | Usar Redis, ya provisionado, detrás de las interfaces de rate-limit y caché. |
| Más integraciones | Un adaptador nuevo por puerto; publicar los eventos de `eventos_salida` en RabbitMQ, ya provisionado, cuando se implemente el transporte. |
| Repartidores necesitan app nativa/GPS continuo | App React Native/Flutter consumiendo `/api/v1`; activar escritura continua en `ubicaciones_repartidor`. |
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
- No dupliques datos del esquema PostgreSQL vigente en MongoDB. Los servicios MongoDB, Redis y RabbitMQ ya están provisionados en Compose, pero no asumas uso funcional hasta que se implemente el adaptador correspondiente. No declares PostGIS, microservicios ni Sagas como implementados sin esquema/código y pruebas.
- No marques una contradicción del spec original como resuelta por tu cuenta: regístrala en `docs/ASSUMPTIONS.md`.

---

## 21. Primer mensaje para el agente (kickoff)

> Mantén el documento alineado con el monorepo actual: Next.js en `apps/web`, NestJS en `apps/api` y PostgreSQL como fuente de verdad definida por `0001_esquema_zero_delivery_es.sql`. Antes de implementar módulos, valida que cada entidad TypeORM respete ese DDL; no copies código de `zero-deliveryv2`, no uses `synchronize: true` y no migres datos a MongoDB sin una decisión/migración aprobada. Registra nuevas decisiones de arquitectura en `docs/adr/`, ejecuta los hitos en orden y reporta las verificaciones reales sin afirmar que servicios aún no implementados están operativos.
