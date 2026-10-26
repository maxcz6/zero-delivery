# Rol: Coordinador (`COORDINATOR`)

> Ámbito: **toda la operación del inquilino**, sin administración de usuarios, configuración global, restaurantes ni auditoría.
>
> Pantalla inicial: `/dashboard?view=kanban`.
> Documento común: [`00-COMUN.md`](./00-COMUN.md).

---

## Índice

1. [Resumen del rol](#1-resumen-del-rol)
2. [Menú y accesos](#2-menú-y-accesos)
3. [Panel / Despacho — P-COO-01](#3-panel--despacho--p-coo-01)
4. [Pedidos — P-COO-02](#4-pedidos--p-coo-02)
5. [Detalle de pedido — P-COO-03](#5-detalle-de-pedido--p-coo-03)
6. [Kanban — P-COO-04](#6-kanban--p-coo-04)
7. [Asignación de rider — P-COO-05](#7-asignación-de-rider--p-coo-05)
8. [Pagos — P-COO-06](#8-pagos--p-coo-06)
9. [Pagos a restaurantes — P-COO-07](#9-pagos-a-restaurantes--p-coo-07)
10. [Repartidores — P-COO-08](#10-repartidores--p-coo-08)
11. [Billeteras — P-COO-09](#11-billeteras--p-coo-09)
12. [Adelantos — P-COO-10](#12-adelantos--p-coo-10)
13. [Liquidaciones — P-COO-11](#13-liquidaciones--p-coo-11)
14. [Devoluciones — P-COO-12](#14-devoluciones--p-coo-12)
15. [Incidencias — P-COO-13](#15-incidencias--p-coo-13)
16. [Clientes — P-COO-14](#16-clientes--p-coo-14)
17. [Catálogo — P-COO-15](#17-catálogo--p-coo-15)
18. [Reportes — P-COO-16](#18-reportes--p-coo-16)
19. [Alertas — P-COO-17](#19-alertas--p-coo-17)
20. [Diferencias con el Administrador](#20-diferencias-con-el-administrador)
21. [Permisos y prohibiciones](#21-permisos-y-prohibiciones)

---

## 1. Resumen del rol

**Puede:**

- Activar/desactivar sucursales temporalmente.
- Ver todos los pedidos del inquilino y aceptar/rechazar.
- Asignar riders, incluidas segundas entregas.
- Autorizar cancelaciones y resolver devoluciones.
- Validar pagos, confirmar payout, corregir pagos y reembolsar.
- Gestionar perfiles de riders.
- Ver y ajustar cualquier billetera, crear adelantos y confirmar liquidaciones.
- Decidir incidencias con pérdida y marcar riesgo de clientes.
- Ver reportes operativos y ventas por sucursal.

**No puede:**

- Administrar usuarios, configuración global ni restaurantes.
- Ver el reporte financiero global ni la auditoría.
- Preparar, marcar listo ni registrar handoff (eso es del Encargado).
- Ver el embudo salvo que `reports.coordinator_can_view_funnel` esté activo (por defecto **off**).
- Configurar la integración con Vocero (solo Admin); sí recibe sus alertas.

---

## 2. Menú y accesos

| Opción | Ruta |
|---|---|
| Despacho (inicio) | `/dashboard?view=kanban` |
| Pedidos | `/dashboard/orders` |
| Nuevo pedido | `/dashboard/orders/new` |
| Kanban | `/dashboard/kanban` |
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

Sin: Usuarios, Configuración, Auditoría, Integraciones (configuración).

---

## 3. Panel / Despacho — P-COO-01

Ruta: `/dashboard?view=kanban` · Estado: ⬜

Debe abrir **directamente en el Kanban**, no en tarjetas. Arriba, una franja de KPIs:

- Pedidos nuevos sin aceptar (con temporizador).
- Pedidos sin rider hace más de N minutos.
- Entregas en curso.
- Fallos del día.
- Riders disponibles / ocupados / con deuda.
- Pagos por validar y payouts pendientes.

**Acciones rápidas:** abrir Kanban, validar pagos, ver riders con deuda, ver liquidaciones del día.

**Vacío:** “No hay pedidos activos. El tablero se actualiza solo.”

---

## 4. Pedidos — P-COO-02

Ruta: `/dashboard/orders` · Estado: ⬜

Misma tabla que el Admin, con alcance global.

| Elemento | Detalle |
|---|---|
| Tabla | N°, hora, sucursal, cliente, estado, pago, método, total, rider, última actualización |
| Filtros | Fechas, sucursal, estado, método, rider, cliente, texto |
| Acciones | Ver, abrir Kanban, copiar enlace público, abrir cliente |
| Exportación | CSV si tiene el permiso de reporte correspondiente |
| Vacío | “No hay pedidos con estos filtros” |

No ve margen como dato financiero separado en reportes, pero sí el desglose interno en el detalle operativo.

---

## 5. Detalle de pedido — P-COO-03

Ruta: `/dashboard/orders/[id]` · Estado: ⬜

Acciones visibles:

- Aceptar / rechazar (`order.accept_reject`).
- Asignar o reasignar rider (`order.assign_rider`).
- Autorizar cancelación (`order.cancel.authorize`).
- Validar pago y confirmar payout.
- Corregir pago y reembolsar.
- Agregar notas.
- Gestionar cambio de dirección.
- Autorizar 2.º intento y resolver devolución.
- Decidir incidencia económica.
- Ver GPS del rider (lectura) e historial completo.
- **No** prepara, marca listo ni registra handoff.
- **No** ve la auditoría del pedido (solo Admin).

---

## 6. Kanban — P-COO-04

Ruta: `/dashboard/kanban` · Estado: ⬜

| Columna | Estados | Acciones |
|---|---|---|
| Nuevos | `NEW` | Aceptar, rechazar |
| En preparación | `CONFIRMED`, `PREPARING` | Ver (no prepara) |
| Listos | `READY` | Asignar rider |
| Asignados | `RIDER_ASSIGNED`, `RIDER_AT_PICKUP` | Ver, reasignar, cancelar |
| En camino | `ON_THE_WAY` | Ver, cancelar con autorización |
| Incidencias | `DELIVERY_FAILED`, `RETURN_PENDING`, `RETURNED_TO_RESTAURANT`, `PENDING_RESOLUTION` | Autorizar 2.º intento, resolver |

- Semáforo por tiempo: aceptación (5 min), preparación (30 min), sin rider (10 min), espera en recojo (15 min).
- Tarjeta: N°, sucursal, minutos, total, método de pago, rider.
- Auto-refresh 15–30 s.

---

## 7. Asignación de rider — P-COO-05

Ruta: `/dashboard/orders/[id]` (panel lateral) · Estado: ⬜ · Permiso: `order.assign_rider`

Lista **solo riders elegibles** y explica el motivo de cada bloqueo:

| Situación | Mensaje al usuario |
|---|---|
| Rider inactivo | “Inactivo” |
| Rider no disponible | “Ocupado” (si `rider.allow_multiple_orders` está apagado) |
| Deuda | “Deuda S/ 45.00 — no puede tomar efectivo” |
| Garantía insuficiente | “Garantía insuficiente: requiere S/ X” |
| Producto frágil | “Requiere auto por producto frágil” |
| Pedido prepagado | No se bloquea por garantía |

El mensaje debe distinguir **“bloqueado solo para efectivo”** de **“no disponible”**. Un rider con deuda puede tomar pedidos ya pagados por Yape/transferencia.

**Acción:** asignar, confirmar y registrar auditoría. Si el pedido ya tenía rider, se registra reasignación.

---

## 8. Pagos — P-COO-06

Ruta: `/dashboard/payments` · Estado: ⬜

| Pestaña | Acciones |
|---|---|
| Por validar | Validar Yape/transferencia, rechazar con motivo |
| Validados | Ver validador y fecha |
| Correcciones | Corregir con motivo (`payment.correct`), before/after |
| Reembolsos | Registrar reembolso (`refund.manage`) |

Regla visible: subir comprobante no equivale a pago válido. La validación es humana y queda registrada.

---

## 9. Pagos a restaurantes — P-COO-07

Ruta: `/dashboard/payouts` · Estado: ⬜

- Confirmar el pago al local (`payout.restaurant.confirm`).
- Es requisito para el handoff y para la liberación del pedido.
- Filtro por sucursal y fecha.

---

## 10. Repartidores — P-COO-08

Ruta: `/dashboard/riders` · Estado: ⬜ · Permiso: `rider.manage`

- Misma tabla y acciones que el Admin: perfil, flota, vehículo, estado, elegibilidad, saldo, métricas.
- Puede activar/desactivar y marcar alta confianza con motivo.
- Puede ver la ficha completa del rider.
- **No** puede borrar riders con historial.

---

## 11. Billeteras — P-COO-09

Ruta: `/dashboard/wallets` · Estado: ⬜ · Permiso: `wallet.view_any` + `wallet.adjust`

- Saldo calculado por rider, deuda y movimientos.
- Ajuste con motivo obligatorio y signo.
- Sin edición ni borrado de asientos.
- Puede ver el detalle de cualquier rider del inquilino.

---

## 12. Adelantos — P-COO-10

Ruta: `/dashboard/advances` · Estado: ⬜ · Permiso: `advance.create`

- Crear adelanto con rider, importe y motivo.
- Se descuenta una sola vez en la liquidación.
- Estado `PENDIENTE_DEDUCCION` → `DEDUCIDO`.

---

## 13. Liquidaciones — P-COO-11

Ruta: `/dashboard/settlements` · Estado: ⬜ · Permiso: `settlement.confirm`

- Revisa el borrador del día por rider.
- Ingresa el **efectivo realmente entregado**.
- Si cambia la tarifa pagable, exige motivo.
- Ve la diferencia antes de confirmar.
- Confirmar registra el asiento y marca adelantos como deducidos.

```text
neto = tarifa_pagable
     - adelantos_deducidos
     - (efectivo_cobrado - efectivo_recibido)
```

Si el rider entregó menos efectivo del cobrado, la diferencia queda como menor garantía o deuda. **No se perdona automáticamente.**

---

## 14. Devoluciones — P-COO-12

Ruta: `/dashboard/returns` · Estado: ⬜

- Pedidos en `RETURN_PENDING`, `RETURNED_TO_RESTAURANT`, `PENDING_RESOLUTION`.
- Autoriza el 2.º intento (`delivery.second_attempt.authorize`) si corresponde.
- Resuelve (`return.resolve`): cancelar con resolución obligatoria o reintentar si quedan intentos.
- Ve la confirmación física del Encargado antes de resolver.

---

## 15. Incidencias — P-COO-13

Ruta: `/dashboard/incidents` · Estado: ⬜ · Permiso: `incident.loss.decide`

- Faltantes, diferencias de efectivo, entregas fallidas, daños.
- Decide la pérdida con importe y justificación.
- No genera cargos automáticos al rider.

---

## 16. Clientes — P-COO-14

Ruta: `/dashboard/customers` · Estado: ⬜

- Historial completo y búsqueda por teléfono/nombre.
- Puede marcar riesgo (`customer.risk_flag.set`) con motivo.
- Riesgos: `NINGUNO`, `PRECAUCION`, `BLOQUEADO`.
- **Prohibido** enriquecer datos con fuentes externas.

---

## 17. Catálogo — P-COO-15

Ruta: `/dashboard/catalog` · Estado: ⬜

Puede:

- Activar/desactivar sucursal (`branch.toggle`).
- Editar horarios (`branch.schedule.edit`).
- Crear productos y editar disponibilidad y precio.
- Ver zonas de entrega.

No puede:

- Crear restaurantes ni sucursales (`restaurant.manage` es solo Admin).
- Eliminar productos con historial (se archivan).

---

## 18. Reportes — P-COO-16

Ruta: `/dashboard/reports` · Estado: ⬜

| Reporte | ¿Disponible? |
|---|:-:|
| Operativo global | ✔ |
| Ventas por sucursal | ✔ |
| Embudo | (p) `reports.coordinator_can_view_funnel`, por defecto **off** |
| Financiero global | — |

Exportación CSV con el mismo alcance que la pantalla.

---

## 19. Alertas — P-COO-17

Ruta: `/dashboard/alerts` · Estado: ⬜

Recibe:

- `NEW_ORDER`, `ACCEPTANCE_TIMEOUT`, `PREP_DELAY`, `NO_RIDER`, `PICKUP_WAIT_EXCEEDED`, `DELIVERY_FAILED`, `INTEGRATION_DEAD_LETTER`.

Acciones: reconocer, resolver, ir al pedido. Las de integración enlazan a la bandeja de eventos muertos (solo lectura si no es Admin).

---

## 20. Diferencias con el Administrador

| Función | Admin | Coordinador |
|---|:-:|:-:|
| Ver todos los pedidos | ✔ | ✔ |
| Aceptar/rechazar | ✔ | ✔ |
| Preparar / marcar listo / handoff | ✔ | — |
| Asignar rider | ✔ | ✔ |
| Autorizar cancelación | ✔ | ✔ |
| Validar pago / payout | ✔ | ✔ |
| Corregir pago / reembolsar | ✔ | ✔ |
| Gestionar riders | ✔ | ✔ |
| Ajustar billetera / adelantos / liquidar | ✔ | ✔ |
| Ver billeteras | ✔ | ✔ |
| Decidir pérdidas / marcar riesgo | ✔ | ✔ |
| Crear productos / editar precios | ✔ | ✔ |
| Crear restaurantes/sucursales | ✔ | — |
| Activar/desactivar sucursal | ✔ | ✔ |
| Usuarios / configuración / auditoría | ✔ | — |
| Reporte financiero global | ✔ | — |
| Reporte operativo | ✔ global | ✔ global |
| Ventas por sucursal | ✔ | ✔ |
| Embudo | ✔ | (p) |
| Integraciones (configurar) | ✔ | — |

---

## 21. Permisos y prohibiciones

| Permiso | ¿Lo tiene? | Condición |
|---|:-:|---|
| `user.manage` | — | Solo Admin |
| `settings.global.manage` | — | Solo Admin |
| `restaurant.manage` | — | Solo Admin |
| `branch.toggle` | ✔ | |
| `branch.schedule.edit` | ✔ | |
| `product.create` / `availability` / `price` | ✔ | |
| `order.create_manual` | ✔ | |
| `order.view` | ✔ global | |
| `order.accept_reject` | ✔ | |
| `order.start_prepare` / `mark_ready` / `handoff_to_rider` | — | Solo Encargado/Admin |
| `order.assign_rider` | ✔ | |
| `order.note.add` | ✔ | |
| `order.cancel.request` / `authorize` | ✔ | |
| `order.address_change.manage` | ✔ | |
| `payment.validate` / `payout.restaurant.confirm` | ✔ | |
| `payment.correct` / `refund.manage` | ✔ | |
| `rider.manage` | ✔ | |
| `delivery.second_attempt.authorize` | ✔ | |
| `return.confirm_physical` / `return.resolve` | ✔ | |
| `wallet.view_any` / `wallet.adjust` | ✔ | |
| `advance.create` / `settlement.confirm` | ✔ | |
| `incident.loss.decide` | ✔ | |
| `customer.history.view` / `risk_flag.set` | ✔ | |
| `report.operational` / `branch_sales` | ✔ | |
| `report.funnel` | (p) | `reports.coordinator_can_view_funnel` |
| `report.global_financial` | — | Solo Admin |
| `audit.view` / `audit.delete` / `ledger.delete` | — | Solo Admin / nadie |
| `export.*` | Igual que su reporte | Nunca más que la lectura |
