# Rol: Encargado de sucursal (`BRANCH_MANAGER`)

> Ámbito: **solo las sucursales asignadas** en `acceso_usuario_sucursal`. Fuera de ellas: `OUT_OF_BRANCH_SCOPE`.
>
> Pantalla inicial: `/dashboard?view=branch`.
> Documento común: [`00-COMUN.md`](./00-COMUN.md).

---

## Índice

1. [Resumen del rol](#1-resumen-del-rol)
2. [Menú y accesos](#2-menú-y-accesos)
3. [Mi sucursal — P-ENC-01](#3-mi-sucursal--p-enc-01)
4. [Pedidos de mi sucursal — P-ENC-02](#4-pedidos-de-mi-sucursal--p-enc-02)
5. [Detalle de pedido — P-ENC-03](#5-detalle-de-pedido--p-enc-03)
6. [Preparación y marcado listo — P-ENC-04](#6-preparación-y-marcado-listo--p-enc-04)
7. [Handoff al repartidor — P-ENC-05](#7-handoff-al-repartidor--p-enc-05)
8. [Catálogo de mi sucursal — P-ENC-06](#8-catálogo-de-mi-sucursal--p-enc-06)
9. [Horarios — P-ENC-07](#9-horarios--p-enc-07)
10. [Devoluciones — P-ENC-08](#10-devoluciones--p-enc-08)
11. [Reportes — P-ENC-09](#11-reportes--p-enc-09)
12. [Alertas — P-ENC-10](#12-alertas--p-enc-10)
13. [Qué no ve y por qué](#13-qué-no-ve-y-por-qué)
14. [Permisos y prohibiciones](#14-permisos-y-prohibiciones)

---

## 1. Resumen del rol

**Puede, solo en sus sucursales:**

- Editar horarios.
- Crear productos y editar disponibilidad y precio.
- Aceptar o rechazar pedidos.
- Iniciar preparación, marcar listo y registrar el handoff físico al rider.
- Confirmar la recepción física de una devolución.
- Ver pedidos de su sucursal y reportes operativos.
- Ver ventas de su sucursal **solo si** `reports.branch_manager_can_view_sales` está activo (por defecto **off**).

**No puede:**

- Crear pedidos manuales.
- Asignar riders.
- Validar pagos, confirmar payout, corregir pagos ni reembolsar.
- Autorizar cancelaciones, segundas entregas ni resolver devoluciones.
- Ver billeteras, adelantos, liquidaciones ni historial de clientes.
- Ver GPS del rider, margen de la agencia ni datos del cliente más allá de lo necesario para preparar.
- Ver el detalle del reparto después de la salida: solo el estado final.
- Administrar usuarios, configuración, integraciones ni auditoría.

---

## 2. Menú y accesos

| Opción | Ruta |
|---|---|
| Mi sucursal (inicio) | `/dashboard?view=branch` |
| Pedidos | `/dashboard/orders` |
| Catálogo | `/dashboard/catalog` |
| Horarios | `/dashboard/catalog/schedules` |
| Devoluciones | `/dashboard/returns` |
| Reportes | `/dashboard/reports` |
| Alertas | `/dashboard/alerts` |

Sin: Nuevo pedido, Despacho global, Pagos, Payouts, Repartidores, Billeteras, Adelantos, Liquidaciones, Incidencias, Clientes, Integraciones, Usuarios, Configuración, Auditoría.

La cabecera muestra siempre el nombre de la sucursal activa; si tiene más de una, un selector que no puede ampliar a sucursales ajenas.

---

## 3. Mi sucursal — P-ENC-01

Ruta: `/dashboard?view=branch` · Estado: ⬜

Es una **cola de trabajo de cocina**, no un panel financiero.

| Bloque | Contenido |
|---|---|
| Cabecera | Nombre de sucursal, estado abierto/cerrado, hora local, botón abrir/cerrar |
| Por aceptar | Pedidos `NEW` con cuenta atrás de aceptación y botones Aceptar / Rechazar |
| En preparación | `CONFIRMED`, `PREPARING` con botón “Marcar listo” |
| Listos | `READY` con aviso de rider asignado y botón “Registrar handoff” |
| Recojo | `RIDER_ASSIGNED`, `RIDER_AT_PICKUP` con temporizador de 15 min |
| Devoluciones | `RETURN_PENDING` con botón “Confirmar recepción física” |
| Alertas | Solo de su sucursal |

**Avisos:**

- “Pedido sin aceptar hace X min” (umbral 5 min).
- “Pedido en preparación hace X min” (umbral 30 min).
- “Rider esperando hace X min” (umbral 15 min).
- “Pago al local pendiente: no se puede hacer handoff”.

**Vacío:** “No hay pedidos en tu sucursal ahora. Esta pantalla se actualiza automáticamente.”

**Acción de apertura/cierre:** `branch.toggle`; si se cierra, se avisa que no entrarán nuevos pedidos.

---

## 4. Pedidos de mi sucursal — P-ENC-02

Ruta: `/dashboard/orders` · Estado: ⬜ · Permiso: `order.view` con alcance

| Elemento | Detalle |
|---|---|
| Tabla | N°, hora, cliente, ítems, estado, pago (sí/no), rider, acciones |
| Filtros | Fecha, estado, texto; **sin selector de sucursal ajena** |
| Acciones | Ver detalle, aceptar/rechazar, preparar, marcar listo, handoff |
| Sin | Nuevo pedido, validar pago, cancelar, asignar rider |
| Vacío | “No hay pedidos en tus sucursales con estos filtros” |

---

## 5. Detalle de pedido — P-ENC-03

Ruta: `/dashboard/orders/[id]` · Estado: ⬜

| Sección | Visible | Oculto |
|---|:-:|:-:|
| Cliente, teléfono, dirección | ✔ lo necesario para preparar | Historial, segmento, riesgo |
| Ítems con base y empaque | ✔ | Margen |
| Estado operativo y acciones | ✔ aceptar, preparar, listo, handoff, devolución | Asignar rider, cancelar |
| Pago al restaurante | ✔ estado | Importe de margen |
| Pago del cliente | ✔ estado | Corrección |
| Rider | Nombre y estado | Teléfono, GPS, billetera |
| Notas | ✔ agregar | — |
| Historial de estados | ✔ | Auditoría |

**Estado `ON_THE_WAY`:** se muestra como **`DISPATCHED_IN_TRANSIT` / “En ruta (sin detalle)”**. No expone GPS ni el progreso posterior.

**Acciones:**

- Aceptar (`NEW → CONFIRMED`) si la sucursal está abierta y los ítems están disponibles.
- Rechazar (`NEW → REJECTED`) con motivo obligatorio.
- Iniciar preparación y marcar listo.
- Registrar handoff.
- Marcar ítem no disponible con motivo (faltante).
- Confirmar recepción física de devolución.
- Agregar notas.
- Imprimir comanda.

---

## 6. Preparación y marcado listo — P-ENC-04

Ruta: `/dashboard/orders/[id]` (panel) o vista de cocina · Estado: ⬜

- Vista de comanda: número grande, hora, ítems, modificadores, notas, marca de frágil.
- Acciones: “Iniciar preparación” (`CONFIRMED → PREPARING`) y “Marcar listo” (`PREPARING → READY`).
- **No depende del pago**: un pedido puede prepararse aunque el pago anticipado siga `PENDING`; la salida sí se bloquea en la regla de liberación.
- Producto faltante: marcar ítem `NO_DISPONIBLE` con motivo; se notifica al cliente y al Coordinador; el resto del pedido continúa.
- Impresión de comanda y reimpresión con marca de hora.

---

## 7. Handoff al repartidor — P-ENC-05

Ruta: `/dashboard/orders/[id]` · Estado: ⬜ · Permiso: `order.handoff_to_rider`

- Entrega física del pedido al rider. Registra `traspaso_en`, `traspaso_por` y `liberado_por`.
- **Se rechaza** si el pago al restaurante no está confirmado.
- Muestra el resumen: rider, hora, ítems, si es efectivo o ya pagado.
- Confirmación explícita: “Entrego el pedido a Carlos a las 19:42”.
- Un pedido sin handoff **no puede pasar a `ON_THE_WAY`**.
- Tras el handoff, el Encargado deja de ver el detalle del reparto (solo estado final).

**Mensajes de bloqueo:**

- “Pago al local pendiente. Pedile al Coordinador que lo confirme.”
- “No hay rider asignado todavía.”
- “El pedido no está listo.”

---

## 8. Catálogo de mi sucursal — P-ENC-06

Ruta: `/dashboard/catalog` · Estado: ⬜

Puede:

- Crear producto (`product.create`).
- Editar disponibilidad (`product.availability.edit`).
- Editar precio (`product.price.edit`).
- Publicar o quitar productos de su carta.

No puede:

- Crear restaurantes ni sucursales.
- Editar zonas de entrega.
- Ver el margen de la agencia.
- Eliminar productos con historial (se archivan).

La lista de productos se limita automáticamente a su sucursal; no hay selector para ver otras.

---

## 9. Horarios — P-ENC-07

Ruta: `/dashboard/catalog/schedules` · Estado: ⬜ · Permiso: `branch.schedule.edit`

- Turnos por día (0 = domingo a 6 = sábado), varias franjas.
- Soporta cruce de medianoche (cierre menor que apertura).
- Solo sus sucursales.
- Cada cambio se audita con actor y fecha.
- Vista previa: “Hoy abre 11:00–23:00. Ahora: abierto”.

---

## 10. Devoluciones — P-ENC-08

Ruta: `/dashboard/returns` · Estado: ⬜ · Permiso: `return.confirm_physical`

- Lista de pedidos en `RETURN_PENDING` de su sucursal.
- Acción “Confirmar recepción física” → `RETURNED_TO_RESTAURANT`.
- Debe verificar ítems y estado del producto.
- **No decide** la resolución final; eso es del Coordinador.
- Puede agregar observación sobre el estado del producto.

---

## 11. Reportes — P-ENC-09

Ruta: `/dashboard/reports` · Estado: ⬜

| Reporte | Disponible |
|---|:-:|
| Operativo de su sucursal | ✔ |
| Ventas de su sucursal | (p) solo si `reports.branch_manager_can_view_sales = true` |
| Financiero global | — |
| Embudo | — |

Si el ajuste está apagado, la opción **no aparece**. Si se intenta por API: `DISABLED_BY_SETTING_BRANCH_SALES`.

Periodos: Hoy, Ayer, 7d, 30d, personalizado (America/Lima). Exportación CSV con el mismo alcance.

---

## 12. Alertas — P-ENC-10

Ruta: `/dashboard/alerts` · Estado: ⬜

- Solo alertas de sus sucursales.
- Tipos: `NEW_ORDER`, `ACCEPTANCE_TIMEOUT`, `PREP_DELAY`, `NO_RIDER`, `PICKUP_WAIT_EXCEEDED`, `DELIVERY_FAILED`.
- Acciones: reconocer, resolver, ir al pedido.
- Sin alertas financieras ni de integración global.

---

## 13. Qué no ve y por qué

| Dato / función | Motivo |
|---|---|
| Margen de la agencia | Información comercial reservada |
| Payout al restaurante (importe) | Solo estado; el dinero no es su responsabilidad |
| Billeteras, adelantos, liquidaciones | Finanzas del rider |
| GPS y teléfono del rider | Privacidad y alcance |
| Historial y riesgo del cliente | Datos de atención, no de cocina |
| Pedidos de otras sucursales | Aislamiento por sucursal |
| Botones de pago y cancelación | Separación de funciones |
| Detalle del reparto tras la salida | Solo estado final |

Si intenta una acción fuera de alcance, el servidor responde `OUT_OF_BRANCH_SCOPE` o `ROLE_NOT_AUTHORIZED`.

---

## 14. Permisos y prohibiciones

| Permiso | ¿Lo tiene? | Condición |
|---|:-:|---|
| `branch.schedule.edit` | ✔ | Solo sus sucursales |
| `product.create` / `availability` / `price` | ✔ | Solo sus sucursales |
| `order.view` | ✔ | Solo sus sucursales |
| `order.accept_reject` | ✔ | Solo sus sucursales |
| `order.start_prepare` / `mark_ready` / `handoff_to_rider` | ✔ | Solo sus sucursales |
| `return.confirm_physical` | ✔ | Solo sus sucursales |
| `order.note.add` | ✔ | |
| `report.operational` | ✔ | Solo sus sucursales |
| `report.branch_sales` | (p) | `reports.branch_manager_can_view_sales` |
| `order.create_manual` | — | |
| `order.assign_rider` | — | |
| `order.cancel.request` / `authorize` | — | |
| `order.address_change.manage` | — | |
| `payment.validate` / `payout.restaurant.confirm` | — | |
| `payment.correct` / `refund.manage` | — | |
| `rider.manage` | — | |
| `delivery.update_own` | — | |
| `delivery.second_attempt.authorize` | — | |
| `return.resolve` | — | |
| `wallet.view_any` / `wallet.view_own` / `wallet.adjust` | — | |
| `advance.create` / `settlement.confirm` | — | |
| `incident.loss.decide` | — | |
| `customer.history.view` / `risk_flag.set` | — | |
| `report.global_financial` / `funnel` | — | |
| `audit.view` / `audit.delete` / `ledger.delete` | — | |
| `user.manage` / `settings.global.manage` / `restaurant.manage` | — | |
