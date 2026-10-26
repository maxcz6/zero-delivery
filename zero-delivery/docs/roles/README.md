# Zero Delivery — Documentación por rol e integración con Vocero CRM

> Esta carpeta contiene la documentación funcional dividida por rol. Cada archivo es autocontenido: incluye el ámbito del rol, su menú, sus pantallas, qué datos ve, qué acciones puede ejecutar y qué le está prohibido.

Fecha: 2026-10-26

---

## Cómo leer

Cada pantalla lleva un estado:

| Marca | Significado |
|:-:|---|
| ✅ | **Implementado** en el repositorio actual |
| 🟡 | **Parcial**: existe la ruta o el contrato, pero no la funcionalidad completa |
| ⬜ | **Diseñado**: propuesta de pantalla; todavía no existe en el código |

**Advertencia:** hoy la aplicación solo tiene login, un dashboard de staff con tarjetas informativas, una pantalla de repartidor también informativa y dos páginas públicas vacías. **Todas las pantallas operativas son propuesta de diseño.** Las brechas exactas están en [`00-COMUN.md`](./00-COMUN.md#10-brechas-y-orden-de-implementación).

---

## Índice

| Archivo | Contenido | Para quién |
|---|---|---|
| [`00-COMUN.md`](./00-COMUN.md) | Login único, sesión, navegación, mapa de rutas, pantallas compartidas, pantallas públicas, patrones de UI, matriz pantalla × permiso y brechas | Todos |
| [`01-ADMINISTRADOR.md`](./01-ADMINISTRADOR.md) | 21 pantallas del Administrador: usuarios, configuración, catálogo, pagos, finanzas, reportes y auditoría | Administrador |
| [`02-COORDINADOR.md`](./02-COORDINADOR.md) | Operación global: Kanban, asignación, cancelaciones, pagos, garantías, liquidaciones e incidencias | Coordinador |
| [`03-ENCARGADO.md`](./03-ENCARGADO.md) | Cola de cocina y sucursal: aceptar, preparar, listo, handoff, horarios y devoluciones | Encargado |
| [`04-EMPLEADO.md`](./04-EMPLEADO.md) | Atención al cliente: pedido manual, pagos, notas, direcciones, clientes y consultas | Empleado |
| [`05-REPARTIDOR.md`](./05-REPARTIDOR.md) | PWA móvil: entregas, intentos, cobro en efectivo, billetera, métricas y perfil | Repartidor |
| [`06-VOCERO_CRM.md`](./06-VOCERO_CRM.md) | Integración completa: webhook entrante, firma HMAC, idempotencia, adaptador saliente, ficha, handoff, medios y errores | Administrador y desarrollo |

---

## Ruta de lectura recomendada

1. **Todos:** `00-COMUN.md` (login y navegación).
2. **Cada rol:** su archivo correspondiente.
3. **Administrador y desarrollo:** `06-VOCERO_CRM.md`.
4. **Antes de implementar:** sección 10 de `00-COMUN.md`.

---

## Reglas que aplican a todos los roles

- **Un solo login** en `/login`; el servidor redirige según el rol.
- **La UI no autoriza:** toda acción pasa por `can(actor, permiso, recurso, settings)` en el servidor.
- **Aislamiento por inquilino:** un actor nunca ve datos de otro inquilino.
- **Alcance:** el Encargado solo sus sucursales; el Repartidor solo sus pedidos asignados.
- **Dinero en céntimos enteros:** nunca `float`.
- **Inmutabilidad:** auditoría, historial de estados, eventos de pago y libro mayor no se editan ni se borran.
- **Nada de decisiones de dinero automáticas:** pagos, correcciones, reembolsos y liquidaciones son siempre humanos.
- **Vocero conversa; Zero Delivery opera.** La IA de Vocero no fija precios ni aprueba pagos.

---

## Documentos relacionados

- [`../LOGICA_DE_NEGOCIO_Y_PERMISOS.md`](../LOGICA_DE_NEGOCIO_Y_PERMISOS.md) — reglas de negocio, roles y matriz completa de 47 permisos.
- [`../ZERO_DELIVERY_MVP_BUILD_SPEC.md`](../ZERO_DELIVERY_MVP_BUILD_SPEC.md) — especificación funcional.
- [`../engineering/02-casos-de-uso.md`](../engineering/02-casos-de-uso.md) — CU-001 a CU-015.
