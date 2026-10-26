# ADR 0001 — Elección de Stack Tecnológico y Versiones del MVP

- **Fecha:** 2026-10-26
- **Estado:** Accepted
- **Autor:** Arquitectura Zero Delivery

---

## 1. Contexto

El documento `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md` exige en su Sección 21 documentar las versiones exactas del stack y justificar cualquier conciliación entre las Secciones 2–4 (Monolito Modular en Next.js + PostgreSQL + Drizzle ORM) y las notas de la Sección 21. Asimismo, Zero Delivery convive en el mismo ecosistema con **Vocero CRM** (`../vocero-crm`), el cual utiliza Next.js 15, React 19, TypeScript 5.7, Drizzle ORM, PostgreSQL 16, Zod, Vitest, Playwright y `pnpm`.

## 2. Decisión de Versiones Fijadas

| Capa | Paquete / Tecnología | Versión | Justificación |
|---|---|---|---|
| **Runtime & Gestor** | Node.js / `pnpm` | Node `>=20`, `pnpm@11.5.0` | Homologado con `vocero-crm`. |
| **Framework Fullstack** | `next` / `react` / `react-dom` | `15.1.3` / `19.0.0` | App Router, Server Actions, Route Handlers tipados y compatibilidad directa con `vocero-crm`. |
| **Lenguaje** | `typescript` | `5.7.2` | `strict: true` + `noUncheckedIndexedAccess: true`. |
| **Base de Datos** | PostgreSQL | `16-alpine` | Soporte nativo para triggers append-only, `pg_trgm`, bloqueos `FOR UPDATE` y vistas contables. |
| **ORM & Migraciones** | `drizzle-orm` / `drizzle-kit` / `postgres` | `0.38.3` / `0.30.1` / `3.4.5` | Consultas SQL tipadas de bajo overhead y soporte para migraciones SQL con triggers personalizados. |
| **Validación** | `zod` | `3.24.1` | Validación compartida entre formularios, API `/api/v1/*`, variables de entorno y contratos con Vocero CRM. |
| **Estado Cliente & Caché** | `zustand` / `@tanstack/react-query` | `5.0.2` / `5.62.7` | Zustand para estado operativo local (filtros de Kanban, sonido de alertas) y TanStack Query para polling en tiempo real (`useLiveOrders`). |
| **Hashing de Contraseñas** | `@node-rs/argon2` (con fallback `scrypt` nativo en entornos sin binarios nativos) | `2.0.2` | Algoritmo Argon2id recomendado por OWASP (Sección 3 y 15 del Spec). |
| **Estilos & UI** | `tailwindcss` / `lucide-react` / `clsx` / `tailwind-merge` | `3.4.17` / `0.469.0` | Diseño responsive mobile-first para Repartidor/Encargado y escritorio para Coordinador/Admin. |
| **Testing** | `vitest` / `@playwright/test` | `2.1.8` / `1.61.1` | Pruebas unitarias de dominio rápidas y pruebas E2E de flujo completo. |

## 3. Conciliación con las Notas de la Sección 21

1. **Monolito Modular vs. Microservicios NestJS/MongoDB/Redis:** Se mantiene el **Monolito Modular en Next.js + PostgreSQL** (Secciones 2–4 y Regla 7 de la Sección 0: *"Prefiere simple y correcto sobre sofisticado. Un monolito modular bien separado, no microservicios"*). No se introducen MongoDB ni Redis en el MVP; el catálogo y el outbox residen en PostgreSQL con transacciones ACID.
2. **Prácticas Financieras y Transaccionales de la Sección 21 adoptadas al 100%:**
   - Dinero estrictamente en enteros de céntimos (`bigint`).
   - Libro mayor inmutable (`wallet_entries`) + vista de saldo (`v_rider_guarantee_balance`).
   - Llaves de idempotencia (`Idempotency-Key` UUID) en creación de pedidos y deduplicación en webhooks.
   - Bloqueos pesimistas (`SELECT ... FOR UPDATE`) y control de versión optimista (`orders.version`).
   - Estado cliente con Zustand + TanStack Query y prevención de múltiples clics en UI.
