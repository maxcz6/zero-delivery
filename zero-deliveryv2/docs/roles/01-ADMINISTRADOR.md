# Rol: Administrador (`ADMIN`)

> Ámbito: **todo el inquilino**. Es el único rol con usuarios, configuración global, restaurantes, reporte financiero global y auditoría.
>
> Pantalla inicial: `/dashboard`.
> Documento común: [`00-COMUN.md`](./00-COMUN.md) (login, navegación, detalle de pedido, brechas).
> Integración: [`06-VOCERO_CRM.md`](./06-VOCERO_CRM.md).

---

## Índice

1. [Resumen del rol](#1-resumen-del-rol)
2. [Menú y accesos](#2-menú-y-accesos)
3. [Panel general — P-ADM-01](#3-panel-general--p-adm-01)
4. [Pedidos — P-ADM-02](#4-pedidos--p-adm-02)
5. [Detalle de pedido — P-ADM-03](#5-detalle-de-pedido--p-adm-03)
6. [Despacho (Kanban) — P-ADM-04](#6-despacho-kanban--p-adm-04)
7. [Pagos — P-ADM-05](#7-pagos--p-adm-05)
8. [Pagos a restaurantes — P-ADM-06](#8-pagos-a-restaurantes--p-adm-06)
9. [Repartidores — P-ADM-07](#9-repartidores--p-adm-07)
10. [Ficha del rider — P-ADM-08](#10-ficha-del-rider--p-adm-08)
11. [Billeteras y garantías — P-ADM-09](#11-billeteras-y-garantías--p-adm-09)
12. [Adelantos — P-ADM-10](#12-adelantos--p-adm-10)
13. [Liquidaciones — P-ADM-11](#13-liquidaciones--p-adm-11)
14. [Devoluciones — P-ADM-12](#14-devoluciones--p-adm-12)
15. [Incidencias — P-ADM-13](#15-incidencias--p-adm-13)
16. [Clientes — P-ADM-14](#16-clientes--p-adm-14)
17. [Catálogo — P-ADM-15](#17-catálogo--p-adm-15)
18. [Reportes — P-ADM-16](#18-reportes--p-adm-16)
19. [Alertas — P-ADM-17](#19-alertas--p-adm-17)
20. [Integraciones — P-ADM-18](#20-integraciones--p-adm-18)
21. [Usuarios y roles — P-ADM-19](#21-usuarios-y-roles--p-adm-19)
22. [Configuración — P-ADM-20](#22-configuración--p-adm-20)
23. [Auditoría — P-ADM-21](#23-auditoría--p-adm-21)
24. [Permisos y prohibiciones](#24-permisos-y-prohibiciones)

---

## 1. Resumen del rol

**Puede:**

- Crear y administrar usuarios, roles y accesos a sucursales.
- Cambiar configuración global del inquilino.
- Crear restaurantes, sucursales, zonas, catálogo y cartas.
- Ver reportes financieros globales y auditoría.
- Todo lo operativo: aceptar, preparar, marcar listo, handoff, asignar rider.
- Validar pagos, confirmar payout, corregir pagos y gestionar reembolsos.
- Autorizar cancelaciones, segundas entregas, devoluciones y resoluciones.
- Ajustar garantías, crear adelantos y confirmar liquidaciones.
- Decidir pérdidas por incidencias y marcar riesgo de clientes.
- **Override de emergencia** de estado: cualquier estado → cualquier estado, con motivo obligatorio y auditoría reforzada.

**No puede:**

- Borrar auditoría ni asientos del libro mayor. **Nadie puede.**
- Evitar la regla de liberación.
- Usar `wallet.view_own` (usa `wallet.view_any`).

---

## 2. Menú y accesos

| Opción | Ruta |
|---|---|
| Panel | `/dashboard` |
| Pedidos | `/dashboard/orders` |
| Nuevo pedido | `/dashboard/orders/new` |
| Despacho (Kanban) | `/dashboard/kanban` |
| Pagos | `/dashboard/payments` |
| Pagos a restaurantes | `/dashboard/payouts` |
| Repartidores | `/dashboard/riders` |
| Billeteras y garantías | `/dashboard/wallets` |
| Adelantos | `/dashboard/advances` |
| Liquidaciones | `/dashboard/settlements` |
| Devoluciones | `/dashboard/returns` |
| Incidencias | `/dashboard/incidents` |
| Clientes | `/dashboard/customers` |
| Catálogo | `/dashboard/catalog` |
| Horarios | `/dashboard/catalog/schedules` |
| Reportes | `/dashboard/reports` |
| Alertas | `/dashboard/alerts` |
| Integraciones | `/dashboard/integrations` |
| Usuarios y roles | `/dashboard/users` |
| Configuración | `/dashboard/settings` |
| Auditoría | `/dashboard/audit` |

Accesos rápidos en el panel: nuevo pedido, validar pagos, liquidar, invitar usuario.

---

## 3. Panel general — P-ADM-01

Ruta: `/dashboard` · Estado: ⬜

| Bloque | Contenido |
|---|---|
| KPIs del día | Pedidos creados, entregados, fallidos, cancelados, ticket promedio, venta total |
| Operación en vivo | Pedidos por estado, sucursales abiertas/cerradas, riders disponibles |
| Dinero | Cobrado en efectivo pendiente de liquidar, garantías totales, deuda de riders, payouts pendientes |
| Alertas | Últimas críticas y advertencias con enlace |
| Integraciones | Vocero encendido/apagado, último webhook recibido, eventos muertos |
| Accesos rápidos | Nuevo pedido, validar pagos, liquidar, invitar usuario |

**Datos visibles:** todos, sin enmascarar.
**Acciones:** navegar a cualquier módulo.
**Vacío:** “Aún no hay actividad hoy” + botón “Crear primer pedido”.
**Restricción:** nada se borra desde aquí.

---

## 4. Pedidos — P-ADM-02

Ruta: `/dashboard/orders` · Estado: ⬜ · Permiso: `order.view`

| Elemento | Detalle |
|---|---|
| Tabla | N°, hora, sucursal, cliente, teléfono, estado operativo, pago, método, total, rider, última actualización |
| Filtros | Fechas (Hoy/Ayer/7d/30d/personalizado en America/Lima), sucursal, estado, método de pago, rider, cliente, texto libre |
| Orden | Hora descendente; columnas ordenables |
| Acciones por fila | Ver detalle, copiar enlace público, abrir ficha del cliente |
| Acciones masivas | Exportar CSV (según permiso); nunca borrar |
| Paginación | Servidor, 25/50/100 |
| Vacío | “No hay pedidos con estos filtros” + limpiar filtros |

**Prohibido:** editar importes desde la tabla; todo cambio entra al detalle y queda auditado.

---

## 5. Detalle de pedido — P-ADM-03

Ruta: `/dashboard/orders/[id]` · Estado: ⬜

Incluye todo lo de la matriz común y además:

- **Override de emergencia**: cualquier estado → cualquier estado, motivo obligatorio, banner rojo y auditoría reforzada.
- Ver margen, base, empaque, payout y GPS.
- Ver historial completo de estados, pagos, notas, incidencias y eventos de integración.
- Ver y reprocesar eventos de Vocero asociados (si la integración está encendida).

**Acciones disponibles:** todas las de la matriz común, incluidas preparación y handoff aunque no sea su tarea habitual.

---

## 6. Despacho (Kanban) — P-ADM-04

Ruta: `/dashboard/kanban` · Estado: ⬜

| Columna | Estados | Acciones |
|---|---|---|
| Nuevos | `NEW` | Aceptar, rechazar |
| En preparación | `CONFIRMED`, `PREPARING` | Iniciar preparación, marcar listo |
| Listos | `READY` | Asignar rider |
| Asignados | `RIDER_ASSIGNED`, `RIDER_AT_PICKUP` | Ver, reasignar, cancelar |
| En camino | `ON_THE_WAY` | Ver, cancelar con autorización |
| Incidencias | `DELIVERY_FAILED`, `RETURN_PENDING`, `RETURNED_TO_RESTAURANT`, `PENDING_RESOLUTION` | Autorizar 2.º intento, resolver |

- Tarjeta: N°, sucursal, minutos transcurridos, semáforo de tiempo, total, método de pago, rider.
- Alertas visuales: acceptance timeout, prep delay, no rider, pickup wait excedido.
- Auto-refresh cada 15–30 s y botón manual; sin websockets en el MVP.

---

## 7. Pagos — P-ADM-05

Ruta: `/dashboard/payments` · Estado: ⬜

| Pestaña | Contenido | Acciones |
|---|---|---|
| Por validar | Yape/transferencia con comprobante y estado `PENDING` | Ver comprobante, validar (`payment.validate`), rechazar con motivo |
| Validados | Historial con validador y fecha | Ver evento |
| Correcciones | Pagos corregidos | Corregir con motivo (`payment.correct`), before/after |
| Reembolsos | Reembolsos manuales | Registrar reembolso (`refund.manage`) |

Reglas visibles:

- “Subir comprobante **no** marca el pago como pagado.”
- Validar registra `validado_por` y `validado_en`.
- Corregir nunca sobrescribe: crea un evento `CORREGIDO` con valores anteriores y nuevos.

---

## 8. Pagos a restaurantes — P-ADM-06

Ruta: `/dashboard/payouts` · Estado: ⬜ · Permiso: `payout.restaurant.confirm`

- Lista de pedidos con `restaurant_payout_status = PENDING`.
- Acción “Confirmar pago al local”.
- Muestra el bloqueo: sin este paso **no se puede registrar el handoff ni liberar el pedido**.
- Filtro por sucursal y fecha.

---

## 9. Repartidores — P-ADM-07

Ruta: `/dashboard/riders` · Estado: ⬜ · Permiso: `rider.manage`

| Columna | Dato |
|---|---|
| Rider | Nombre, teléfono, foto |
| Flota | `OWN` / `AGENCY` / `THIRD_PARTY` |
| Vehículo | `MOTO` / `CAR` |
| Estado | Disponible, ocupado, en camino, desconectado |
| Elegibilidad | Activo, alta confianza, edad, garantía |
| Saldo | Garantía disponible o deuda (con signo y color) |
| Métricas | Entregas, puntualidad, calificación |

**Acciones:** crear/editar perfil, activar/desactivar, marcar alta confianza (con motivo), ver ficha.
**Nunca:** borrar un rider con historial; se desactiva.

---

## 10. Ficha del rider — P-ADM-08

Ruta: `/dashboard/riders/[id]` · Estado: ⬜

Pestañas: Perfil · Billetera · Entregas · Liquidaciones · Incidencias.

Muestra el detalle de elegibilidad:

- “Exento de garantía por edad (≥35)”.
- “Exento por alta confianza”.
- “Requiere garantía ≥ S/ X”.

Es información operativa, no un dato público.

---

## 11. Billeteras y garantías — P-ADM-09

Ruta: `/dashboard/wallets` · Estado: ⬜ · Permiso: `wallet.view_any`

- Tabla por rider: saldo calculado (`SUM` del libro mayor, nunca almacenado), deuda, último movimiento.
- Movimientos: tipo, signo, importe, pedido/liquidación asociada, actor, motivo, fecha.
- Acción “Ajuste” (`wallet.adjust`) con motivo obligatorio y signo.
- **No existe** botón de borrar ni editar asientos.

---

## 12. Adelantos — P-ADM-10

Ruta: `/dashboard/advances` · Estado: ⬜ · Permiso: `advance.create`

- Crear adelanto con rider, importe, motivo y autor.
- Estado `PENDIENTE_DEDUCCION` → `DEDUCIDO` al incluirlo en una liquidación.
- Se muestra qué liquidación lo descontó.

---

## 13. Liquidaciones — P-ADM-11

Ruta: `/dashboard/settlements` · Estado: ⬜ · Permiso: `settlement.confirm`

- Borrador por rider y fecha operativa (corte 23:00 America/Lima).
- Campos: efectivo cobrado, adelantos, tarifa de referencia, tarifa pagable, efectivo recibido, neto.
- Si la tarifa pagable difiere de la de referencia → motivo obligatorio.
- Confirmar: registra asiento `EFECTIVO_LIQUIDADO`, marca adelantos como deducidos y deja la diferencia como menor garantía o deuda.
- **No perdona diferencias automáticamente.**

Fórmula visible:

```text
neto = tarifa_pagable
     - adelantos_deducidos
     - (efectivo_cobrado - efectivo_recibido)
```

---

## 14. Devoluciones — P-ADM-12

Ruta: `/dashboard/returns` · Estado: ⬜

- Pedidos en `RETURN_PENDING`, `RETURNED_TO_RESTAURANT`, `PENDING_RESOLUTION`.
- Confirmar recepción física (`return.confirm_physical`) y resolver (`return.resolve`): cancelar con resolución obligatoria o reintentar si quedan intentos.
- Muestra intentos usados (máx. 2) y autorización del 2.º intento.

---

## 15. Incidencias — P-ADM-13

Ruta: `/dashboard/incidents` · Estado: ⬜ · Permiso: `incident.loss.decide`

- Faltantes, diferencias de efectivo, entregas fallidas, productos dañados.
- Decidir pérdida con importe y justificación.
- Nunca genera cargos automáticos al rider.

---

## 16. Clientes — P-ADM-14

Ruta: `/dashboard/customers` · Estado: ⬜ · Permiso: `customer.history.view`

- Búsqueda por teléfono E.164, nombre o identificación.
- Ficha: pedidos, total gastado, segmento (`NUEVO`, `RECURRENTE`, `TOP`), riesgo (`NINGUNO`, `PRECAUCION`, `BLOQUEADO`), notas.
- Marcar riesgo (`customer.risk_flag.set`) exige motivo; queda auditado.
- **Prohibido** cualquier enriquecimiento con fuentes externas.

---

## 17. Catálogo — P-ADM-15

Ruta: `/dashboard/catalog` · Estado: ⬜

Pestañas: Restaurantes · Sucursales · Zonas de entrega · Categorías · Productos · Modificadores · Cartas.

| Acción | Permiso |
|---|---|
| Crear/editar restaurante y sucursal | `restaurant.manage` |
| Activar/desactivar sucursal | `branch.toggle` |
| Editar horarios | `branch.schedule.edit` |
| Crear producto | `product.create` |
| Editar disponibilidad | `product.availability.edit` |
| Editar precio | `product.price.edit` |

Reglas: producto con historial se **archiva**, no se elimina. El margen es interno y nunca se muestra al cliente.

---

## 18. Reportes — P-ADM-16

Ruta: `/dashboard/reports` · Estado: ⬜

| Reporte | Permiso | Contenido |
|---|---|---|
| Financiero global | `report.global_financial` + `export.global_financial` | Ingresos por margen, payouts, garantías, deuda, liquidaciones |
| Operativo | `report.operational` + `export.operational` | Pedidos, tiempos, fallos, carga por rider |
| Ventas por sucursal | `report.branch_sales` + `export.branch_sales` | Totales y ticket promedio |
| Embudo | `report.funnel` + `export.funnel` | Impresiones, vistas de carta, carrito, compra |

Selector de periodo: Hoy, Ayer, 7d, 30d, personalizado (America/Lima). Exportación CSV UTF-8 con BOM y **exactamente el mismo filtro de alcance** que la pantalla.

---

## 19. Alertas — P-ADM-17

Ruta: `/dashboard/alerts` · Estado: ⬜

- Tipos: `NEW_ORDER`, `ACCEPTANCE_TIMEOUT`, `PREP_DELAY`, `NO_RIDER`, `PICKUP_WAIT_EXCEEDED`, `DELIVERY_FAILED`, `INTEGRATION_DEAD_LETTER`.
- Severidad: INFO, ADVERTENCIA, CRÍTICO.
- Acciones: reconocer, resolver, ir al pedido.
- Deduplicadas por clave; no se repiten en bucle.

---

## 20. Integraciones — P-ADM-18

Ruta: `/dashboard/integrations` · Estado: ⬜ · Permiso: `settings.global.manage`

Solo Admin. Detalle completo en [`06-VOCERO_CRM.md`](./06-VOCERO_CRM.md#13-pantallas-de-integración).

Incluye:

- Estado del flag, URL y API key enmascarada.
- Salud del healthcheck.
- Último evento recibido.
- Bandejas de eventos entrantes y salientes.
- Cola muerta con reproceso.
- Encendido/apagado con validaciones.

---

## 21. Usuarios y roles — P-ADM-19

Ruta: `/dashboard/users` · Estado: ⬜ · Permiso: `user.manage`

| Elemento | Detalle |
|---|---|
| Lista | Usuario, nombre, rol, sucursales asignadas, estado, último acceso |
| Crear | Usuario, nombre, rol, contraseña temporal, sucursales |
| Editar | Rol, sucursales, activar/desactivar |
| Reset | Contraseña temporal y forzar cambio |
| Auditoría | Cada cambio con actor y fecha |

Reglas:

- No se puede eliminar el último Admin activo.
- No se puede desactivar a sí mismo.
- Un Encargado necesita al menos una sucursal.

---

## 22. Configuración — P-ADM-20

Ruta: `/dashboard/settings` · Estado: ⬜ · Permiso: `settings.global.manage`

Las 18 claves del inquilino:

| Grupo | Claves |
|---|---|
| Pedidos | `order.acceptance_timeout_minutes`, `order.prep_delay_threshold_minutes`, `order.no_rider_threshold_minutes` |
| Repartidores | `rider.pickup_wait_minutes`, `rider.min_age_for_cash_without_guarantee`, `rider.allow_multiple_orders`, `guarantee.min_cents` |
| Entregas | `delivery.max_attempts` |
| Liquidación | `settlement.cutoff_time` |
| Clientes | `customer.top_min_orders` |
| Reportes | `reports.branch_manager_can_view_sales`, `reports.coordinator_can_view_funnel` |
| Soporte | `support.can_assign_rider`, `support.can_create_advance` |
| Integraciones | `feature.integration.vocero`, `feature.integration.whatsapp` |
| Localización | `locale.timezone`, `locale.currency` |

Cada campo muestra: valor actual, defecto, si es **provisional** (`is_placeholder`) y una advertencia de que un valor provisional no es verdad financiera. Los cambios se auditan.

---

## 23. Auditoría — P-ADM-21

Ruta: `/dashboard/audit` · Estado: ⬜ · Permiso: `audit.view`

- Filtros: fecha, actor, rol, acción, tipo de objeto, objeto.
- Detalle: antes/después, motivo, IP/agente si aplica.
- **Solo lectura.** No hay botón de borrar y el servidor responde `IMMUTABLE_RESOURCE_NOBODY_ALLOWED` incluso para el Admin.

---

## 24. Permisos y prohibiciones

| Permiso | ¿Lo tiene? | Nota |
|---|:-:|---|
| `user.manage` | ✔ | Único rol |
| `settings.global.manage` | ✔ | Único rol |
| `restaurant.manage` | ✔ | Único rol |
| `branch.toggle` | ✔ | |
| `branch.schedule.edit` | ✔ | |
| `product.create` / `availability` / `price` | ✔ | |
| `order.create_manual` | ✔ | |
| `order.view` | ✔ global | |
| `order.accept_reject` | ✔ | |
| `order.start_prepare` / `mark_ready` / `handoff_to_rider` | ✔ | |
| `order.assign_rider` | ✔ | |
| `order.note.add` | ✔ | |
| `order.cancel.request` / `authorize` | ✔ | |
| `order.address_change.manage` | ✔ | |
| `payment.validate` / `payout.restaurant.confirm` | ✔ | |
| `payment.correct` / `refund.manage` | ✔ | |
| `rider.manage` | ✔ | |
| `delivery.update_own` | ✔ override | Solo como override auditado |
| `delivery.second_attempt.authorize` | ✔ | |
| `return.confirm_physical` / `return.resolve` | ✔ | |
| `wallet.view_any` / `wallet.adjust` | ✔ | |
| `wallet.view_own` | — | No aplica al Admin |
| `advance.create` / `settlement.confirm` | ✔ | |
| `incident.loss.decide` | ✔ | |
| `customer.history.view` / `risk_flag.set` | ✔ | |
| `report.global_financial` / `operational` / `branch_sales` / `funnel` | ✔ | |
| `audit.view` | ✔ | |
| `audit.delete` / `ledger.delete` | — | **Nadie**, por diseño |

**Prohibiciones absolutas:** borrar auditoría, borrar asientos del libro mayor, saltarse la regla de liberación y operar fuera de su inquilino.
