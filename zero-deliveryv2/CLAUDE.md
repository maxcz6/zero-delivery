# Zero Delivery — Guía para Agentes de Codificación (`CLAUDE.md`)

Lee primero [`docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md`](./docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md) y el índice de ingeniería [`docs/engineering/INDEX.md`](./docs/engineering/INDEX.md).

## Reglas Inviolables

1. **Monolito Modular con Fronteras Estrictas**:
   - `src/modules/<modulo>/domain/` no importa nada de `src/db`, Next.js ni `infra/`.
   - `src/app/` solo llama a `src/modules/<modulo>/application` o a la API pública `src/modules/<modulo>/index.ts`.
2. **Autorización Siempre en Servidor**:
   - Toda acción pasa por `can(actor, action, resource, settings)` en `src/modules/identity/domain/permissions.ts`.
3. **Dinero y Contabilidad Inmutable**:
   - Todo importe monetario va en **céntimos enteros (`bigint` / `Cents`)**. Prohibido usar `float`.
   - `wallet_entries`, `payment_events`, `order_status_history` y `audit_logs` son **solo-inserción** (reforzado con triggers `forbid_mutation()` en PostgreSQL).
4. **Regla de Liberación (`evaluateReleaseGate`)**:
   - Ningún pedido pasa a `ON_THE_WAY` sin repartidor elegible, pago anticipado validado por humano (`PAID`), pago al restaurante confirmado (`CONFIRMED`) y `handoff_at` registrado por el Encargado.
5. **Interoperabilidad con Vocero CRM (`../vocero-crm`)**:
   - Nunca modifiques la base de datos de Vocero CRM directamente ni saques el token de WhatsApp de Vocero CRM.
   - Toda comunicación usa el webhook firmado (`X-Vocero-Signature: sha256=<HMAC>`) y los endpoints `/api/bot/*` a través de `VoceroCrmAdapter` detrás del flag `feature.integration.vocero`.

## Gate Técnico Obligatorio

```bash
pnpm typecheck && pnpm lint && pnpm test
```
