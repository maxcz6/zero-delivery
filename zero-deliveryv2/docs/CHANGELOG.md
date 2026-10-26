# Changelog — Zero Delivery

Todos los cambios relevantes por hito se registran en este documento.

---

## [0.1.0-mvp] — 2026-10-26 (Planificación + Hito 0: Fundación)

### Planificación de Ingeniería (`software-architect`)
- Generadas las 13 secciones de documentación de ingeniería en `docs/engineering/` (`01-arquitectura-sistema.md` a `13-decisiones-tecnicas.md` + `INDEX.md`).
- Generado el plan de implementación por fases en `docs/plans/2026-10-26-implementation-plan.md`.
- Documentados `docs/adr/0001-stack.md`, `docs/ASSUMPTIONS.md` y `docs/runbooks/backup-restore.md`.

### Hito 0 — Fundación e Interoperabilidad con Vocero CRM
- Estructura base del monolito modular creada en `src/modules/*`, `src/shared/*`, `src/db/*`, `src/worker/*` y `src/app/*`.
- Esquema completo de PostgreSQL 16 en Drizzle ORM (`src/db/schema.ts`) y migración SQL inicial (`drizzle/0000_initial_zero_delivery.sql`) con triggers append-only (`forbid_mutation`), contadores por tenant (`next_counter`) y configuración inicial (`seed_default_settings`).
- Utilidades transversales implementadas y probadas: `money` (céntimos enteros `PEN`), `time` (`America/Lima`), `phone` (normalización `E.164` Perú `+519XXXXXXXX`, DNI, RUC), `errors`, `result`, `logger` y diccionario `i18n` (`es-PE`).
- Motor de autorización RBAC centralizado `can(actor, action, resource, settings)` en `src/modules/identity/domain/permissions.ts` con test table-driven cubriendo los 5 roles y las 37 acciones de la matriz oficial.
- Lógica pura de dominio implementada y probada:
  - Máquina de estados declarativa (`ORDER_TRANSITIONS`) y evaluador de transiciones.
  - Regla de liberación `evaluateReleaseGate()`.
  - Elegibilidad de repartidor `canAssignRider()` (vehículo para frágiles, deuda, exención por edad ≥ 35 o `high_trust`, saldo de garantía).
  - Política de precios aislada `ProvisionalPricingPolicy` (`TODO(DECISION-01)`).
  - Separación de DTOs (`toCustomerOrderDTO` vs `toStaffOrderDTO` vs `toBranchManagerOrderDTO`) garantizando no-fuga de costos internos ni coordenadas GPS.
- Adaptador `VoceroCrmAdapter` y verificación criptográfica HMAC-SHA256 (`verifyVoceroSignature` compatible con `src/server/brains/contract.ts` de `vocero-crm`) junto con los endpoints `/api/webhooks/[provider]` y `/api/webhooks/vocero/health` protegidos por el feature flag `feature.integration.vocero`.
- Autenticación por sesión (`login`/`logout`/`me`), layouts diferenciados por rol (`/(staff)`, `/(rider)`, `/(public)`), manifest PWA y script de `seed`.
