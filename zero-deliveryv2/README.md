# Zero Delivery — Plataforma Multi-Restaurante y Logística de Delivery

Plataforma operativa progresiva (**PWA + API `/api/v1`**) para gestión de múltiples restaurantes, sucursales, catálogo con modificadores, validación de pagos anticipados, **Regla de Liberación**, logística de repartidores, **libro mayor inmutable de garantías (`wallet_entries`)** y reportería por rol.

Diseñada desde la base para interoperar bidireccionalmente con **Vocero CRM** (`../vocero-crm`) a través de su contrato oficial de despacho (`X-Vocero-Signature` HMAC-SHA256) y su API `/api/bot/*`.

---

## Documentación de Ingeniería (`software-architect`)

Toda la planificación arquitectónica generada con `software-engineer-skill` se encuentra en [`docs/engineering/INDEX.md`](./docs/engineering/INDEX.md):

- [01 — Arquitectura del Sistema (C4)](./docs/engineering/01-arquitectura-sistema.md)
- [02 — Casos de Uso (`CU-001` a `CU-015`)](./docs/engineering/02-casos-de-uso.md)
- [03 — Modelo de Dominio](./docs/engineering/03-modelo-dominio.md)
- [04 — Diagrama ER Físico PostgreSQL](./docs/engineering/04-diagrama-er.md)
- [05 — Catálogo de API y Contratos Vocero CRM](./docs/engineering/05-catalogo-api.md)
- [06 — Diagramas de Estado](./docs/engineering/06-diagramas-estado.md)
- [07 — Requerimientos (`RF` y `RNF`)](./docs/engineering/07-requerimientos.md)
- [08 — Matriz de Trazabilidad](./docs/engineering/08-matriz-trazabilidad.md)
- [09 — Diagramas de Secuencia](./docs/engineering/09-diagramas-secuencia.md)
- [10 — Diagramas de Actividad](./docs/engineering/10-diagramas-actividad.md)
- [11 — Mapa de Errores](./docs/engineering/11-mapa-errores.md)
- [12 — Matriz de Riesgos](./docs/engineering/12-matriz-riesgos.md)
- [13 — Decisiones Técnicas (ADR)](./docs/engineering/13-decisiones-tecnicas.md)
- [Plan de Implementación por Fases](./docs/plans/2026-10-26-implementation-plan.md)

---

## Cómo Ejecutar el Proyecto

```bash
pnpm install
docker compose up -d postgres
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
pnpm seed                   # sin esto el login responde 401: la base queda vacía
pnpm typecheck && pnpm lint && pnpm test
pnpm dev
```

La aplicación corre en `http://localhost:3001` (y PostgreSQL en el puerto `5433`) para poder ejecutarse en paralelo con `vocero-crm` (`http://localhost:3000` y puerto `5432`) sin colisión de puertos.
