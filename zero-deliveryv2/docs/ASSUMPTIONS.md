# Registro de Supuestos y Decisiones Pendientes (`ASSUMPTIONS.md`)

> Regla 3 y 4 de `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md`: Todo supuesto no cubierto explícitamente o contradicción entre documentos se registra aquí con fecha, supuesto y motivo. Las decisiones marcadas `PENDIENTE` (`DECISION-01` a `DECISION-10`) se parametrizan en `settings` con `is_placeholder = true`.

---

## 1. Supuestos Tomados

| ID | Fecha | Supuesto | Motivo / Referencia |
|---|---|---|---|
| **ASM-01** | 2026-10-26 | Se adopta el stack **Monolito Modular en Next.js 15 + PostgreSQL 16 + Drizzle ORM** de las Secciones 2–4 del Spec en lugar del stack de microservicios (NestJS + MongoDB + Redis) pegado al final de la Sección 21, conservando todas las garantías transaccionales de la Sección 21 (céntimos enteros, ledger inmutable, idempotencia UUID, `SELECT ... FOR UPDATE`, Zustand + TanStack Query). | Confirmado expresamente con el usuario durante la fase de planificación con `software-engineer-skill` y alineado con el stack de `vocero-crm`. |
| **ASM-02** | 2026-10-26 | El puerto de desarrollo local de Zero Delivery se configura en `3001` (`APP_BASE_URL=http://localhost:3001`) y PostgreSQL en `5433` en `docker-compose.yml`. | Evitar colisión de puertos cuando `vocero-crm` (`localhost:3000` y Postgres `5432`) y `zero-delivery` corran simultáneamente en la misma máquina. |
| **ASM-03** | 2026-10-26 | El contrato de integración con Vocero CRM implementa la especificación oficial de Vocero CRM 2.1 (`src/server/brains/contract.ts` y `docs/openapi.json`): recepción de `EventoDespacho` firmado con `X-Vocero-Signature: sha256=<HMAC-SHA256>` usando `VOCERO_BOT_API_KEY`, healthcheck en `GET /api/webhooks/vocero/health` y llamadas salientes a `/api/bot/{context,messages,ficha,stage,handoff,media}`. | Inspección directa del repositorio `C:\Users\Zero\Documents\max\zero-delivery\vocero-crm` (sin modificarlo). Permanece apagado por defecto mediante `settings['feature.integration.vocero'] = false`. |
| **ASM-04** | 2026-10-26 | El permiso del rol `SUPPORT_AGENT` (Empleado) para asignar repartidores (`order.assign_rider`) y crear adelantos (`advance.create`) se gobierna dinámicamente desde la tabla `settings` (`support.can_assign_rider = true`, `support.can_create_advance = false`). | Concilia la diferencia entre el texto original del RF-07 ("No puede asignar pedidos") y la matriz aprobada de la Sección 6 / Sección 16 (`support.can_assign_rider = true`). |
| **ASM-05** | 2026-10-26 | Para el hash de contraseñas se provee un adaptador Argon2id (`@node-rs/argon2`) con respaldo automático a `node:crypto` (`scrypt` con parámetros de alta seguridad) si el binario nativo no está compilado en el entorno de ejecución. | Garantiza que los tests y el seed funcionen en cualquier entorno Windows/Linux/CI sin bloqueos de compilación nativa. |

---

## 2. Decisiones Comerciales Pendientes Aisladas en Configuración (`TODO(DECISION-XX)`)

| Código | Descripción | Donde está aislado en el código | Valor Placeholder Actual |
|---|---|---|---|
| **DECISION-01** | Fórmula definitiva del margen de Zero Delivery e inclusión de descuentos/impuestos. | `src/modules/catalog/domain/pricing-policy.ts` (`ProvisionalPricingPolicy`) | `unit_price = base + packaging + margin` (`PROVISIONAL`) |
| **DECISION-02** | Monto mínimo de garantía, edad mínima de exención (35 años) y fórmula de `trust_score`. | `settings`: `rider.min_age_for_cash_without_guarantee`, `guarantee.min_cents` + `src/modules/logistics/domain/eligibility.ts` | `min_age = 35`, `guarantee.min_cents = 0` (`is_placeholder = true`) |
| **DECISION-03** | Fórmula definitiva de pago al repartidor y conciliación de diferencias de efectivo. | `src/modules/wallet/domain/ledger.ts` (`rider_fee_reference_cents` vs `rider_fee_payable_cents`) | Editable con motivo por el Coordinador |
| **DECISION-04** | Permiso de `BRANCH_MANAGER` para ver ventas de su sucursal y de `COORDINATOR` para ver embudo. | `settings`: `reports.branch_manager_can_view_sales`, `reports.coordinator_can_view_funnel` | `false` (`is_placeholder = true`) |
| **DECISION-05** | Umbrales de tiempo para alerta de aceptación, demora de preparación y falta de repartidor. | `settings`: `order.acceptance_timeout_minutes` (5), `order.prep_delay_threshold_minutes` (30), `order.no_rider_threshold_minutes` (10) | `5`, `30`, `10` min (`is_placeholder = true`) |
| **DECISION-06** | Aprobación formal del catálogo final de estados y transiciones por rol. | `src/modules/orders/domain/transitions.ts` (`ORDER_TRANSITIONS`) | Tabla declarativa de 15 estados |
| **DECISION-07** | Acción posterior a los 15 minutos de espera del repartidor en el restaurante. | `settings`: `rider.pickup_wait_minutes` (15) | Solo genera alerta al Coordinador |
| **DECISION-08** | Definición o retiro definitivo de `RF-22`. | No implementado (prohibido inventar su contenido según Sección 16/20). | N/A |
| **DECISION-09** | Activación en producción de la integración con Vocero CRM y plantillas de WhatsApp. | `settings`: `feature.integration.vocero`, `feature.integration.whatsapp` | `false` |
| **DECISION-10** | Objetivos definitivos de SLA, disponibilidad, RPO/RTO y retención de datos. | `docs/engineering/07-requerimientos.md` | Kanban < 1s p95, transición < 500ms p95 |
