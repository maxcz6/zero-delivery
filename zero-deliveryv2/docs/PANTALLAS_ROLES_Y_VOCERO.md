# Zero Delivery — Opciones y pantallas por rol + integración con Vocero CRM

> **Este documento fue dividido.** El contenido completo ahora vive en [`docs/roles/`](./roles/README.md), un archivo por rol. Este archivo queda como índice de compatibilidad para enlaces antiguos.
>
> Fecha de división: 2026-10-26

---

## Índice nuevo

| Archivo | Contenido | Para quién |
|---|---|---|
| [`roles/README.md`](./roles/README.md) | Índice general, convenciones de estado y ruta de lectura | Todos |
| [`roles/00-COMUN.md`](./roles/00-COMUN.md) | Login único, sesión, navegación, mapa de rutas, detalle de pedido compartido, pantallas públicas, patrones de UI, matriz pantalla × permiso y brechas | Todos |
| [`roles/01-ADMINISTRADOR.md`](./roles/01-ADMINISTRADOR.md) | 21 pantallas del Administrador: usuarios, configuración, catálogo, pagos, finanzas, reportes y auditoría | Administrador |
| [`roles/02-COORDINADOR.md`](./roles/02-COORDINADOR.md) | Operación global: Kanban, asignación, cancelaciones, pagos, garantías, liquidaciones e incidencias | Coordinador |
| [`roles/03-ENCARGADO.md`](./roles/03-ENCARGADO.md) | Cola de cocina y sucursal: aceptar, preparar, listo, handoff, horarios y devoluciones | Encargado |
| [`roles/04-EMPLEADO.md`](./roles/04-EMPLEADO.md) | Atención al cliente: pedido manual, pagos, notas, direcciones, clientes y consultas | Empleado |
| [`roles/05-REPARTIDOR.md`](./roles/05-REPARTIDOR.md) | PWA móvil: entregas, intentos, cobro en efectivo, billetera, métricas y perfil | Repartidor |
| [`roles/06-VOCERO_CRM.md`](./roles/06-VOCERO_CRM.md) | Integración completa: webhook entrante, firma HMAC, idempotencia, adaptador saliente, ficha, handoff, medios y errores | Administrador y desarrollo |

---

## Qué cambió respecto al documento anterior

- El contenido no se reescribió: se repartió por rol.
- `roles/00-COMUN.md` concentra lo que aplica a todos (login, navegación, detalle de pedido, brechas).
- Cada archivo de rol es autocontenido: ámbito, menú, pantallas con ID, datos visibles, acciones, estados vacíos, restricciones y tabla de permisos.
- `roles/06-VOCERO_CRM.md` conserva la integración completa en un solo lugar.
- No se modificó la aplicación ni el SQL; solo documentación.

---

## Reglas que no cambiaron

- **Un solo login** en `/login`; el servidor redirige según el rol.
- **La UI no autoriza:** toda acción pasa por `can(actor, permiso, recurso, settings)` en el servidor.
- **Aislamiento por inquilino** y por sucursal/asignación según el rol.
- **Dinero en céntimos enteros**; auditoría y libro mayor inmutables.
- **Ninguna automatización decide dinero.**
- **Vocero conversa; Zero Delivery opera.**

---

## Documentos relacionados

- [`LOGICA_DE_NEGOCIO_Y_PERMISOS.md`](./LOGICA_DE_NEGOCIO_Y_PERMISOS.md) — reglas de negocio, roles y matriz completa de 47 permisos.
- [`ZERO_DELIVERY_MVP_BUILD_SPEC.md`](./ZERO_DELIVERY_MVP_BUILD_SPEC.md) — especificación funcional.
- [`engineering/02-casos-de-uso.md`](./engineering/02-casos-de-uso.md) — CU-001 a CU-015.

---

> ⚠️ **Recordatorio:** hoy la aplicación solo tiene login, un dashboard de staff informativo, una pantalla de repartidor también informativa y dos páginas públicas vacías. Las pantallas operativas descritas son **diseño**, no implementación. Ver [`roles/00-COMUN.md`, sección 10](./roles/00-COMUN.md#10-brechas-y-orden-de-implementación).
