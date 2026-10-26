# Zero Delivery — Índice de Documentación de Ingeniería (`software-architect`)

> **Modo:** Prospectivo (`[DESIGNED]`) · **Fecha:** 2026-10-26 · **Interoperabilidad:** Diseñado para operar junto a `vocero-crm` (`C:\Users\Zero\Documents\max\zero-delivery\vocero-crm`)

---

## Catálogo de Secciones Generadas

| # | Documento | Descripción | Estado |
|---|---|---|---|
| **01** | [01-arquitectura-sistema.md](./01-arquitectura-sistema.md) | Diagramas C4 (Contexto y Contenedores), arquitectura modular e integración bidireccional con Vocero CRM. | `[DESIGNED]` |
| **02** | [02-casos-de-uso.md](./02-casos-de-uso.md) | 15 Casos de Uso detallados (`CU-001` a `CU-015`) con happy path, flujos alternativos y excepciones. | `[DESIGNED]` |
| **03** | [03-modelo-dominio.md](./03-modelo-dominio.md) | Modelo conceptual de dominio (`classDiagram`) y responsabilidades de negocio por entidad. | `[DESIGNED]` |
| **04** | [04-diagrama-er.md](./04-diagrama-er.md) | Modelo físico PostgreSQL 16 (`erDiagram`), tipos en céntimos (`bigint`), triggers append-only e índices. | `[DESIGNED]` |
| **05** | [05-catalogo-api.md](./05-catalogo-api.md) | Contratos REST `/api/v1/*`, webhooks entrantes `/api/webhooks/vocero` (HMAC) y llamadas a `/api/bot/*` de Vocero CRM. | `[DESIGNED]` |
| **06** | [06-diagramas-estado.md](./06-diagramas-estado.md) | Máquinas de estado de pedidos (15 estados operativos), pagos, abono a restaurante, repartidores, liquidaciones y outbox. | `[DESIGNED]` |
| **07** | [07-requerimientos.md](./07-requerimientos.md) | Catálogo completo de Requerimientos Funcionales (`RF-001` a `RF-032`) y No Funcionales (`RNF-001` a `RNF-010`). | `[DESIGNED]` |
| **08** | [08-matriz-trazabilidad.md](./08-matriz-trazabilidad.md) | Matriz de trazabilidad cruzando `RF`/`RNF` × `CU-001..015` × Criterios de Aceptación (`CA-01` a `CA-15`). | `[DESIGNED]` |
| **09** | [09-diagramas-secuencia.md](./09-diagramas-secuencia.md) | Diagramas de secuencia de creación idempotente, Regla de Liberación, cobro en efectivo/ledger e integración con Vocero CRM. | `[DESIGNED]` |
| **10** | [10-diagramas-actividad.md](./10-diagramas-actividad.md) | Diagramas de flujo de proceso para `evaluateReleaseGate`, `canAssignRider` y entregas fallidas/devoluciones. | `[DESIGNED]` |
| **11** | [11-mapa-errores.md](./11-mapa-errores.md) | Catálogo estandarizado de códigos de error, severidades, logs seguros sin PII y recuperación. | `[DESIGNED]` |
| **12** | [12-matriz-riesgos.md](./12-matriz-riesgos.md) | Evaluación y mitigación de los 10 principales riesgos técnicos, transaccionales y financieros (`RT-001` a `RT-010`). | `[DESIGNED]` |
| **13** | [13-decisiones-tecnicas.md](./13-decisiones-tecnicas.md) | Registro de Decisiones de Arquitectura (`ADR-001` a `ADR-005`). | `[DESIGNED]` |

---

## Documentos Complementarios de Ingeniería y Operación

- **Especificación Maestra del MVP:** [../ZERO_DELIVERY_MVP_BUILD_SPEC.md](../ZERO_DELIVERY_MVP_BUILD_SPEC.md)
- **Plan de Implementación por Fases (Puente a Implementación):** [../plans/2026-10-26-implementation-plan.md](../plans/2026-10-26-implementation-plan.md)
- **ADR de Stack y Versiones Fijadas:** [../adr/0001-stack.md](../adr/0001-stack.md)
- **Registro de Supuestos (`ASSUMPTIONS.md`):** [../ASSUMPTIONS.md](../ASSUMPTIONS.md)
- **Historial de Cambios (`CHANGELOG.md`):** [../CHANGELOG.md](../CHANGELOG.md)
- **Runbook de Backups y Restauración:** [../runbooks/backup-restore.md](../runbooks/backup-restore.md)
