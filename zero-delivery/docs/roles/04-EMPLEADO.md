# Rol: Empleado / atención al cliente (`SUPPORT_AGENT`)

> Ámbito: **todo el inquilino en lectura y atención**; sin operación de cocina, sin finanzas sensibles, sin administración.
>
> Pantalla inicial: `/dashboard?view=support`.
> Documento común: [`00-COMUN.md`](./00-COMUN.md).

---

## Índice

1. [Resumen del rol](#1-resumen-del-rol)
2. [Menú y accesos](#2-menú-y-accesos)
3. [Atención — P-EMP-01](#3-atención--p-emp-01)
4. [Pedidos — P-EMP-02](#4-pedidos--p-emp-02)
5. [Detalle de pedido — P-EMP-03](#5-detalle-de-pedido--p-emp-03)
6. [Nuevo pedido — P-EMP-04](#6-nuevo-pedido--p-emp-04)
7. [Pagos — P-EMP-05](#7-pagos--p-emp-05)
8. [Pagos a restaurantes — P-EMP-06](#8-pagos-a-restaurantes--p-emp-06)
9. [Billeteras — P-EMP-07](#9-billeteras--p-emp-07)
10. [Adelantos — P-EMP-08](#10-adelantos--p-emp-08)
11. [Clientes — P-EMP-09](#11-clientes--p-emp-09)
12. [Asignación de rider — P-EMP-10](#12-asignación-de-rider--p-emp-10)
13. [Alertas — P-EMP-11](#13-alertas--p-emp-11)
14. [Permisos y prohibiciones](#14-permisos-y-prohibiciones)

---

## 1. Resumen del rol

**Puede:**

- Crear pedidos manuales.
- Ver todos los pedidos y el historial individual de clientes.
- Agregar notas.
- Solicitar cancelaciones (no autorizarlas).
- Gestionar cambios de dirección (con aceptación del cliente).
- Validar pagos y confirmar pago al restaurante.
- Ver cualquier billetera en modo lectura.
- Asignar rider **si** `support.can_assign_rider` está activo (por defecto **sí**).
- Crear adelantos **si** `support.can_create_advance` está activo (por defecto **no**).

**No puede:**

- Aceptar/rechazar, preparar, marcar listo ni hacer handoff.
- Autorizar cancelaciones, corregir pagos, reembolsar ni ajustar garantías.
- Confirmar liquidaciones, decidir pérdidas ni marcar riesgo de clientes.
- Gestionar repartidores.
- Ver reportes macro, financieros ni auditoría.
- Configurar integraciones.

---

## 2. Menú y accesos

| Opción | Ruta |
|---|---|
| Atención (inicio) | `/dashboard?view=support` |
| Pedidos | `/dashboard/orders` |
| Nuevo pedido | `/dashboard/orders/new` |
| Pagos | `/dashboard/payments` |
| Pagos a restaurantes | `/dashboard/payouts` |
| Billeteras (lectura) | `/dashboard/wallets` |
| Adelantos (si ajuste) | `/dashboard/advances` |
| Clientes | `/dashboard/customers` |
| Alertas | `/dashboard/alerts` |

Sin: Despacho, Repartidores, Liquidaciones, Incidencias, Catálogo, Horarios, Reportes, Integraciones, Usuarios, Configuración, Auditoría.

---

## 3. Atención — P-EMP-01

Ruta: `/dashboard?view=support` · Estado: ⬜

Bandeja de trabajo:

| Bloque | Contenido |
|---|---|
| Cola | Pedidos activos ordenados por riesgo de tiempo (nuevos, sin rider, fallidos, con incidencia) |
| Búsqueda | Por teléfono, N° de pedido o nombre |
| Ficha rápida | Cliente, último pedido, estado, deuda del rider si aplica |
| Acciones rápidas | Crear pedido, agregar nota, validar pago, solicitar cancelación, gestionar dirección |

**Vacío:** “No hay casos pendientes. Podés crear un pedido manual.”

**Regla:** la cola prioriza por tiempo y severidad, no por hora de creación solamente.

---

## 4. Pedidos — P-EMP-02

Ruta: `/dashboard/orders` · Estado: ⬜ · Permiso: `order.view` global (lectura)

| Elemento | Detalle |
|---|---|
| Tabla | N°, hora, sucursal, cliente, teléfono, estado, pago, método, total, rider |
| Filtros | Fechas, sucursal, estado, método, cliente, texto |
| Acciones | Ver detalle, agregar nota, solicitar cancelación, cambiar dirección |
| Sin | Aceptar, preparar, listo, handoff, asignar (salvo ajuste), cancelar |
| Vacío | “No hay pedidos con estos filtros” |

---

## 5. Detalle de pedido — P-EMP-03

Ruta: `/dashboard/orders/[id]` · Estado: ⬜

| Sección | Visible | Acción |
|---|:-:|---|
| Cliente y dirección | ✔ | Gestionar cambio de dirección |
| Ítems y totales | ✔ completo | — |
| Pago del cliente | ✔ | Validar o rechazar |
| Payout al restaurante | ✔ | Confirmar |
| Rider | ✔ nombre y estado | Asignar si ajuste |
| Notas | ✔ | Agregar |
| Cancelación | ✔ estado | Solicitar, no autorizar |
| Historial | ✔ | — |
| Margen | ✔ | Solo lectura |
| Auditoría | — | — |

**No** ve botones de preparación, handoff, corrección de pago, reembolso, ajuste de billetera, riesgo de cliente ni liquidación.

---

## 6. Nuevo pedido — P-EMP-04

Ruta: `/dashboard/orders/new` · Estado: ⬜ · Permiso: `order.create_manual`

Formulario guiado:

1. **Sucursal** (solo abiertas; muestra horario).
2. **Cliente**: teléfono E.164 (busca y deduplica), nombre, dirección, referencia.
3. **Zona de entrega**: tarifa y pedido mínimo.
4. **Ítems**: producto, cantidad, modificadores; muestra disponibilidad.
5. **Método de pago**: efectivo, Yape, transferencia.
6. **Notas**.
7. **Resumen** con totales **sin desglose interno**.
8. **Confirmar** → crea `NEW`, pago y payout `PENDING`, alerta `NEW_ORDER`.

Reglas visibles:

- Cliente `BLOQUEADO` no permite crear salvo override de Coordinador/Admin.
- Se envía `idempotencyKey` para evitar duplicados por doble clic.
- Si el total no alcanza el mínimo de la zona, se bloquea con mensaje claro.
- El teléfono se normaliza a `+51 9XXXXXXXX`; si ya existe, se reutiliza el cliente.
- El pedido creado muestra de inmediato su número y enlace público.

**Estados del formulario:** borrador, validando, error por campo, error de red con reintento, éxito con resumen y acciones (“ver pedido”, “crear otro”).

---

## 7. Pagos — P-EMP-05

Ruta: `/dashboard/payments` · Estado: ⬜ · Permiso: `payment.validate`

- Ver comprobante de Yape/transferencia.
- Validar el pago: registra `validado_por` y `validado_en`.
- Rechazar con motivo: el cliente puede enviar un nuevo comprobante.
- **No** corrige pagos ni reembolsa.
- Ve el historial del pedido y los eventos de pago.

Regla visible: “Subir el comprobante no marca el pago como pagado. La validación es manual.”

---

## 8. Pagos a restaurantes — P-EMP-06

Ruta: `/dashboard/payouts` · Estado: ⬜ · Permiso: `payout.restaurant.confirm`

- Confirmar el pago al local.
- Es requisito para el handoff y la liberación.
- Filtro por sucursal y fecha.
- **No** puede corregir el importe.

---

## 9. Billeteras — P-EMP-07

Ruta: `/dashboard/wallets` · Estado: ⬜ · Permiso: `wallet.view_any` (solo lectura)

- Saldo, deuda y movimientos por rider.
- Sin botón de ajuste, adelanto (salvo ajuste) ni liquidación.
- Útil para responder: “¿Cuánto tiene de garantía?” o “¿Por qué no puede tomar efectivo?”.

---

## 10. Adelantos — P-EMP-08

Ruta: `/dashboard/advances` · Estado: ⬜ · Permiso: `advance.create` condicionado

- Visible solo si `support.can_create_advance = true` (por defecto **false**).
- Si está apagado, la opción no aparece.
- Si se intenta por API: `DISABLED_BY_SETTING_SUPPORT_CAN_CREATE_ADVANCE`.
- Puede crear adelanto con rider, importe y motivo; no puede confirmar liquidaciones.

---

## 11. Clientes — P-EMP-09

Ruta: `/dashboard/customers` · Estado: ⬜ · Permiso: `customer.history.view`

- Búsqueda por teléfono, nombre o identificación.
- Historial de pedidos, total gastado, segmento, notas.
- Puede agregar notas.
- **No** puede marcar riesgo (`customer.risk_flag.set` es de Admin/Coordinador).
- **No** puede consultar fuentes externas ni enriquecer datos.

---

## 12. Asignación de rider — P-EMP-10

Ruta: `/dashboard/orders/[id]` (panel) · Estado: ⬜ · Permiso condicionado

- Solo si `support.can_assign_rider = true` (por defecto **sí**).
- Misma lista de elegibilidad que el Coordinador, con motivos de bloqueo.
- Si el ajuste está apagado, el botón no aparece y la API responde `DISABLED_BY_SETTING_SUPPORT_CAN_ASSIGN_RIDER`.
- No puede gestionar el perfil del rider ni su billetera.

---

## 13. Alertas — P-EMP-11

Ruta: `/dashboard/alerts` · Estado: ⬜

- Alertas operativas del inquilino relevantes para atención: `NEW_ORDER`, `ACCEPTANCE_TIMEOUT`, `PREP_DELAY`, `NO_RIDER`, `DELIVERY_FAILED`.
- Acciones: reconocer, resolver, ir al pedido.
- Sin alertas financieras ni de integración.

---

## 14. Permisos y prohibiciones

| Permiso | ¿Lo tiene? | Condición |
|---|:-:|---|
| `order.create_manual` | ✔ | |
| `order.view` | ✔ | Global, lectura |
| `order.note.add` | ✔ | |
| `order.cancel.request` | ✔ | No autoriza |
| `order.address_change.manage` | ✔ | Con aceptación del cliente |
| `order.assign_rider` | (p) | `support.can_assign_rider` (default true) |
| `payment.validate` | ✔ | |
| `payout.restaurant.confirm` | ✔ | |
| `wallet.view_any` | ✔ | Solo lectura |
| `advance.create` | (p) | `support.can_create_advance` (default false) |
| `customer.history.view` | ✔ | |
| `order.accept_reject` | — | |
| `order.start_prepare` / `mark_ready` / `handoff_to_rider` | — | |
| `order.cancel.authorize` | — | |
| `payment.correct` / `refund.manage` | — | |
| `rider.manage` | — | |
| `delivery.update_own` | — | |
| `delivery.second_attempt.authorize` | — | |
| `return.confirm_physical` / `return.resolve` | — | |
| `wallet.view_own` / `wallet.adjust` | — | |
| `settlement.confirm` | — | |
| `incident.loss.decide` | — | |
| `customer.risk_flag.set` | — | |
| `report.*` / `export.*` | — | |
| `audit.view` / `audit.delete` / `ledger.delete` | — | |
| `user.manage` / `settings.global.manage` / `restaurant.manage` | — | |

**Regla de oro del rol:** puede **solicitar** y **atender**, pero no **autorizar** ni **decidir dinero**.
