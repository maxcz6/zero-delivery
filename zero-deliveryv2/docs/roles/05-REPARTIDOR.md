# Rol: Repartidor (`RIDER`)

> Ámbito: **solo los pedidos asignados a él** (`repartidor_id = riderId`). Fuera: `NOT_ASSIGNED_TO_RIDER`.
>
> Pantalla inicial: `/deliveries`. Interfaz móvil primero (PWA), tema oscuro, botones grandes, uso con una mano.
> Documento común: [`00-COMUN.md`](./00-COMUN.md).

---

## Índice

1. [Resumen del rol](#1-resumen-del-rol)
2. [Menú y accesos](#2-menú-y-accesos)
3. [Entregas — P-RID-01](#3-entregas--p-rid-01)
4. [Detalle de entrega — P-RID-02](#4-detalle-de-entrega--p-rid-02)
5. [Entrega exitosa — P-RID-03](#5-entrega-exitosa--p-rid-03)
6. [Entrega fallida — P-RID-04](#6-entrega-fallida--p-rid-04)
7. [Devolución — P-RID-05](#7-devolución--p-rid-05)
8. [Billetera — P-RID-06](#8-billetera--p-rid-06)
9. [Métricas — P-RID-07](#9-métricas--p-rid-07)
10. [Perfil — P-RID-08](#10-perfil--p-rid-08)
11. [Estados y errores que ve](#11-estados-y-errores-que-ve)
12. [Permisos y prohibiciones](#12-permisos-y-prohibiciones)

---

## 1. Resumen del rol

**Puede:**

- Ver **solo** los pedidos asignados a él.
- Registrar `RIDER_AT_PICKUP`, `ON_THE_WAY`, `DELIVERED`, `DELIVERY_FAILED` y devolución pendiente.
- Registrar el cobro en efectivo al entregar.
- Agregar notas de incidencia.
- Compartir su ubicación manualmente.
- Ver su propia billetera y garantía.
- Ver y exportar sus propias métricas operativas.

**No puede:**

- Ver pedidos de otros riders.
- Asignarse pedidos, cancelar, reembolsar ni ajustar saldos.
- Ver reportes globales, ventas, auditoría ni datos de clientes que no sean de sus pedidos activos.
- Cobrar efectivo si tiene deuda o garantía insuficiente (lo bloquea la elegibilidad).
- Continuar tras 2 intentos fallidos sin autorización del Coordinador.
- Cambiar su vehículo, su estado de alta confianza ni su garantía.

---

## 2. Menú y accesos

Menú inferior fijo:

| Opción | Ruta |
|---|---|
| Entregas | `/deliveries` |
| Billetera | `/wallet` |
| Métricas | `/metrics` |
| Perfil | `/profile` |

Cabecera: nombre del rider, vehículo y flota, estado (disponible/ocupado/en camino/desconectado), botón “Salir”.

---

## 3. Entregas — P-RID-01

Ruta: `/deliveries` · Estado: 🟡 (hoy es una tarjeta informativa)

| Bloque | Contenido |
|---|---|
| Estado del rider | Disponible / ocupado / en camino / desconectado; botón para cambiar |
| Pedido activo | Tarjeta grande con N°, sucursal, dirección, referencia, total a cobrar, método de pago |
| Acciones según estado | “Llegué al local”, “Iniciar entrega”, “Entregado”, “No se pudo entregar” |
| Cobro | Si es efectivo: “Cobrar S/ X”; si es Yape/transferencia: “Ya pagado — sin cobro al cliente” |
| Frágil | Aviso “Producto frágil / sensible — requiere manejo especial” |
| Ubicación | “Compartir mi ubicación actual” + “Abrir en Google Maps” |
| Sin conexión | Banner: se puede consultar caché, pero las acciones requieren conexión |
| Vacío | “No tienes entregas asignadas” + estado disponible |

**Reglas:**

- Solo aparecen pedidos con `repartidor_id` propio.
- Ordenados por urgencia: en curso primero, luego asignados.
- El botón de acción cambia según el estado; nunca se muestran acciones imposibles.
- Si el pedido aún no está liberado, “Iniciar entrega” está deshabilitado con el motivo.

**PWA:**

- Instalable, funciona offline para consulta.
- Cola de acciones pendientes solo si el servidor lo permite; por defecto las acciones requieren conexión.
- Notificaciones push: fuera del MVP.

---

## 4. Detalle de entrega — P-RID-02

Ruta: `/deliveries/[id]` · Estado: ⬜

| Sección | Contenido |
|---|---|
| Cabecera | N° de pedido, estado, hora |
| Sucursal | Nombre, dirección, teléfono |
| Cliente | Nombre, teléfono, dirección, referencia |
| Ítems | Lista con cantidades y notas |
| Pago | “Cobrar S/ X” o “Ya pagado — sin cobro” |
| Frágil | Aviso destacado |
| Notas | Observaciones del pedido |
| Línea de tiempo | Asignado → en recojo → en camino → entregado/fallido |
| Acciones | Según estado, botón principal grande |

**No ve:** margen, payout, datos de otros pedidos, billetera de otros, auditoría, historial del cliente.

**Acciones por estado:**

| Estado | Acción |
|---|---|
| `RIDER_ASSIGNED` | “Llegué al local” → `RIDER_AT_PICKUP` |
| `RIDER_AT_PICKUP` | “Iniciar entrega” → `ON_THE_WAY` (pasa la regla de liberación) |
| `ON_THE_WAY` | “Entregado” o “No se pudo entregar” |
| `DELIVERY_FAILED` | “Devolver al local” → `RETURN_PENDING` |
| `RETURN_PENDING` | “Entregué al local” (informativo; confirma el Encargado) |

Si la regla de liberación falla, se muestra el motivo exacto:

- `RIDER_NOT_ASSIGNED`
- `RIDER_NOT_ELIGIBLE`
- `PREPAID_PAYMENT_NOT_VALIDATED`
- `RESTAURANT_PAYOUT_NOT_CONFIRMED`
- `HANDOFF_NOT_REGISTERED`

Mensajes humanos: “El local aún no confirmó el pago”, “El encargado no registró la entrega del pedido”, “Falta validar el pago del cliente”.

---

## 5. Entrega exitosa — P-RID-03

Ruta: `/deliveries/[id]` · Estado: ⬜ · Permiso: `delivery.update_own`

1. “Entregado”.
2. Si es efectivo, ingresa el importe cobrado.
3. Si difiere del esperado, se exige motivo y se abre una incidencia automáticamente.
4. Se registra el asiento `EFECTIVO_COBRADO` (negativo) en su billetera.
5. Se cierra el intento como entregado.

**Confirmación:** “¿Confirmas la entrega del pedido #1042 a María López? Cobraste S/ 48.50.”

**Reglas:**

- No puede confirmar si el pedido no está en `ON_THE_WAY`.
- No puede confirmar si no está asignado a él.
- El cobro en efectivo se descuenta de su garantía; si queda en deuda, se bloquea para futuros pedidos en efectivo.

---

## 6. Entrega fallida — P-RID-04

Ruta: `/deliveries/[id]` · Estado: ⬜

1. “No se pudo entregar”.
2. Motivo obligatorio (lista + texto).
3. Observaciones.
4. Foto opcional.
5. Se registra el intento con número correlativo.

Reglas:

- Intento 1 → el Coordinador decide 2.º intento o devolución.
- Intento 2 → `PENDING_RESOLUTION`; **no hay tercer intento**.
- Si debe devolver: `RETURN_PENDING`.
- El rider no puede autorizar su propio segundo intento.

**Motivos típicos:** cliente no responde, dirección incorrecta, cliente rechaza, zona insegura, producto dañado.

---

## 7. Devolución — P-RID-05

Ruta: `/deliveries/[id]` · Estado: ⬜

- Desde `DELIVERY_FAILED` → “Devolver al local” → `RETURN_PENDING`.
- El rider lleva el producto al local.
- **El Encargado** confirma la recepción física; el rider solo ve el estado.
- El rider puede agregar observación sobre el estado del producto.
- No decide si se reembolsa ni si se reintenta.

---

## 8. Billetera — P-RID-06

Ruta: `/wallet` · Estado: ⬜ · Permiso: `wallet.view_own`

| Elemento | Detalle |
|---|---|
| Garantía disponible | Saldo calculado del libro mayor |
| Deuda | Si el saldo es negativo, en rojo |
| Movimientos | Depósito, retiro, efectivo cobrado, efectivo liquidado, ajuste |
| Adelantos | Pendientes de descuento |
| Liquidaciones | Día, neto, estado |
| Explicación | “Tu saldo se calcula sumando todos los movimientos. No se edita.” |

**Solo lectura:** no puede ajustar, retirar ni solicitar adelanto desde aquí.

**Vacío:** “Aún no tenés movimientos. Tu garantía inicial aparecerá acá.”

---

## 9. Métricas — P-RID-07

Ruta: `/metrics` · Estado: ⬜ · Permiso: `report.operational` (propias)

- Entregas del periodo (Hoy, Ayer, 7d, 30d, personalizado).
- Entregas fallidas.
- Tiempo promedio por entrega.
- Puntualidad.
- Calificación.
- Ingreso estimado propio.
- Exportación CSV de **sus** métricas.

**No ve** comparación con otros riders ni totales de la agencia.

---

## 10. Perfil — P-RID-08

Ruta: `/profile` · Estado: ⬜

- Nombre, teléfono, vehículo, flota, estado.
- Cambio de contraseña.
- Cerrar sesión.
- Estado de conexión.
- **No** puede cambiar su vehículo, su flota ni su estado de alta confianza; eso lo hace el staff.
- Puede actualizar su foto y teléfono si el negocio lo permite (a definir).

---

## 11. Estados y errores que ve

| Situación | Mensaje |
|---|---|
| Pedido de otro rider | “Este pedido no está asignado a vos.” (`NOT_ASSIGNED_TO_RIDER`) |
| Acción sin conexión | “Necesitás conexión para completar esta acción.” |
| Regla de liberación | Motivo específico (pago, handoff, elegibilidad) |
| Cobro bloqueado por deuda | “Tenés una deuda de S/ X. Regularizá para tomar pedidos en efectivo.” |
| Cobro bloqueado por garantía | “Garantía insuficiente: necesitás S/ X.” |
| Segundo intento sin autorización | “El coordinador debe autorizar un nuevo intento.” |
| Máximo de intentos | “Se alcanzó el máximo de 2 intentos. El pedido pasa a resolución.” |
| Pedido cambiado por otro usuario | “El pedido cambió. Recargá para ver el estado actual.” |
| Sesión vencida | Redirección a `/login` |

---

## 12. Permisos y prohibiciones

| Permiso | ¿Lo tiene? | Condición |
|---|:-:|---|
| `order.view` | ✔ | Solo pedidos asignados |
| `delivery.update_own` | ✔ | Solo pedidos asignados |
| `order.note.add` | ✔ | Notas de incidencia |
| `wallet.view_own` | ✔ | Solo su billetera |
| `report.operational` | ✔ | Solo sus métricas |
| `export.operational` | ✔ | Solo sus métricas |
| `order.create_manual` | — | |
| `order.accept_reject` | — | |
| `order.start_prepare` / `mark_ready` / `handoff_to_rider` | — | |
| `order.assign_rider` | — | |
| `order.cancel.request` / `authorize` | — | |
| `order.address_change.manage` | — | |
| `payment.validate` / `payout.restaurant.confirm` | — | |
| `payment.correct` / `refund.manage` | — | |
| `rider.manage` | — | |
| `delivery.second_attempt.authorize` | — | |
| `return.confirm_physical` / `return.resolve` | — | |
| `wallet.view_any` / `wallet.adjust` | — | |
| `advance.create` / `settlement.confirm` | — | |
| `incident.loss.decide` | — | |
| `customer.history.view` / `risk_flag.set` | — | |
| `report.global_financial` / `branch_sales` / `funnel` | — | |
| `audit.view` / `audit.delete` / `ledger.delete` | — | |
| `user.manage` / `settings.global.manage` / `restaurant.manage` | — | |

**Regla de oro del rol:** solo ve y actualiza **lo suyo**; el dinero se registra, no se decide.
