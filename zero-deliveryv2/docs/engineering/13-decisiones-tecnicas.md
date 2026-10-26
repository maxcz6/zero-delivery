# 13 — Decisiones Técnicas de Arquitectura (ADR)

> **Estado:** `[DESIGNED]` · **Versión:** 1.0-mvp · **Fuente:** `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md` + análisis comparativo con `vocero-crm`

---

## ADR-001: Monolito Modular en Next.js 15 + PostgreSQL + Drizzle ORM frente a Microservicios Políglotas

- **Fecha:** 2026-10-26
- **Estado:** Accepted
- **Contexto:**
  En `ZERO_DELIVERY_MVP_BUILD_SPEC.md` coexistían dos descripciones arquitectónicas: las Secciones 2–4 especifican un **Monolito Modular** en Next.js (App Router) + TypeScript estricto + PostgreSQL + Drizzle ORM + `pg-boss`, mientras que el bloque final de la Sección 21 mencionaba un stack de microservicios (Next.js BFF + NestJS + PostgreSQL/PostGIS + MongoDB + Redis). Además, el sistema hermano con el que debe comunicarse (`vocero-crm`) ya está construido y probado en producción con **Next.js 15 + React 19 + TypeScript estricto + PostgreSQL 16 + Drizzle ORM + Zod + Vitest + Playwright + pnpm**.
- **Decisión:**
  Adoptar la arquitectura de **Monolito Modular en Next.js 15 (App Router) + PostgreSQL 16 + Drizzle ORM** (Secciones 2–4 del Spec), incorporando las prácticas de robustez transaccional de la Sección 21 (enteros en céntimos, libro mayor inmutable con caché visual en vista SQL, llaves de idempotencia UUID, bloqueos pesimistas `SELECT ... FOR UPDATE`, Zustand + TanStack Query en el cliente y protección contra múltiples clics).
- **Alternativas consideradas:**
  1. *Microservicios NestJS + MongoDB + Redis + PostGIS desde el día 1:* Rechazado para el MVP porque rompe las transacciones ACID entre pedidos, pagos y asientos de billetera (`wallet_entries`), multiplica el consumo de RAM en un único VPS y duplica el esfuerzo operativo respecto a `vocero-crm`.
  2. *Monorepo con backend NestJS separado pero única BD Postgres:* Descartado por ahora porque Next.js App Router + módulos con fronteras estrictas (`src/modules/*/domain|application|infra|ui`) permite exponer `/api/v1/*` para futuras apps móviles y extraer `src/worker` cuando sea necesario sin sobrecarga inicial.
- **Consecuencias:**
  - **Positivas:** Transacciones ACID reales entre estado del pedido, cobro en efectivo, libro mayor de garantía y `outbox_events`; homologación total de herramientas con `vocero-crm`; menor consumo de recursos en VPS.
  - **Negativas / Guardarraíles:** Requiere hacer cumplir estrictamente las fronteras entre módulos mediante reglas de arquitectura y tests para evitar acoplamiento entre UI e infraestructura.

---

## ADR-002: Contabilidad en Céntimos Enteros y Libro Mayor Inmutable (Append-Only Ledger)

- **Fecha:** 2026-10-26
- **Estado:** Accepted
- **Contexto:**
  Zero Delivery administra dinero de terceros (restaurantes), tarifas de entrega, garantías de repartidores, cobros en efectivo contra entrega, adelantos de combustible y liquidaciones diarias. Cualquier edición destructiva o error de coma flotante genera descuadres financieros imposibles de auditar.
- **Decisión:**
  1. Todos los importes monetarios se almacenan como `bigint` en **céntimos enteros** (`PEN`, `S/ 15.50` = `1550`).
  2. La billetera de garantía del repartidor se modela como un libro mayor de solo-inserción (`wallet_entries`) con 5 tipos de asiento (`GUARANTEE_DEPOSIT (+)`, `GUARANTEE_WITHDRAWAL (-)`, `CASH_COLLECTED (-)`, `CASH_SETTLED (+)`, `ADJUSTMENT (±)`).
  3. Las tablas `wallet_entries`, `payment_events`, `order_status_history` y `audit_logs` tienen triggers en PostgreSQL (`forbid_mutation()`) que bloquean `UPDATE`, `DELETE` y `TRUNCATE`.
  4. Toda operación sobre la billetera de un repartidor adquiere primero un bloqueo pesimista `SELECT id FROM riders WHERE id = $1 FOR UPDATE`.
- **Alternativas consideradas:**
  - *Columna `balance` mutable en la tabla `riders` actualizada con `SET balance = balance - x`:* Rechazado por falta de trazabilidad ante disputas y riesgo de pérdida de actualizaciones concurrentes.
- **Consecuencias:**
  - **Positivas:** Trazabilidad contable perfecta; el saldo actual es siempre derivable mediante `SUM(amount_cents)` (expuesto también en la vista `v_rider_guarantee_balance`); un error humano solo se revierte con un contra-asiento `ADJUSTMENT` con motivo obligatorio y autor.

---

## ADR-003: Máquina de Estados Explícita y Doble Barrera en la Regla de Liberación

- **Fecha:** 2026-10-26
- **Estado:** Accepted
- **Contexto:**
  El negocio exige que la preparación en cocina no se detenga por un pago anticipado pendiente, pero **prohíbe terminantemente** que el pedido salga del local (`ON_THE_WAY`) si: (a) no hay repartidor elegible asignado, (b) el pago Yape/transferencia no fue validado por un humano, (c) el pago al restaurante no fue confirmado (`restaurant_payout_status = 'CONFIRMED'`), o (d) el encargado no registró la entrega física (`handoff_at`).
- **Decisión:**
  1. Modelar la máquina de estados como una tabla declarativa de transiciones (`ORDER_TRANSITIONS` en `src/modules/orders/domain/transitions.ts`) evaluada por funciones puras (`evaluateReleaseGate`, `canAssignRider`).
  2. Reforzar la regla directamente en PostgreSQL mediante los constraints `orders_handoff_requires_payout_chk` y `orders_dispatch_gate_chk`.
  3. Ejecutar cada transición con `SELECT ... FOR UPDATE` y control de versión optimista (`orders.version`).
- **Consecuencias:**
  - **Positivas:** Es imposible saltarse la Regla de Liberación ni desde la UI, ni invocando la API directamente, ni por un bug en un controlador secundario.

---

## ADR-004: Contrato de Interoperabilidad con Vocero CRM vía Despacho HMAC y `/api/bot/*`

- **Fecha:** 2026-10-26
- **Estado:** Accepted
- **Contexto:**
  En `C:\Users\Zero\Documents\max\zero-delivery\vocero-crm` reside Vocero CRM 2.1, el cual gobierna la conexión oficial con WhatsApp Cloud API (y opcionalmente Instagram, Messenger y TikTok). Por principio constitucional de Vocero CRM, **el token de WhatsApp jamás sale de Vocero CRM**: los sistemas externos reciben eventos mediante el contrato de despacho firmado (`X-Vocero-Signature: sha256=<HMAC>`) y responden o consultan adjuntos a través de `/api/bot/*` autenticándose con `X-API-Key: <BOT_API_KEY>`.
- **Decisión:**
  1. Implementar en `src/modules/integrations/` los puertos `CrmPort` y `NotificationPort` junto con el adaptador `VoceroCrmAdapter` que consume los endpoints reales de Vocero CRM (`/api/bot/context`, `/api/bot/messages`, `/api/bot/ficha`, `/api/bot/stage`, `/api/bot/handoff`, `/api/bot/media/{mediaId}`).
  2. Implementar el receptor `/api/webhooks/[provider]` con soporte nativo para la verificación de firma `X-Vocero-Signature` (`sha256=<hmac>`) idéntica a `src/server/brains/contract.ts` de Vocero CRM y el endpoint `/api/webhooks/vocero/health` para satisfacer `BRAIN_HEALTH_URL`.
  3. Mantener esta integración protegida detrás del feature flag configurable `feature.integration.vocero` (`false` por defecto en el MVP), usando `inbound_events` para idempotencia de entrada y `outbox_events` para resiliencia de salida.
- **Consecuencias:**
  - **Positivas:** No se modifica ni una sola línea de `vocero-crm`; cuando se active el flag en R1, ambos sistemas se conectarán de inmediato usando el protocolo nativo de Vocero 2.x.

---

## ADR-005: Autorización Centralizada (`can()`) y Aislamiento Multi-Tenant / Alcance de Sucursal

- **Fecha:** 2026-10-26
- **Estado:** Accepted
- **Contexto:**
  Conviven usuarios de la agencia (`ADMIN`, `COORDINATOR`, `SUPPORT_AGENT`), usuarios externos de restaurantes independientes (`BRANCH_MANAGER`) y repartidores (`RIDER`). Además, existen permisos sujetos a parámetros configurables (`support.can_assign_rider`, `reports.branch_manager_can_view_sales`, etc.).
- **Decisión:**
  Centralizar el 100% de las reglas de autorización en `src/modules/identity/domain/permissions.ts` mediante la función pura `can(actor, action, resource, settings)` verificada por una suite de pruebas table-driven que cubre las 5 × 37 combinaciones de la matriz oficial.
- **Consecuencias:**
  - **Positivas:** Seguridad auditable en un único archivo; imposibilidad de escalar privilegios manipulando el cliente web.
