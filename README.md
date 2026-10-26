# Zero Delivery

Plataforma de delivery multi-restaurante: pedidos, pagos anticipados, reparto con garantías, liquidaciones y reportería por rol. Interopera con **Vocero CRM** para la conversación por WhatsApp.

- **Stack:** Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL 16 · Drizzle ORM
- **Idioma:** español (Perú) · **Moneda:** soles, en céntimos enteros · **Zona horaria:** UTC en base, `America/Lima` en operación

> **Estado real:** la aplicación hoy tiene **login único con 5 roles**, un **dashboard informativo**, una **pantalla de repartidor** también informativa y dos páginas públicas vacías. Las pantallas operativas (Kanban, pagos, liquidaciones, reportes) están **documentadas y diseñadas, no implementadas**. Ver [`docs/roles/00-COMUN.md`](./zero-deliveryv2/docs/roles/00-COMUN.md).

---

## Estructura de carpetas

```
zero-delivery/
├── .agents/skills/                  # 41 skills reutilizables del agente (referencia, no se ejecuta)
│
├── zero-deliveryv2/                 # ★ APLICACIÓN ACTUAL
│   ├── src/
│   │   ├── app/                     # rutas Next.js (App Router)
│   │   │   ├── (auth)/login/        # login único
│   │   │   ├── (staff)/dashboard/   # panel del staff (informativo)
│   │   │   ├── (rider)/deliveries/  # PWA del repartidor (informativa)
│   │   │   ├── (public)/m/[branchSlug]/   # carta pública
│   │   │   ├── (public)/p/[publicToken]/  # seguimiento público
│   │   │   └── api/                 # login, logout, health, webhooks
│   │   ├── modules/                 # lógica de dominio, un directorio por módulo
│   │   │   ├── identity/            # usuarios, sesiones, roles y 47 permisos
│   │   │   ├── orders/              # pedidos, transiciones, regla de liberación
│   │   │   ├── payments/            # pagos, validación, reembolsos
│   │   │   ├── logistics/           # entregas, intentos, elegibilidad del rider
│   │   │   ├── wallet/              # libro mayor inmutable de garantías
│   │   │   ├── catalog/             # productos, precios, margen
│   │   │   ├── customers/           # clientes, segmentos, riesgo
│   │   │   ├── tenancy/             # inquilinos, sucursales, horarios
│   │   │   ├── settings/            # 18 claves de configuración
│   │   │   ├── reporting/           # datasets y exportación CSV
│   │   │   ├── alerts/              # alertas operativas
│   │   │   ├── audit/               # auditoría inmutable
│   │   │   └── integrations/        # contrato y adaptador de Vocero CRM
│   │   ├── db/                      # schema Drizzle y cliente PostgreSQL
│   │   ├── shared/                  # dinero, fechas, teléfono, errores, logs, i18n
│   │   └── worker/                  # entrypoint de jobs (outbox)
│   ├── drizzle/                     # migraciones SQL
│   │   ├── 0000_initial_zero_delivery.sql      # esquema inglés (lo usa la app)
│   │   └── 0001_esquema_zero_delivery_es.sql   # esquema español (propuesto, no aplicado)
│   ├── scripts/                     # seed, backup, restore
│   ├── tests/                       # unit, integration, e2e (Playwright)
│   ├── docs/                        # documentación (ver abajo)
│   ├── Dockerfile · docker-compose.yml
│   └── README.md                    # arranque técnico detallado
│
├── zero-delivery/                   # VERSIÓN ANTERIOR (monorepo vacío: apps y packages sin código)
│   ├── apps/{api,web}/              # solo package.json, sin implementación
│   ├── packages/{config,database,shared-types}/
│   ├── docs/                        # misma documentación, copia previa
│   └── 0001_esquema_zero_delivery_es.sql
│
├── ZERO_DELIVERY_MVP_BUILD_SPEC.md  # especificación funcional del MVP
├── logica de negocioZERO_DELIVERY.md # borrador de reglas de negocio
├── zero_delivery_schema v1 no oficial.sql # esquema inicial descartado
└── docker-compose.vocero.yml        # stack de Vocero CRM (servicio externo)
```

### Qué mirar primero

| Quiero… | Ir a |
|---|---|
| Entender las reglas del negocio | [`zero-deliveryv2/docs/LOGICA_DE_NEGOCIO_Y_PERMISOS.md`](./zero-deliveryv2/docs/LOGICA_DE_NEGOCIO_Y_PERMISOS.md) |
| Saber qué ve cada rol | [`zero-deliveryv2/docs/roles/README.md`](./zero-deliveryv2/docs/roles/README.md) |
| Entender la integración con Vocero | [`zero-deliveryv2/docs/roles/06-VOCERO_CRM.md`](./zero-deliveryv2/docs/roles/06-VOCERO_CRM.md) |
| Ver arquitectura, API y diagramas | [`zero-deliveryv2/docs/engineering/INDEX.md`](./zero-deliveryv2/docs/engineering/INDEX.md) |
| Levantar el proyecto | [`zero-deliveryv2/README.md`](./zero-deliveryv2/README.md) y esta guía |

### Documentación dentro de `zero-deliveryv2/docs/`

| Archivo / carpeta | Contenido |
|---|---|
| `LOGICA_DE_NEGOCIO_Y_PERMISOS.md` | Reglas, 5 roles, matriz de 47 permisos, estados, pagos, garantía, configuración |
| `PANTALLAS_ROLES_Y_VOCERO.md` | Índice de compatibilidad (el contenido vive en `roles/`) |
| `roles/README.md` | Índice por rol y convenciones (✅ implementado · 🟡 parcial · ⬜ diseñado) |
| `roles/00-COMUN.md` | Login único, sesión, rutas, detalle de pedido, brechas |
| `roles/01-ADMINISTRADOR.md` … `05-REPARTIDOR.md` | Un archivo por rol: menú, pantallas, datos, acciones y permisos |
| `roles/06-VOCERO_CRM.md` | Webhook, HMAC, idempotencia, adaptador, ficha, handoff, cola muerta |
| `engineering/` | Arquitectura C4, casos de uso, modelo de dominio, ER, API, estados, secuencias, riesgos |
| `adr/0001-stack.md` · `plans/` · `runbooks/` | Decisiones técnicas, plan de implementación, backup/restore |
| `ZERO_DELIVERY_MVP_BUILD_SPEC.md` · `ASSUMPTIONS.md` · `CHANGELOG.md` | Especificación, supuestos y cambios |

---

## Cómo ejecutar

Requisitos: **Node ≥ 20**, **pnpm 9.15.4** (`corepack enable`) y **Docker** (o un PostgreSQL 16 propio).

```bash
cd zero-deliveryv2
corepack enable
pnpm install
docker compose up -d postgres      # PostgreSQL en localhost:5433, esquema inicial automático
cp .env.example .env               # PowerShell: Copy-Item .env.example .env
pnpm seed                          # crea inquilino, sucursal, rider y los 5 usuarios
pnpm dev                           # http://localhost:3001
```

**Usuarios de prueba** (contraseña `ZeroDelivery2026!`):

| Usuario | Rol | Destino tras login |
|---|---|---|
| `admin` | Administrador | `/dashboard` |
| `coord.lima` | Coordinador | `/dashboard?view=kanban` |
| `encargado.miraflores` | Encargado | `/dashboard?view=branch` |
| `soporte.1` | Empleado | `/dashboard?view=support` |
| `rider.carlos` | Repartidor | `/deliveries` |

Verificación rápida:

```bash
curl http://localhost:3001/api/v1/health
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"zero-delivery","username":"admin","password":"ZeroDelivery2026!"}'
```

Comandos útiles: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm test:e2e` · `pnpm build`.

---

## Lo que no está en el repositorio

| Excluido | Motivo |
|---|---|
| `node_modules/`, `.next/`, `coverage/` | Artefactos de build; se regeneran con `pnpm install` |
| `.env` | Secretos reales. Solo se versiona `.env.example` |
| `vocero-crm/` | Es un repositorio aparte (`github.com/kevinrivm/vocero-crm`), no forma parte de este monorepo |
| `*.pem`, `*.key`, `.storage/`, `backups/` | Credenciales y datos locales |

> Sin `pnpm seed` la base queda vacía y el login responde `401 INVALID_CREDENTIALS`.

---

## Reglas que el código respeta

- **Un solo login**; el servidor decide el destino según el rol.
- **La UI no autoriza:** todo pasa por `can(actor, permiso, recurso, settings)`.
- **Aislamiento:** por inquilino, por sucursal (Encargado) y por asignación (Repartidor).
- **Dinero en céntimos enteros**, nunca `float`.
- **Auditoría y libro mayor inmutables:** no se editan ni se borran.
- **Ninguna automatización decide dinero:** pagos, correcciones, reembolsos y liquidaciones son humanos.
- **Vocero conversa; Zero Delivery opera.**

---

## Integración con Vocero CRM

Contrato `EventoDespacho` con firma `X-Vocero-Signature` (HMAC-SHA256) y adaptador saliente hacia `/api/bot/*`. Está **apagada por defecto** (`feature.integration.vocero = false`).

Estado: contrato, firma, webhook, healthcheck y adaptador implementados; **persistencia de eventos, worker de outbox y UI pendientes**. No encender sin completar el checklist de [`06-VOCERO_CRM.md`](./zero-deliveryv2/docs/roles/06-VOCERO_CRM.md).

---

## Notas de compatibilidad

- El **esquema español** `0001_esquema_zero_delivery_es.sql` **no es compatible** con la app actual (roles, estados y claves en inglés). Requiere alinear `schema.ts`, login, seed y settings antes de usarlo.
- `docker compose` aplica `0000_initial_zero_delivery.sql` **solo al crear el volumen**. Si el volumen ya existe, no se re-aplica: borrar con `docker compose down -v` para reinicializar.
- En Windows, `cp` y los scripts `.sh` requieren PowerShell (`Copy-Item`) o Git Bash/WSL.
- Si el puerto `5433` está ocupado, cambiar `POSTGRES_PORT` en el compose y `DATABASE_URL` en `.env`.
