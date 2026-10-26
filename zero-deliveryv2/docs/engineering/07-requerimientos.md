# 07 — Requerimientos Funcionales y No Funcionales

> **Estado:** `[DESIGNED]` · **Versión:** 1.0-mvp · **Fuente:** `logica de negocioZERO_DELIVERY.md` + `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md`

---

## 1. Requerimientos Funcionales (RF)

| ID | Descripción | Prioridad | Alcance MVP | Caso de Uso Relacionado |
|---|---|---|---|---|
| **RF-001** | Autenticación por usuario y contraseña (`argon2id`), sesiones en BD y control de acceso por rol (`ADMIN`, `COORDINATOR`, `BRANCH_MANAGER`, `SUPPORT_AGENT`, `RIDER`) con `can()`. | Alta | **MUST (Hito 0)** | CU-001 |
| **RF-002** | Panel de control (Dashboard) filtrado por rol y periodo (`Hoy`, `Ayer`, `7d`, `30d`, `Personalizado` en `America/Lima`) con métricas de pedidos, ventas, tiempos y clientes. | Alta | **MUST (Hito 4)** | CU-013 |
| **RF-003** | Monitoreo operativo del estado de sucursales, pedidos demorados, productos agotados y repartidores sin saldo de garantía. | Alta | **MUST (Hito 2–4)** | CU-002, CU-005, CU-013 |
| **RF-004** | Registro y administración de pedidos con número secuencial por tenant, snapshot de precios, desglose interno oculto al cliente (`base + envase + margen + delivery`) y filtros por estado. | Alta | **MUST (Hito 2)** | CU-004 |
| **RF-005** | Trazabilidad completa de estados del pedido (`order_status_history`) e independencia entre estado operativo y estado de pago anticipado. | Alta | **MUST (Hito 2–3)** | CU-005, CU-007, CU-009 |
| **RF-006** | Gestión de repartidores (flota propia, agencia externa o tercero), vehículo (`MOTO`/`CAR`), edad y marca `high_trust` para excepción de garantía en efectivo. | Alta | **MUST (Hito 3)** | CU-008 |
| **RF-007** | Visibilidad diferenciada del seguimiento logístico por rol: `BRANCH_MANAGER` solo ve hasta `READY`/`handoff` y el estado final (`DELIVERED`/`DELIVERY_FAILED`); `RIDER` solo ve sus pedidos activos; el cliente nunca ve GPS del repartidor. | Alta | **MUST (Hito 2–3)** | CU-008, CU-009, CU-014 |
| **RF-008** | Administración de catálogo: categorías, productos con marca `is_fragile`, archivado lógico (`archived_at`), cartas dinámicas por sucursal (`menus`, `menu_items`) e imágenes. | Alta | **MUST (Hito 1)** | CU-003 |
| **RF-009** | Gestión de grupos y opciones de modificadores (`min_select`, `max_select`, `price_delta_cents`) con recálculo automático e inclusión en snapshot del pedido. | Alta | **MUST (Hito 1–2)** | CU-003, CU-004 |
| **RF-010** | Configuración de horarios y turnos de atención independientes por sucursal y día de la semana (`branch_schedules`), más apertura/cierre manual temporal (`is_open_manual`). | Alta | **MUST (Hito 1)** | CU-002 |
| **RF-011** | Configuración de zonas de reparto simples por sucursal (`name`, `fee_cents`, `min_order_cents`) y puerto `DeliveryFeePolicy` para tarifas dinámicas futuras. | Alta | **MUST (Hito 1)** | CU-002 |
| **RF-012** | Gestión de clientes con deduplicación por teléfono `E.164` (`+519XXXXXXXX`), segmentación (`NEW`, `RECURRING`, `TOP`) e indicador de seguridad manual auditado (`risk_flag`: `NONE`, `CAUTION`, `BLOCKED`) sin recopilación de datos externos. | Alta | **MUST (Hito 2)** | CU-004 |
| **RF-013** | Consulta del historial de compras del cliente (pedidos, fechas, importes, métodos de pago y estados). | Media | **MUST (Hito 2)** | CU-004, CU-013 |
| **RF-014** | Estructura de calificaciones (`ratings`) y calificación simple del cliente por parte del repartidor (sin conversión automática de pedidos a estrellas en el MVP). | Baja | **SHOULD (Hito 4)** | CU-010 |
| **RF-015** | Reporte de Ventas (por día/semana/mes, producto, categoría, ticket promedio y ranking) filtrado por permisos (`report.global_financial` / `report.branch_sales`). | Alta | **MUST (Hito 4)** | CU-013 |
| **RF-016** | Reporte Operativo (tiempos promedio de preparación y entrega, % éxito vs fallidas, demorados, motivos de cancelación) y panel de métricas propias del repartidor. | Alta | **MUST (Hito 4)** | CU-013 |
| **RF-017** | Reporte de Clientes (nuevos vs recurrentes, frecuencia, ticket por usuario y ranking Top). | Media | **MUST (Hito 4)** | CU-013 |
| **RF-018** | Captura de eventos de embudo de conversión (`funnel_events`: `IMPRESSION`, `MENU_VIEW`, `ADD_TO_CART`, `PURCHASE`); reporte visual fuera del MVP. | Baja | **SHOULD (Hito 4)** | CU-014 |
| **RF-019** | Gestión de pagos (`CASH`, `YAPE`, `BANK_TRANSFER`), validación humana de comprobantes, confirmación obligatoria del pago al restaurante (`restaurant_payouts`) antes del `handoff`, Regla de Liberación (`evaluateReleaseGate`), correcciones con auditoría y reembolsos manuales. | Crítica | **MUST (Hito 3)** | CU-007, CU-009 |
| **RF-020** | Libro mayor inmutable de garantía del repartidor (`wallet_entries`), bloqueo automático de efectivo por garantía insuficiente o deuda (`balance < 0`), adelantos con autorización humana (`rider_advances`) y liquidación diaria con corte a las `23:00 America/Lima` (`settlements`). | Crítica | **MUST (Hito 3)** | CU-008, CU-010, CU-012 |
| **RF-021** | Punto de extensión para promociones, cupones y combos (tablas `promotions` y `promotion_rules` creadas; UI fuera del MVP). | Baja | **Extensión (R3)** | CU-003 |
| **RF-023..27** | Punto de extensión de integración omnicanal con **Vocero CRM** y WhatsApp: `CrmPort`, `NotificationPort`, `VoceroCrmAdapter`, `/api/webhooks/[provider]` con firma HMAC, `inbound_events` y `outbox_events` detrás de feature flag. | Media | **Extensión en Hito 0 / Real en R1** | CU-015 |
| **RF-028** | Tablero Kanban operativo en tiempo real (polling con ETag/`updated_since` encapsulado en `useLiveOrders`) mostrando solo las columnas y transiciones permitidas al rol. | Alta | **MUST (Hito 2)** | CU-005, CU-008 |
| **RF-029** | Centro de alertas operativas deduplicadas (`alerts` con `dedupe_key`) y alerta sonora para pedidos nuevos (`NEW_ORDER`) y timeouts (`ACCEPTANCE_TIMEOUT`, `PREP_DELAY`, `NO_RIDER`). | Alta | **MUST (Hito 2–4)** | CU-005, CU-013 |
| **RF-030** | Búsqueda y filtrado avanzado de pedidos (por número, cliente, teléfono, sucursal, estado operativo, estado/método de pago, repartidor y rango de fechas). | Alta | **MUST (Hito 2)** | CU-004, CU-005 |
| **RF-031** | Bitácora de auditoría inmutable (`audit_logs` solo-inserción) de inicios de sesión, cambios de permisos, precios, pagos, liberaciones, transiciones, billetera y configuración. | Crítica | **MUST (Hito 0–4)** | Todos |
| **RF-032** | Exportación nativa en CSV por streaming (UTF-8 con BOM) respetando los mismos permisos del reporte; interfaz `Exporter` preparada para `xlsx` y `pdf`. | Alta | **MUST (Hito 4)** | CU-013 |

---

## 2. Requerimientos No Funcionales (RNF)

| ID | Categoría | Descripción | Métrica / Criterio de Aceptación | Estado |
|---|---|---|---|---|
| **RNF-001** | Usabilidad y PWA | Interfaz instalable como PWA (`manifest.webmanifest` + Service Worker) y mobile-first para `RIDER` y `BRANCH_MANAGER` con botones táctiles ≥ 44 px. | Instalable en Android/iOS/Desktop; estados con texto además de color. | `[DESIGNED]` |
| **RNF-002** | Rendimiento | Respuesta ágil en operaciones críticas de despacho y tablero Kanban. | Carga del Kanban < 1 s (p95) con 500 pedidos activos; transición de estado < 500 ms (p95) *(objetivos provisionales DECISION-10)*. | `[DESIGNED]` |
| **RNF-003** | Seguridad y RBAC | Autorización obligatoria en el servidor mediante `can()` en cada caso de uso y aislamiento por `tenant_id` y `branchIds`. | `0` endpoints mutables sin verificación `can()`; test CA-01 verde. | `[DESIGNED]` |
| **RNF-004** | Integridad Financiera | Prohibición de punto flotante para dinero y prohibición de `UPDATE`/`DELETE`/`TRUNCATE` en tablas de auditoría e historial contable. | 100% de columnas monetarias en `bigint` (céntimos); triggers `forbid_mutation()` verificados por tests de integración. | `[DESIGNED]` |
| **RNF-005** | Concurrencia e Idempotencia | Prevención de condiciones de carrera y duplicados en pedidos, transiciones, billetera y webhooks. | `SELECT ... FOR UPDATE` en `orders` y `riders`; índices `UNIQUE` en `idempotency_key` y `(provider, external_event_id)`. | `[DESIGNED]` |
| **RNF-006** | Privacidad y Minimización | Protección de datos personales del cliente según el rol y ausencia de PII (teléfonos/direcciones) en logs de aplicación (`pino`). | Tests de DTO verifican que `CustomerOrderDTO` no expone costos internos ni GPS, y que `RIDER` solo accede a pedidos asignados activos (CA-12). | `[DESIGNED]` |
| **RNF-007** | Localización (`es-PE`) | Adaptación completa a Perú: idioma Español (`es-PE`), moneda Soles (`S/ 1,234.50`), zona horaria `America/Lima`, validación de celular (`9 dígitos`), DNI (`8 dígitos`) y RUC (`11 dígitos`). | Diccionario i18n centralizado `es-PE` y utilidades `money`, `time` y `phone` cubiertas con tests unitarios. | `[DESIGNED]` |
| **RNF-008** | Mantenibilidad y Arquitectura | Monolito modular con fronteras limpias (`domain`, `application`, `infra`, `ui`) y configuración externalizada en tabla `settings`. | `pnpm typecheck`, `pnpm lint` y `pnpm test` en verde; parámetros `PENDIENTE` marcados con `is_placeholder = true`. | `[DESIGNED]` |
| **RNF-009** | Recuperación y Backups | Copias de seguridad periódicas de PostgreSQL y procedimiento verificado de restauración. | Scripts `scripts/backup.sh` y `scripts/restore.sh` + runbook en `docs/runbooks/backup-restore.md` (CA-15). | `[DESIGNED]` |
| **RNF-010** | Interoperabilidad con Vocero CRM | Desacoplamiento mediante puertos (`CrmPort`, `NotificationPort`), tabla `outbox_events` y verificación criptográfica HMAC-SHA256 (`X-Vocero-Signature`). | Fallos de Vocero CRM no abortan transacciones locales; eventos duplicados responden `200 OK` sin duplicar efectos (CA-13). | `[DESIGNED]` |
