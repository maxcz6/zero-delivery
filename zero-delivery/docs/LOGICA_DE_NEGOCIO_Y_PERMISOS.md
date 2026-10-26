# Zero Delivery — Lógica de negocio, roles y permisos

> Documento de referencia del MVP. Describe **cómo funciona el negocio**, **qué puede hacer cada rol** y **qué reglas se aplican en el servidor**.
>
> Fecha: 2026-10-26
> Fuentes principales: `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md`, `src/modules/identity/domain/permissions.ts`, `src/modules/orders/domain/transitions.ts`, `src/modules/orders/domain/release-gate.ts`, `src/modules/logistics/domain/eligibility.ts`, `src/modules/wallet/domain/ledger.ts`, `src/modules/payments/domain/payment-rules.ts`, `src/modules/catalog/domain/pricing-policy.ts`, `src/modules/settings/domain/settings-schema.ts`, `drizzle/0000_initial_zero_delivery.sql` y `drizzle/0001_esquema_zero_delivery_es.sql`.

---

## Índice

1. [Resumen del negocio](#1-resumen-del-negocio)
2. [Principios transversales](#2-principios-transversales)
3. [Roles del sistema](#3-roles-del-sistema)
4. [Resumen: qué puede hacer cada rol](#4-resumen-qué-puede-hacer-cada-rol)
5. [Matriz completa de permisos](#5-matriz-completa-de-permisos)
6. [Alcance de datos y privacidad](#6-alcance-de-datos-y-privacidad)
7. [Ciclo de vida del pedido](#7-ciclo-de-vida-del-pedido)
8. [Regla de liberación (guarda de despacho)](#8-regla-de-liberación-guarda-de-despacho)
9. [Pagos](#9-pagos)
10. [Logística y repartidores](#10-logística-y-repartidores)
11. [Garantía, adelantos y liquidaciones](#11-garantía-adelantos-y-liquidaciones)
12. [Cancelaciones, faltantes y cambios de dirección](#12-cancelaciones-faltantes-y-cambios-de-dirección)
13. [Clientes, catálogo y precios](#13-clientes-catálogo-y-precios)
14. [Alertas, auditoría e integraciones](#14-alertas-auditoría-e-integraciones)
15. [Configuración por inquilino](#15-configuración-por-inquilino)
16. [Equivalencia app (inglés) ↔ BD (español)](#16-equivalencia-app-inglés--bd-español)
17. [Estado real de implementación](#17-estado-real-de-implementación)
18. [Decisiones pendientes](#18-decisiones-pendientes)

---

## 1. Resumen del negocio

Zero Delivery es una **plataforma multi-restaurante operada por una agencia de delivery**. Centraliza:

- Pedidos de varias marcas y sucursales.
- Preparación en el local y asignación manual de repartidores.
- Validación humana de pagos (Yape, transferencia y efectivo).
- Regla de liberación antes de que el pedido salga del local.
- Garantía, adelantos y liquidación diaria de repartidores.
- Clientes, alertas operativas, auditoría y reportes.

### Actores

| Actor | Qué hace |
|---|---|
| **Agencia (inquilino)** | Opera la plataforma para uno o varios restaurantes. Es la unidad de aislamiento de datos. |
| **Administrador** | Configura la plataforma, usuarios, roles, restaurantes y reglas globales. |
| **Coordinador** | Dirige la operación: asignación, cancelaciones, pagos, garantías, liquidaciones e incidencias. |
| **Encargado de sucursal** | Acepta pedidos, prepara, marca listo y registra el handoff al repartidor. Solo su sucursal. |
| **Empleado / atención al cliente** | Registra pedidos manuales, valida pagos, atiende consultas y solicita cancelaciones. |
| **Repartidor** | Retira, entrega, cobra efectivo cuando corresponde y comparte su ubicación manualmente. |
| **Cliente final** | Compra (registrado o invitado) y consulta el estado por enlace público. |

### Entidades centrales

`inquilinos` → `restaurantes` → `sucursales` → `cartas` / `productos` / `zonas_entrega`

`clientes` → `pedidos` → `detalle_pedido` → `modificadores_detalle_pedido`

`pedidos` → `pagos`, `pagos_restaurante`, `reembolsos`, `intentos_entrega`, `incidencias_pedido`

`repartidores` → `movimientos_billetera`, `adelantos_repartidor`, `liquidaciones`

`pedidos` → `historial_estados_pedido`, `notas_pedido`, `registro_auditoria`, `eventos_salida`

---

## 2. Principios transversales

| Principio | Regla concreta |
|---|---|
| **Multi-inquilino** | Toda tabla de negocio lleva `inquilino_id`. Toda consulta se filtra por inquilino. Un actor nunca ve datos de otro inquilino. |
| **Autorización en servidor** | Toda acción pasa por `can(actor, action, resource, settings)`. La UI solo oculta botones; **no** autoriza. |
| **Alcance por sucursal** | El Encargado solo opera sobre las sucursales de `acceso_usuario_sucursal`. Fuera de ese alcance: `OUT_OF_BRANCH_SCOPE`. |
| **Alcance por asignación** | El Repartidor solo ve y actualiza los pedidos asignados a él. |
| **Dinero en céntimos** | Todos los importes son enteros (`bigint` / `Cents`). Nunca `float`. S/ 12.50 = `1250`. |
| **Inmutabilidad contable** | `registro_auditoria`, `historial_estados_pedido`, `eventos_pago` y `movimientos_billetera` son de solo inserción. UPDATE/DELETE/TRUNCATE bloqueados por trigger. `eventos_entrada` solo permite actualizar estado, procesado_en, error e intentos. |
| **Nada se borra con historial** | Productos con pedidos se archivan (`archivado_en`), no se eliminan. Pagos se corrigen con motivo, nunca se sobrescriben. |
| **Trazabilidad** | Cada transición de estado, corrección, ajuste, cancelación, reembolso, asignación y cambio sensible se audita con actor, fecha, antes/después y motivo cuando aplica. |
| **Idempotencia** | Los pedidos admiten `clave_idempotencia` única por inquilino. Repetir una transición (mismo origen y destino) es idempotente. Los webhooks se deduplican por `(proveedor, id_evento_externo)`. |
| **Minimización de datos** | No se recopilan datos personales de fuentes externas. El filtro de riesgo del cliente es manual y exige motivo. |

### Autenticación implementada

- Login por `slug` de inquilino + `nombre_usuario` + contraseña.
- Hash de contraseña con **scrypt** (`N=16384, r=8, p=1`), mínimo 10 caracteres.
- **5 intentos fallidos** → bloqueo temporal de **15 minutos**.
- Sesión de **7 días**; se guarda solo el hash SHA-256 del token.
- Cookie `zd_session`: `httpOnly`, `sameSite=lax`, `secure` en producción.
- No hay 2FA, recuperación de contraseña ni login social en el MVP.

---

## 3. Roles del sistema

Nombres internos (código/BD en inglés) y etiqueta visible:

| Código | UI | Ámbito natural |
|---|---|---|
| `ADMIN` | Administrador | Global del inquilino |
| `COORDINATOR` | Coordinador | Global operativo del inquilino |
| `BRANCH_MANAGER` | Encargado | Solo sucursales asignadas |
| `SUPPORT_AGENT` | Empleado (atención al cliente) | Global de atención |
| `RIDER` | Repartidor | Solo sus pedidos asignados |

> En el esquema español (`0001_esquema_zero_delivery_es.sql`) estos valores son `ADMINISTRADOR`, `COORDINADOR`, `ENCARGADO_SUCURSAL`, `AGENTE_SOPORTE` y `REPARTIDOR`. La app actual sigue usando los códigos en inglés.

---

## 4. Resumen: qué puede hacer cada rol

### 4.1 Administrador (`ADMIN`)

**Puede:**

- Crear y administrar usuarios, roles y accesos a sucursales.
- Cambiar configuración global del inquilino.
- Crear restaurantes, sucursales y zonas de entrega.
- Ver reportes financieros globales y auditoría.
- Todo lo operativo: aceptar, preparar, marcar listo, hacer handoff, asignar repartidor.
- Validar pagos, confirmar pago a restaurante, corregir pagos y gestionar reembolsos.
- Autorizar cancelaciones, segundas entregas, devoluciones y resoluciones.
- Ajustar garantías, crear adelantos y confirmar liquidaciones.
- Decidir pérdidas por incidencias y marcar riesgo de clientes.
- **Override de emergencia** de estado: cualquier estado → cualquier estado, con motivo obligatorio y auditoría reforzada.

**No puede:**

- Borrar registros de auditoría ni del libro mayor. **Nadie puede.**
- Ver el saldo propio de un repartidor mediante `wallet.view_own` (usa `wallet.view_any`).
- Evitar la regla de liberación.

### 4.2 Coordinador (`COORDINATOR`)

**Puede:**

- Activar/desactivar sucursales temporalmente.
- Ver todos los pedidos del inquilino y aceptar/rechazar.
- Asignar repartidores, incluyendo segundas entregas.
- Autorizar cancelaciones y resolver devoluciones.
- Validar pagos, confirmar pago a restaurante, corregir pagos y gestionar reembolsos.
- Gestionar perfiles de repartidores.
- Ver y ajustar cualquier billetera, crear adelantos y confirmar liquidaciones.
- Decidir incidencias con pérdida y marcar riesgo de clientes.
- Ver reportes operativos y ventas por sucursal.

**No puede:**

- Administrar usuarios, configuración global ni restaurantes.
- Ver reportes financieros globales ni auditoría.
- Preparar, marcar listo ni registrar handoff (eso es del Encargado).
- Ver el embudo de conversión salvo que el ajuste `reports.coordinator_can_view_funnel` esté activo (por defecto **off**).

### 4.3 Encargado de sucursal (`BRANCH_MANAGER`)

**Puede, solo en sus sucursales:**

- Editar horarios.
- Crear productos y editar disponibilidad y precio.
- Aceptar o rechazar pedidos.
- Iniciar preparación, marcar listo y registrar el handoff físico al repartidor.
- Confirmar la recepción física de una devolución.
- Ver pedidos de su sucursal y reportes operativos.
- Ver ventas de su sucursal **solo si** `reports.branch_manager_can_view_sales` está activo (por defecto **off**).

**No puede:**

- Crear pedidos manuales.
- Asignar repartidores.
- Validar pagos, confirmar payout, corregir pagos ni reembolsar.
- Autorizar cancelaciones, segundas entregas ni resolver devoluciones.
- Ver billeteras, adelantos, liquidaciones ni historial de clientes.
- Ver la ubicación GPS del repartidor, el margen de la agencia ni datos del cliente más allá de lo necesario para preparar.
- Ver el detalle del reparto después de la salida: solo el estado final (`DELIVERED`, `DELIVERY_FAILED` o devolución). En el DTO se muestra como `DISPATCHED_IN_TRANSIT`.

### 4.4 Empleado / atención al cliente (`SUPPORT_AGENT`)

**Puede:**

- Crear pedidos manuales.
- Ver todos los pedidos y el historial individual de clientes.
- Agregar notas.
- Solicitar cancelaciones (no autorizarlas).
- Gestionar cambios de dirección (con aceptación del cliente).
- Validar pagos y confirmar pago a restaurante.
- Ver cualquier billetera en modo lectura.
- Asignar repartidor **si** `support.can_assign_rider` está activo (por defecto **sí**).
- Crear adelantos **si** `support.can_create_advance` está activo (por defecto **no**).

**No puede:**

- Aceptar/rechazar, preparar, marcar listo ni hacer handoff.
- Autorizar cancelaciones, corregir pagos, reembolsar o ajustar garantías.
- Confirmar liquidaciones, decidir pérdidas ni marcar riesgo de clientes.
- Gestionar repartidores.
- Ver reportes macro, reportes financieros ni auditoría.

### 4.5 Repartidor (`RIDER`)

**Puede:**

- Ver **solo** los pedidos asignados a él.
- Registrar `RIDER_AT_PICKUP`, `ON_THE_WAY`, `DELIVERED`, `DELIVERY_FAILED` y devolución pendiente.
- Registrar el cobro en efectivo al entregar.
- Agregar notas de incidencia.
- Compartir su ubicación manualmente.
- Ver su propia billetera y garantía.
- Ver sus propias métricas operativas.
- Exportar sus métricas operativas.

**No puede:**

- Ver pedidos de otros repartidores.
- Asignarse pedidos, cancelar, reembolsar ni ajustar saldos.
- Ver reportes globales, ventas, auditoría ni datos de clientes que no sean de sus pedidos activos.
- Cobrar efectivo si tiene deuda o garantía insuficiente (lo bloquea la elegibilidad).
- Continuar tras 2 intentos fallidos sin autorización del Coordinador.

---

## 5. Matriz completa de permisos

Leyenda: **✔** permitido · **—** no permitido · **(p)** depende de un ajuste · **(propio)** solo en su sucursal · **(asignado)** solo pedidos asignados a él.

### 5.1 Administración y catálogo

| Permiso | ADMIN | COORD | ENCARGADO | EMPLEADO | RIDER |
|---|:-:|:-:|:-:|:-:|:-:|
| `user.manage` — usuarios y roles | ✔ | — | — | — | — |
| `settings.global.manage` — configuración global | ✔ | — | — | — | — |
| `restaurant.manage` — restaurantes y sucursales | ✔ | — | — | — | — |
| `branch.toggle` — abrir/cerrar sucursal | ✔ | ✔ | — | — | — |
| `branch.schedule.edit` — horarios | ✔ | ✔ | ✔ propio | — | — |
| `product.create` — crear producto | ✔ | ✔ | ✔ propio | — | — |
| `product.availability.edit` — disponibilidad | ✔ | ✔ | ✔ propio | — | — |
| `product.price.edit` — precio | ✔ | ✔ | ✔ propio | — | — |

### 5.2 Pedidos

| Permiso | ADMIN | COORD | ENCARGADO | EMPLEADO | RIDER |
|---|:-:|:-:|:-:|:-:|:-:|
| `order.create_manual` | ✔ | ✔ | — | ✔ | — |
| `order.view` | ✔ todas | ✔ operativo | ✔ propio | ✔ lectura | ✔ asignados |
| `order.accept_reject` | ✔ | ✔ | ✔ propio | — | — |
| `order.start_prepare` | ✔ | — | ✔ propio | — | — |
| `order.mark_ready` | ✔ | — | ✔ propio | — | — |
| `order.handoff_to_rider` | ✔ | — | ✔ propio | — | — |
| `order.assign_rider` | ✔ | ✔ | — | ✔ (p) | — |
| `order.note.add` | ✔ | ✔ | ✔ | ✔ | ✔ incidencia |
| `order.cancel.request` | ✔ | ✔ | — | ✔ | — |
| `order.cancel.authorize` | ✔ | ✔ | — | — | — |
| `order.address_change.manage` | ✔ | ✔ | — | ✔ | — |

`order.assign_rider` para Empleado depende de `support.can_assign_rider` (por defecto **true**).

### 5.3 Pagos

| Permiso | ADMIN | COORD | ENCARGADO | EMPLEADO | RIDER |
|---|:-:|:-:|:-:|:-:|:-:|
| `payment.validate` — validar Yape/transferencia | ✔ | ✔ | — | ✔ | — |
| `payout.restaurant.confirm` — pago al restaurante | ✔ | ✔ | — | ✔ | — |
| `payment.correct` — corregir con motivo | ✔ | ✔ | — | — | — |
| `refund.manage` — reembolsos manuales | ✔ | ✔ | — | — | — |

### 5.4 Logística

| Permiso | ADMIN | COORD | ENCARGADO | EMPLEADO | RIDER |
|---|:-:|:-:|:-:|:-:|:-:|
| `rider.manage` — perfil, flota, vehículo | ✔ | ✔ | — | — | — |
| `delivery.update_own` — estados de entrega | ✔ override | — | — | — | ✔ propio |
| `delivery.second_attempt.authorize` | ✔ | ✔ | — | — | — |
| `return.confirm_physical` — recepción física | ✔ | ✔ | ✔ propio | — | — |
| `return.resolve` — resolver devolución | ✔ | ✔ | — | — | — |

### 5.5 Finanzas del repartidor

| Permiso | ADMIN | COORD | ENCARGADO | EMPLEADO | RIDER |
|---|:-:|:-:|:-:|:-:|:-:|
| `wallet.view_own` | — | — | — | — | ✔ |
| `wallet.view_any` | ✔ | ✔ | — | ✔ lectura | — |
| `wallet.adjust` — ajuste con motivo | ✔ | ✔ | — | — | — |
| `advance.create` — adelanto | ✔ | ✔ | — | ✔ (p) | — |
| `settlement.confirm` — liquidación | ✔ | ✔ | — | — | — |
| `incident.loss.decide` — pérdida | ✔ | ✔ | — | — | — |

`advance.create` para Empleado depende de `support.can_create_advance` (por defecto **false**).

### 5.6 Clientes y reportes

| Permiso | ADMIN | COORD | ENCARGADO | EMPLEADO | RIDER |
|---|:-:|:-:|:-:|:-:|:-:|
| `customer.history.view` | ✔ | ✔ | — | ✔ | — |
| `customer.risk_flag.set` | ✔ | ✔ | — | — | — |
| `report.global_financial` | ✔ | — | — | — | — |
| `report.operational` | ✔ global | ✔ global | ✔ propio | — | ✔ propias |
| `report.branch_sales` | ✔ | ✔ | (p) propio | — | — |
| `report.funnel` | ✔ | (p) | — | — | — |
| `audit.view` | ✔ | — | — | — | — |
| `audit.delete` | — | — | — | — | — |
| `ledger.delete` | — | — | — | — | — |

- `reports.branch_manager_can_view_sales`: por defecto **false**.
- `reports.coordinator_can_view_funnel`: por defecto **false**.

### 5.7 Exportación

| Permiso | Regla |
|---|---|
| `export.global_financial` | Igual que `report.global_financial` |
| `export.operational` | Igual que `report.operational` |
| `export.branch_sales` | Igual que `report.branch_sales` |
| `export.funnel` | Igual que `report.funnel` |

**Nunca** se puede exportar más de lo que se puede leer.

---

## 6. Alcance de datos y privacidad

### 6.1 Reglas de alcance

1. **Inquilino:** si el recurso pertenece a otro inquilino → `TENANT_MISMATCH`. Aplica incluso al Administrador.
2. **Sucursal:** el Encargado solo accede a las sucursales de `acceso_usuario_sucursal`. Sin alcance → `OUT_OF_BRANCH_SCOPE`.
3. **Asignación:** el Repartidor solo accede a pedidos con `repartidor_id` igual a su propio `riderId`. Sin asignación → `NOT_ASSIGNED_TO_RIDER`.
4. **Rol:** si el rol no está autorizado → `ROLE_NOT_AUTHORIZED` o el motivo específico (`ADMIN_ONLY`, `STAFF_ONLY`, etc.).
5. **Ajuste desactivado:** si la acción depende de un ajuste y está apagado → `DISABLED_BY_SETTING_*`.

### 6.2 Qué ve cada uno

| Dato | Cliente | Rider | Encargado | Empleado | Coordinador | Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Estado del pedido | ✔ | ✔ asignado | ✔ propio | ✔ | ✔ | ✔ |
| Nombre/teléfono/dirección | ✔ suyo | ✔ asignado y activo | ✔ necesario para preparar | ✔ | ✔ | ✔ |
| Precio final | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Desglose interno (base, empaque, margen) | — | — | Parcial (sin margen) | ✔ | ✔ | ✔ |
| Pago al restaurante | — | — | ✔ | ✔ | ✔ | ✔ |
| Ubicación GPS del rider | — | ✔ propia | — | ✔ lectura | ✔ lectura | ✔ lectura |
| Billetera del rider | — | ✔ propia | — | ✔ lectura | ✔ | ✔ |
| Auditoría | — | — | — | — | — | ✔ |

### 6.3 DTOs

- **`CustomerOrderDTO`**: número, sucursal, estado, método/estado de pago, total, ítems (nombre, cantidad, precio unitario, total de línea). **Jamás** incluye base, empaque, margen, payout ni GPS.
- **`BranchManagerOrderDTO`**: pedido de su sucursal, ítems con base/empaque (sin margen), payout y handoff. Estado `ON_THE_WAY` se muestra como `DISPATCHED_IN_TRANSIT`.
- **`StaffOrderDTO`**: registro completo para Admin, Coordinador y Empleado.

---

## 7. Ciclo de vida del pedido

### 7.1 Tres ejes independientes

| Eje | Campo | Valores |
|---|---|---|
| Operativo / logístico | `estado_operativo` | 15 estados (ver abajo) |
| Pago al cliente | `estado_pago` | `PENDIENTE`, `PAGADO`, `RECHAZADO`, `REEMBOLSADO` |
| Pago al restaurante | `estado_pago_restaurante` | `PENDIENTE`, `CONFIRMADO` |

Además:

- `traspaso_en` / `traspaso_por`: entrega física del pedido al repartidor (handoff).
- `liberado_en` / `liberado_por`: autorización de salida.
- `version`: bloqueo optimista, se incrementa en cada UPDATE.

**Un pedido puede estar `PAGADO` o `PENDIENTE` independientemente de si está `EN_PREPARACION` o `LISTO`.** La salida sí exige la regla de liberación.

### 7.2 Estados operativos

| Código (app) | Español BD | Significado |
|---|---|---|
| `NEW` | `NUEVO` | Recibido, sin aceptar |
| `CONFIRMED` | `CONFIRMADO` | Aceptado por el local |
| `PREPARING` | `EN_PREPARACION` | En cocina |
| `READY` | `LISTO` | Listo para despacho |
| `RIDER_ASSIGNED` | `REPARTIDOR_ASIGNADO` | Rider asignado |
| `RIDER_AT_PICKUP` | `REPARTIDOR_EN_RECOJO` | Rider llegó al local |
| `ON_THE_WAY` | `EN_CAMINO` | Salió del local |
| `DELIVERED` | `ENTREGADO` | Entregado |
| `REJECTED` | `RECHAZADO` | Rechazado por el local |
| `CANCELLATION_REQUESTED` | `CANCELACION_SOLICITADA` | Cancelación solicitada |
| `CANCELLED` | `CANCELADO` | Cancelado |
| `DELIVERY_FAILED` | `ENTREGA_FALLIDA` | Intento fallido |
| `RETURN_PENDING` | `DEVOLUCION_PENDIENTE` | Debe volver al local |
| `RETURNED_TO_RESTAURANT` | `DEVUELTO_A_RESTAURANTE` | Devuelto físicamente |
| `PENDING_RESOLUTION` | `PENDIENTE_RESOLUCION` | Requiere decisión del Coordinador |

### 7.3 Tabla de transiciones

| De → A | Roles | Guardas / condición | Motivo |
|---|---|---|:-:|
| `NEW → CONFIRMED` | Encargado, Coordinador, Admin | Sucursal abierta y productos disponibles | — |
| `NEW → REJECTED` | Encargado, Coordinador, Admin | — | Obligatorio |
| `CONFIRMED → PREPARING` | Encargado, Admin | — | — |
| `PREPARING → READY` | Encargado, Admin | — | — |
| `READY → RIDER_ASSIGNED` | Coordinador, Empleado (p), Admin | Rider elegible | — |
| `RIDER_ASSIGNED → RIDER_AT_PICKUP` | Rider, Admin | Es el rider asignado | — |
| `RIDER_AT_PICKUP → ON_THE_WAY` | Rider, Admin | Rider asignado + **regla de liberación** | — |
| `ON_THE_WAY → DELIVERED` | Rider, Admin | Rider asignado + cobro registrado (si efectivo) | — |
| `ON_THE_WAY → DELIVERY_FAILED` | Rider, Admin | Rider asignado | Obligatorio |
| `DELIVERY_FAILED → RIDER_ASSIGNED` | Coordinador, Admin | Segundo intento autorizado + rider elegible | — |
| `DELIVERY_FAILED → RETURN_PENDING` | Rider, Coordinador, Admin | — | — |
| `DELIVERY_FAILED → PENDING_RESOLUTION` | Sistema, Coordinador, Admin | Se alcanzó el máximo de intentos | — |
| `RETURN_PENDING → RETURNED_TO_RESTAURANT` | Encargado, Coordinador, Admin | Recepción física confirmada | — |
| `RETURNED_TO_RESTAURANT → PENDING_RESOLUTION` | Coordinador, Admin | — | — |
| `PENDING_RESOLUTION → CANCELLED` | Coordinador, Admin | Resolución provista | Obligatorio |
| `PENDING_RESOLUTION → RIDER_ASSIGNED` | Coordinador, Admin | Segundo intento autorizado + rider elegible | — |
| `{NEW…RIDER_AT_PICKUP} → CANCELLATION_REQUESTED` | Empleado, Coordinador, Admin | — | Obligatorio |
| `CANCELLATION_REQUESTED → CANCELLED` | Coordinador, Admin | — | Obligatorio |
| `CANCELLATION_REQUESTED → estado previo` | Coordinador, Admin | Denegar la solicitud | — |
| Cualquier estado → cualquier estado | Admin | Override de emergencia | Obligatorio |

Estados cancelables antes del despacho: `NEW`, `CONFIRMED`, `PREPARING`, `READY`, `RIDER_ASSIGNED`, `RIDER_AT_PICKUP`.

### 7.4 Reglas de ejecución

- Cada transición corre en **una transacción** con `SELECT … FOR UPDATE` sobre el pedido y bloqueo optimista por `version`.
- Si `from === to`, la operación es **idempotente**: no duplica historial ni efectos.
- Toda transición escribe en `historial_estados_pedido` y `registro_auditoria`, y encola eventos en `eventos_salida`.
- El Kanban solo muestra columnas y acciones permitidas para el rol.
- Si una transición no existe, se rechaza con `INVALID_STATE_TRANSITION`; si el rol no corresponde, con `FORBIDDEN`; si falta el motivo, con `VALIDATION_ERROR`.
- El motivo debe tener al menos **3 caracteres**.

### 7.5 Numeración, idempotencia y versión

- `numero` es secuencial **por inquilino** y lo asigna el disparador `pedidos_antes_escribir`.
- La app inserta `numero = 0`; el trigger lo reemplaza por el siguiente contador (`numero_pedido`).
- `clave_idempotencia` es única por inquilino cuando no es nula: evita duplicar pedidos por reintentos.
- `token_publico` es único y aleatorio: alimenta la página pública de estado.
- Cada UPDATE incrementa `version`; si la versión esperada no coincide → conflicto.

---

## 8. Regla de liberación (guarda de despacho)

**Un pedido solo puede pasar a `ON_THE_WAY` si se cumplen las cuatro condiciones:**

1. **Repartidor asignado y elegible** para ese pedido.
2. **Pago anticipado validado** si el método es Yape o transferencia:
   - `estado_pago = PAGADO`, **y**
   - el pago tiene `validado_por` y `validado_en` (validación humana).
   - Subir un comprobante **no** equivale a pago válido.
3. **Pago al restaurante confirmado**:
   - `estado_pago_restaurante = CONFIRMADO`, **y**
   - existe pago con `confirmado_por` y `confirmado_en`.
   - Aplica tanto a efectivo como a pago anticipado.
4. **Handoff físico registrado** por el Encargado:
   - `traspaso_en`, `traspaso_por` y `liberado_por` presentes.

El handoff **se rechaza** si el pago al restaurante no está confirmado (`canRegisterHandoff`). El sistema registra siempre **quién** liberó y **cuándo**.

Fallos posibles: `RIDER_NOT_ASSIGNED`, `RIDER_NOT_ELIGIBLE`, `PREPAID_PAYMENT_NOT_VALIDATED`, `RESTAURANT_PAYOUT_NOT_CONFIRMED`, `HANDOFF_NOT_REGISTERED`.

> Esta regla se refuerza también en la base de datos con `pedidos_traspaso_requiere_pago_chk` y `pedidos_control_despacho_chk`.

---

## 9. Pagos

### 9.1 Métodos y estados

| Método | Comportamiento |
|---|---|
| `EFECTIVO` | El repartidor cobra al entregar. Afecta su garantía. |
| `YAPE` | Va directo al local. El rider ve “ya pagado, sin cobro”. Requiere validación humana. |
| `TRANSFERENCIA_BANCARIA` | Igual que Yape. Requiere validación humana. |

Estados: `PENDIENTE`, `PAGADO`, `RECHAZADO`, `REEMBOLSADO`.

Un pago solo puede marcarse `PAGADO` o `REEMBOLSADO` si tiene `validado_por` y `validado_en`.

### 9.2 Correcciones

- Solo Admin y Coordinador.
- Exigen **motivo** (mínimo 4 caracteres en el dominio).
- Guardan **valor anterior y nuevo** en `eventos_pago` (`CORREGIDO`).
- Nunca se borra el pago original: se conserva el historial.

### 9.3 Reembolsos

- Manuales: no hay API automática de Yape ni bancos.
- Autorizados por Coordinador o Admin.
- Registran importe, motivo, autor, fecha y confirmación.

### 9.4 Pago al restaurante

- Un pedido tiene como máximo un registro (`UNIQUE pedido_id`).
- Confirmarlo exige `confirmado_por` y `confirmado_en`.
- Es requisito para el handoff y para la liberación.

### 9.5 Efectivo

- `efectivo_por_cobrar_centavos` no puede superar el total.
- Solo aplica a pedidos en efectivo; en prepago debe ser 0.
- Al entregar, el rider registra el importe cobrado; si difiere del esperado, se exige motivo y se crea una incidencia.

---

## 10. Logística y repartidores

### 10.1 Elegibilidad para asignar (`canAssignRider`)

Un rider es elegible si:

1. Está **activo**.
2. Su estado es `DISPONIBLE`; se admite `OCUPADO` **solo si** `repartidor.permitir_multiples_pedidos` está activo.
3. Si el pedido tiene productos **frágiles** y exige auto, su vehículo debe ser `AUTO`.

**Si el pedido es en efectivo:**

4. Si tiene **deuda** (`saldo < 0`) → **bloqueado** siempre. Se muestra importe y motivo.
5. Si no tiene deuda, hay exención de garantía cuando:
   - tiene al menos la **edad mínima** (`repartidor.edad_minima_efectivo_sin_garantia`, por defecto 35), **o**
   - está marcado como **alta confianza** por Admin/Coordinador.
6. Si no está exento: `saldo >= max(garantía mínima, efectivo por cobrar)`.

**Pedidos ya pagados (Yape/transferencia) no se bloquean por garantía.** Se distingue “bloqueado solo para efectivo” de “no disponible”.

### 10.2 Handoff

- Lo registra el Encargado de la sucursal (o Admin).
- Es la entrega física del pedido al repartidor.
- **No se permite** si el pago al restaurante no está confirmado.
- Queda registrado con actor y fecha.

### 10.3 Intentos de entrega

- El rider registra motivo, observaciones, hora y foto **opcional**.
- Se crea un intento con número correlativo.
- **Máximo 2 intentos** (`entrega.maximo_intentos = 2`).
- El **segundo intento exige autorización del Coordinador** (queda registrada).
- Si el segundo intento falla → `PENDING_RESOLUTION`. **No** se programa un tercero.

### 10.4 Devoluciones

1. `DELIVERY_FAILED → RETURN_PENDING`.
2. El Encargado confirma la recepción física → `RETURNED_TO_RESTAURANT`.
3. El Coordinador decide:
   - `CANCELLED` con resolución obligatoria, o
   - reintento autorizado si aún quedan intentos.

### 10.5 Espera en el local

- El rider espera hasta **15 minutos** (`repartidor.minutos_espera_recojo`).
- Al llegar se registra `RIDER_AT_PICKUP` y se calcula el tiempo transcurrido.
- Si supera el umbral, **solo se genera una alerta** al Coordinador.
- Qué hacer después está pendiente (DECISION-07): no hay reasignación ni compensación automática.

### 10.6 Ubicación

- Se comparte **manualmente** con el botón “Compartir ubicación”.
- Se guarda el último ping (`ubicaciones_repartidor`).
- Admin, Coordinador y Empleado (lectura) pueden verlo. **El cliente nunca.**
- No hay mapa en tiempo real; se ofrece enlace a Google Maps sin API key.

---

## 11. Garantía, adelantos y liquidaciones

### 11.1 Libro mayor de garantía

- Es un libro **de solo inserción**.
- El saldo **nunca** se guarda: se calcula como `SUM(monto_centavos)`.
- `monto_centavos` lleva signo: `+` aumenta la garantía, `-` la reduce.

| Tipo | Signo | Regla |
|---|:-:|---|
| `DEPOSITO_GARANTIA` | + | Importe > 0 |
| `RETIRO_GARANTIA` | − | Importe < 0 |
| `EFECTIVO_COBRADO` | − | Importe < 0 y requiere `pedido_id` |
| `EFECTIVO_LIQUIDADO` | + | Importe > 0 y requiere `liquidacion_id` |
| `AJUSTE` | ± | Importe ≠ 0 y motivo obligatorio |

Reglas adicionales:

- Un pedido solo puede generar **un** `EFECTIVO_COBRADO`.
- Una liquidación solo puede generar **un** `EFECTIVO_LIQUIDADO`.
- Si el saldo es negativo, el rider tiene **deuda** y no puede tomar pedidos en efectivo hasta regularizar.

### 11.2 Adelantos

- Requieren autorización humana.
- Propósito típico: combustible.
- Se descuentan **una sola vez** en la liquidación.
- Estado: `PENDIENTE_DEDUCCION` → `DEDUCIDO`, con `deducido_en_liquidacion_id` obligatorio al deducir.

### 11.3 Liquidación diaria

- Una por rider y día operativo (`fecha_operativa` en America/Lima).
- Hora de corte configurable (`liquidacion.hora_corte`, por defecto 23:00).
- Fórmula:

```text
neto = tarifa_pagable
     - adelantos_deducidos
     - (efectivo_cobrado - efectivo_recibido)
```

- Si la tarifa pagable difiere de la de referencia, se exige **motivo**.
- Confirmar exige `confirmado_por` y `confirmado_en`.
- Si el rider recibió menos efectivo del cobrado, la diferencia **permanece** como garantía reducida o deuda. Nunca se perdona automáticamente.

---

## 12. Cancelaciones, faltantes y cambios de dirección

### 12.1 Cancelaciones

- **Solicitan:** Empleado, Coordinador o Admin.
- **Autorizan:** Coordinador o Admin.
- Se guarda el **estado previo** para poder revertir si se deniega.
- Si ya inició la preparación, el Coordinador revisa y cualquier cobro debe justificarse y comunicarse.
- Motivo obligatorio en la solicitud y en la autorización.

### 12.2 Producto faltante

1. El Encargado marca el ítem como no disponible con motivo.
2. Se notifica al cliente y al Coordinador.
3. El cliente decide:
   - **reemplazo** (se registra decisión y diferencia de precio), o
   - **cancelar solo ese ítem**.
4. El resto del pedido continúa.

Estados del ítem: `ACTIVO`, `NO_DISPONIBLE`, `REEMPLAZADO`, `CANCELADO`.

### 12.3 Cambio de dirección

1. Se recalcula el costo de entrega.
2. Se comunica al cliente.
3. **Requiere aceptación** del costo adicional.
4. Si no acepta, se detiene el cambio y decide el Coordinador.

---

## 13. Clientes, catálogo y precios

### 13.1 Clientes

- Identificación y deduplicación por **teléfono E.164** dentro del inquilino.
- Formato peruano: `+51` + 9 dígitos que empiezan en 9.
- Compras como invitado permitidas.
- Segmentos:
  - `NUEVO`: 0–1 pedidos entregados.
  - `RECURRENTE`: desde 2 pedidos.
  - `TOP`: desde `cliente.minimo_pedidos_top` (por defecto 10).
- **Riesgo manual:** `NINGUNO`, `PRECAUCION`, `BLOQUEADO`.
  - Solo Admin/Coordinador.
  - Exige motivo y responsable.
  - Queda auditado.
  - **Prohibido** buscar, scrapear o recopilar datos personales de fuentes externas.

### 13.2 Catálogo

- Productos con precio base, empaque, margen, frágil y archivado.
- Modificadores con incremento/decremento de precio.
- Cartas por sucursal; una sola predeterminada.
- Disponibilidad por carta/sucursal.
- Un producto con historial **no se borra**: se archiva.

### 13.3 Precios y margen (provisional)

```text
margen = FIJO ? round(valor_margen)
              : round(precio_base * valor_margen / 100)

precio_unitario = precio_base + empaque + margen + modificadores
total_línea     = cantidad * precio_unitario
```

- La fórmula definitiva **no está aprobada** (DECISION-01).
- No se usa para reportes financieros oficiales.
- El desglose interno **nunca** se muestra al cliente.
- Impuestos = 0 en el MVP; `factura_solicitada` solo se guarda.
- El dinero cobrado al cliente **no es ingreso de la agencia**: pertenece al restaurante, a la tarifa de entrega y al margen.

---

## 14. Alertas, auditoría e integraciones

### 14.1 Alertas

Tipos:

- `NEW_ORDER`
- `ACCEPTANCE_TIMEOUT`
- `PREP_DELAY`
- `NO_RIDER`
- `PICKUP_WAIT_EXCEEDED`
- `DELIVERY_FAILED`
- `INTEGRATION_DEAD_LETTER`

Severidad: `INFO`, `ADVERTENCIA`, `CRITICO`.

- `clave_deduplicacion` evita duplicados por inquilino.
- Si vence el tiempo de aceptación, **solo se alerta** al Coordinador; **no** se cancela automáticamente.

### 14.2 Auditoría

Se audita:

- Inicios de sesión y eventos de seguridad.
- Cambios de usuarios, roles y permisos.
- Productos, precios y tarifas.
- Pagos, correcciones, reembolsos y liberaciones.
- Asignaciones y reasignaciones.
- Cambios de estado.
- Liquidaciones, garantías y adelantos.
- Cancelaciones y devoluciones.
- Cambios de configuración.

La auditoría guarda actor, rol, fecha, acción, objeto y valores antes/después. Es **inmutable** a nivel de base de datos.

### 14.3 Outbox y webhooks

- `eventos_salida`: notificaciones, CRM y otros efectos secundarios.
  - Estados: `PENDIENTE`, `PROCESANDO`, `ENVIADO`, `FALLIDO`, `MUERTO`.
  - Reintentos con espera incremental; los agotados quedan como muertos.
- `eventos_entrada`: webhooks entrantes.
  - Idempotencia por `(proveedor, id_evento_externo)`.
  - Solo se puede actualizar estado, procesado_en, error e intentos.
- Vocero CRM: firma HMAC `X-Vocero-Signature`, endpoints `/api/bot/*`, **detrás de feature flag** (`funcionalidad.integracion.vocero`, por defecto off).
- WhatsApp: preparado, **desactivado**.

---

## 15. Configuración por inquilino

18 claves. La app las usa en inglés; el esquema español las guarda traducidas.

| Clave app (EN) | Clave BD (ES) | Defecto | Estado |
|---|---|---|:-:|
| `order.acceptance_timeout_minutes` | `pedido.minutos_espera_aceptacion` | 5 | Provisional (DECISION-05) |
| `order.prep_delay_threshold_minutes` | `pedido.minutos_umbral_demora_preparacion` | 30 | Provisional (DECISION-05) |
| `order.no_rider_threshold_minutes` | `pedido.minutos_umbral_sin_repartidor` | 10 | Provisional (DECISION-05) |
| `rider.pickup_wait_minutes` | `repartidor.minutos_espera_recojo` | 15 | Aprobado; acción pendiente (DECISION-07) |
| `rider.min_age_for_cash_without_guarantee` | `repartidor.edad_minima_efectivo_sin_garantia` | 35 | Provisional (DECISION-02) |
| `rider.allow_multiple_orders` | `repartidor.permitir_multiples_pedidos` | false | Provisional |
| `guarantee.min_cents` | `garantia.minimo_centavos` | 0 | Provisional (DECISION-02) |
| `delivery.max_attempts` | `entrega.maximo_intentos` | 2 | Aprobado |
| `settlement.cutoff_time` | `liquidacion.hora_corte` | `"23:00"` | Provisional |
| `customer.top_min_orders` | `cliente.minimo_pedidos_top` | 10 | Provisional |
| `reports.branch_manager_can_view_sales` | `reportes.encargado_sucursal_puede_ver_ventas` | false | Pendiente (DECISION-04) |
| `reports.coordinator_can_view_funnel` | `reportes.coordinador_puede_ver_embudo` | false | Pendiente (DECISION-04) |
| `support.can_assign_rider` | `soporte.puede_asignar_repartidor` | true | Activo |
| `support.can_create_advance` | `soporte.puede_crear_adelanto` | false | Provisional |
| `feature.integration.vocero` | `funcionalidad.integracion.vocero` | false | Feature flag (DECISION-09) |
| `feature.integration.whatsapp` | `funcionalidad.integracion.whatsapp` | false | Feature flag |
| `locale.timezone` | `localizacion.zona_horaria` | `"America/Lima"` | Fijo |
| `locale.currency` | `localizacion.moneda` | `"PEN"` | Fijo |

`es_marcador = true` en la BD indica que el valor **no está aprobado** por el negocio.

---

## 16. Equivalencia app (inglés) ↔ BD (español)

El código actual usa valores en inglés; `0001_esquema_zero_delivery_es.sql` los tradujo. **Si se ejecuta la app contra el esquema español sin adaptar el código, fallará** en logins, estados, roles, permisos y configuración.

### Roles

| App | BD español |
|---|---|
| `ADMIN` | `ADMINISTRADOR` |
| `COORDINATOR` | `COORDINADOR` |
| `BRANCH_MANAGER` | `ENCARGADO_SUCURSAL` |
| `SUPPORT_AGENT` | `AGENTE_SOPORTE` |
| `RIDER` | `REPARTIDOR` |

### Estados del pedido

| App | BD español |
|---|---|
| `NEW` | `NUEVO` |
| `CONFIRMED` | `CONFIRMADO` |
| `PREPARING` | `EN_PREPARACION` |
| `READY` | `LISTO` |
| `RIDER_ASSIGNED` | `REPARTIDOR_ASIGNADO` |
| `RIDER_AT_PICKUP` | `REPARTIDOR_EN_RECOJO` |
| `ON_THE_WAY` | `EN_CAMINO` |
| `DELIVERED` | `ENTREGADO` |
| `REJECTED` | `RECHAZADO` |
| `CANCELLATION_REQUESTED` | `CANCELACION_SOLICITADA` |
| `CANCELLED` | `CANCELADO` |
| `DELIVERY_FAILED` | `ENTREGA_FALLIDA` |
| `RETURN_PENDING` | `DEVOLUCION_PENDIENTE` |
| `RETURNED_TO_RESTAURANT` | `DEVUELTO_A_RESTAURANTE` |
| `PENDING_RESOLUTION` | `PENDIENTE_RESOLUCION` |

### Otros valores

| App | BD español |
|---|---|
| `PENDING` / `PAID` / `REJECTED` / `REFUNDED` | `PENDIENTE` / `PAGADO` / `RECHAZADO` / `REEMBOLSADO` |
| `CASH` / `YAPE` / `BANK_TRANSFER` | `EFECTIVO` / `YAPE` / `TRANSFERENCIA_BANCARIA` |
| `AVAILABLE` / `BUSY` / `ON_THE_WAY` / `OFFLINE` | `DISPONIBLE` / `OCUPADO` / `EN_CAMINO` / `DESCONECTADO` |
| `OWN` / `AGENCY` / `THIRD_PARTY` | `PROPIO` / `AGENCIA` / `TERCERO` |
| `MOTO` / `CAR` | `MOTO` / `AUTO` |
| `NEW` / `RECURRING` / `TOP` | `NUEVO` / `RECURRENTE` / `TOP` |
| `NONE` / `CAUTION` / `BLOCKED` | `NINGUNO` / `PRECAUCION` / `BLOQUEADO` |
| `GUARANTEE_DEPOSIT` / `GUARANTEE_WITHDRAWAL` | `DEPOSITO_GARANTIA` / `RETIRO_GARANTIA` |
| `CASH_COLLECTED` / `CASH_SETTLED` / `ADJUSTMENT` | `EFECTIVO_COBRADO` / `EFECTIVO_LIQUIDADO` / `AJUSTE` |
| `INFO` / `WARNING` / `CRITICAL` | `INFO` / `ADVERTENCIA` / `CRITICO` |
| `OPEN` / `ACK` / `RESOLVED` | `ABIERTA` / `RECONOCIDA` / `RESUELTA` |
| `DRAFT` / `CONFIRMED` (liquidación) | `BORRADOR` / `CONFIRMADO` |
| `ACTIVE` / `UNAVAILABLE` / `REPLACED` / `CANCELLED` (ítem) | `ACTIVO` / `NO_DISPONIBLE` / `REEMPLAZADO` / `CANCELADO` |
| `IN_PROGRESS` / `DELIVERED` / `FAILED` (intento) | `EN_PROGRESO` / `ENTREGADO` / `FALLIDO` |
| `CREATED` / `VALIDATED` / `REJECTED` / `CORRECTED` / `REFUNDED` (evento de pago) | `CREADO` / `VALIDADO` / `RECHAZADO` / `CORREGIDO` / `REEMBOLSADO` |
| `REPLACEMENT_ACCEPTED` / `ITEM_CANCELLED` (decisión del cliente) | `REEMPLAZO_ACEPTADO` / `ITEM_CANCELADO` |

---

## 17. Estado real de implementación

### 17.1 Implementado en dominio (con pruebas)

| Área | Archivo |
|---|---|
| RBAC y matriz de permisos | `src/modules/identity/domain/permissions.ts` |
| Transiciones de estado | `src/modules/orders/domain/transitions.ts` |
| Regla de liberación | `src/modules/orders/domain/release-gate.ts` |
| Elegibilidad del rider | `src/modules/logistics/domain/eligibility.ts` |
| Intentos y espera | `src/modules/logistics/domain/delivery-attempts.ts` |
| Garantía y liquidación | `src/modules/wallet/domain/ledger.ts` |
| Corrección de pagos | `src/modules/payments/domain/payment-rules.ts` |
| Precios provisionales | `src/modules/catalog/domain/pricing-policy.ts` |
| Segmento y riesgo de cliente | `src/modules/customers/domain/customer.ts` |
| Horarios de sucursal | `src/modules/tenancy/domain/schedule.ts` |
| Deduplicación de alertas | `src/modules/alerts/domain/alerts.ts` |
| Autenticación y bloqueo | `src/modules/identity/application/auth.service.ts` |
| DTOs por rol | `src/modules/orders/domain/dtos.ts` |

Pruebas existentes: `tests/unit/permissions.test.ts`, `release-gate-and-transitions.test.ts`, `rider-eligibility-and-wallet.test.ts`, `pricing-and-dtos.test.ts`.

### 17.2 Implementado en API/UI

- `POST /api/v1/auth/login` y `POST /api/v1/auth/logout`.
- `GET /api/v1/health`.
- Webhooks: `/api/webhooks/[provider]` y health de Vocero.
- Páginas: login, dashboard de staff, entregas del rider, menú público y estado público.
- **Las pantallas son aún esqueléticas**: muestran tarjetas y textos, no el Kanban ni los formularios completos.

### 17.3 Aún no implementado

- CRUD de pedidos, Kanban y acciones de estado por API.
- CRUD de catálogo, cartas, zonas y horarios.
- Validación de pagos y payout por API.
- Asignación de riders y PWA funcional.
- Reportes y exportación CSV reales.
- Motor de alertas y jobs de liquidación.
- Integración real con Vocero/WhatsApp.

### 17.4 Advertencia sobre el esquema español

- `drizzle/0000_initial_zero_delivery.sql` es el esquema que la app espera.
- `drizzle/0001_esquema_zero_delivery_es.sql` es la traducción completa (tablas, columnas, valores y claves).
- **No se modificó la app** para consumir el esquema español.
- Si se usa `0001`, hay que alinear `schema.ts`, permisos, estados, login, seed y settings.

---

## 18. Decisiones pendientes

| ID | Tema | Impacto |
|---|---|---|
| DECISION-01 | Fórmula definitiva del margen | Precios, reportes financieros |
| DECISION-02 | Garantía mínima, edad mínima, confianza y puntaje | Elegibilidad para efectivo |
| DECISION-03 | Fórmula de pago al rider y conciliación de efectivo | Liquidaciones |
| DECISION-04 | Ventas para Encargado y embudo para Coordinador | Reportes y ajustes |
| DECISION-05 | Tiempos de aceptación y umbrales de alerta | Alertas y operación |
| DECISION-06 | Catálogo final de estados y transiciones | Máquina de estados |
| DECISION-07 | Acción tras 15 min de espera y cierre definitivo | Logística |
| DECISION-08 | Definición o retiro de RF-22 | Alcance |
| DECISION-09 | Documentación real de Vocero y WhatsApp | Integraciones |

Mientras no se aprueben, los valores marcados como **provisionales** no deben usarse como verdad financiera ni contractual.

---

## Referencias

- `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md` — especificación funcional completa.
- `docs/engineering/INDEX.md` — índice de ingeniería.
- `docs/engineering/06-diagramas-estado.md` — diagramas de estado.
- `docs/engineering/07-requerimientos.md` — requerimientos.
- `docs/engineering/08-matriz-trazabilidad.md` — trazabilidad.
- `drizzle/0000_initial_zero_delivery.sql` — esquema original.
- `drizzle/0001_esquema_zero_delivery_es.sql` — esquema en español.
- `CLAUDE.md` — reglas inviolables del proyecto.
