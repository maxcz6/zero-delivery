# Zero Delivery — Común a todos los roles

> Login único, sesión, navegación, mapa de rutas, pantallas compartidas, pantallas públicas, patrones de interfaz, matriz pantalla × permiso y brechas.
>
> Aplica a los cinco roles: Administrador, Coordinador, Encargado, Empleado y Repartidor.
> Fecha: 2026-10-26

---

## Índice

1. [Login único](#1-login-único)
2. [Sesión y guardas de ruta](#2-sesión-y-guardas-de-ruta)
3. [Navegación y menú por rol](#3-navegación-y-menú-por-rol)
4. [Mapa global de rutas](#4-mapa-global-de-rutas)
5. [Detalle de pedido: pantalla compartida](#5-detalle-de-pedido-pantalla-compartida)
6. [Patrones comunes de interfaz](#6-patrones-comunes-de-interfaz)
7. [Pantallas públicas del cliente](#7-pantallas-públicas-del-cliente)
8. [Elementos transversales](#8-elementos-transversales)
9. [Matriz pantalla × permiso](#9-matriz-pantalla--permiso)
10. [Brechas y orden de implementación](#10-brechas-y-orden-de-implementación)

---

## 1. Login único

### 1.1 Una sola puerta de entrada

Todo el sistema entra por `/login`. No hay portales separados por rol. El servidor decide a dónde ir.

```
┌──────────────┐    POST /api/v1/auth/login     ┌──────────────────┐
│  /login      │ ─────────────────────────────► │  Servidor        │
│  usuario     │  { tenantSlug, username,       │  scrypt + sesión │
│  contraseña  │    password }                  │  + RBAC          │
└──────────────┘ ◄───────────────────────────── └──────────────────┘
        │            { user, redirectUrl }              │
        │            cookie zd_session                  │
        ▼                                               ▼
  router.push(redirectUrl)                    matriz de redirección
```

### 1.2 Qué pide el formulario

| Campo | Estado | Regla |
|---|:-:|---|
| Organización (`tenantSlug`) | 🟡 | Hoy la página envía fijo `"zero-delivery"`. No se muestra al usuario. En multi-inquilino debe ser un campo o un subdominio. |
| Usuario | ✅ | Texto libre. Se busca por `(inquilino, username)` exacto, con `.trim()`. |
| Contraseña | ✅ | Mínimo 8 en la entrada; el alta exige 10 y usa scrypt. |

La página incluye **accesos rápidos de demostración** para los 5 usuarios seed (`admin`, `coord.lima`, `encargado.miraflores`, `soporte.1`, `rider.carlos`) con contraseña `ZeroDelivery2026!`. **Debe desaparecer o quedar detrás de un flag en producción.**

### 1.3 Matriz de redirección (implementada)

| Rol | Código | Destino inicial |
|---|---|---|
| Administrador | `ADMIN` | `/dashboard` |
| Coordinador | `COORDINATOR` | `/dashboard?view=kanban` |
| Encargado | `BRANCH_MANAGER` | `/dashboard?view=branch` |
| Empleado | `SUPPORT_AGENT` | `/dashboard?view=support` |
| Repartidor | `RIDER` | `/deliveries` |
| Desconocido (fallback) | — | `/dashboard` |

🟡 **Brecha:** el dashboard hoy **ignora** `?view=`. Las cinco rutas renderizan la misma página estática de tarjetas. El parámetro existe y se usa en la redirección, pero no cambia la vista.

### 1.4 Credenciales y errores

| Situación | HTTP | Código | Mensaje |
|---|---:|:-:|---|
| Credenciales incorrectas | 401 | `INVALID_CREDENTIALS` | “Credenciales incorrectas.” |
| Usuario inactivo | 403 | `USER_INACTIVE` | “La cuenta de usuario está desactivada…” |
| 5 fallos consecutivos | 423 | `ACCOUNT_LOCKED` | “Cuenta temporalmente bloqueada por 15 minutos.” |
| JSON o formato inválido | 422 | `VALIDATION_ERROR` | Detalle por campo |
| Error interno | 500 | `INTERNAL_ERROR` | Genérico + `requestId` |

El mensaje de credenciales es siempre genérico: no revela si el usuario existe.

---

## 2. Sesión y guardas de ruta

### 2.1 Sesión

| Aspecto | Implementación |
|---|---|
| Cookie | `zd_session`, `httpOnly`, `sameSite=lax`, `secure` en producción, `path=/`, 7 días |
| Almacenamiento | Solo el **SHA-256** del token en `sessions`; el token crudo nunca se guarda |
| Cierre | `POST /api/v1/auth/logout` revoca la sesión y borra la cookie |
| Bloqueo | 5 fallos → 15 minutos (`423 ACCOUNT_LOCKED`) |
| Inactividad | La sesión dura 7 días; no hay renovación deslizante en el MVP |

### 2.2 Guardas requeridas

🟡 **Brecha crítica:** hoy **no existe `middleware.ts`** y los layouts `(staff)` y `(rider)` **no verifican sesión**. Cualquiera puede abrir `/dashboard` o `/deliveries` escribiendo la URL. La autorización real existe en el dominio (`can()`), pero no está conectada a las páginas.

Diseño requerido:

1. **Middleware** en `/dashboard/**`, `/deliveries/**`, `/wallet/**`, `/metrics/**` que valide la cookie y redirija a `/login?next=...` sin sesión.
2. **Layout de staff** que cargue el actor (usuario, rol, sucursales) desde la sesión y lo pase al menú.
3. **Layout de rider** que exija rol `RIDER`; un staff que entre a `/deliveries` vuelve a `/dashboard`.
4. **Cada acción de servidor** vuelve a llamar `can(actor, permiso, recurso, settings)`. La UI nunca autoriza.
5. **Si el rol no tiene ningún permiso de la pantalla**, responder `403` con página “Sin acceso”, no ocultar silenciosamente.

### 2.3 Regla de oro de la interfaz

- **Ocultar** lo que el rol nunca podrá hacer (ej.: Auditoría para un Encargado).
- **Mostrar deshabilitado con explicación** lo que depende de un ajuste o del estado del pedido (ej.: “Asignar repartidor” bloqueado porque el pago al local no está confirmado). El usuario necesita saber *por qué* no puede.
- **Nunca** confiar en el ocultamiento: el botón oculto debe tener su equivalente `403` en el servidor.

---

## 3. Navegación y menú por rol

### 3.1 Menú lateral del staff

| Opción | Ruta | ADMIN | COORD | ENCARGADO | EMPLEADO |
|---|---|:-:|:-:|:-:|:-:|
| Panel | `/dashboard` | ✔ | ✔ | ✔ | ✔ |
| Pedidos | `/dashboard/orders` | ✔ | ✔ | ✔ propio | ✔ |
| Nuevo pedido | `/dashboard/orders/new` | ✔ | ✔ | — | ✔ |
| Despacho (Kanban) | `/dashboard/kanban` | ✔ | ✔ | — | — |
| Pagos | `/dashboard/payments` | ✔ | ✔ | — | ✔ |
| Pagos a restaurantes | `/dashboard/payouts` | ✔ | ✔ | — | ✔ |
| Repartidores | `/dashboard/riders` | ✔ | ✔ | — | — |
| Billeteras y garantías | `/dashboard/wallets` | ✔ | ✔ | — | ✔ lectura |
| Adelantos | `/dashboard/advances` | ✔ | ✔ | — | ✔ (p) |
| Liquidaciones | `/dashboard/settlements` | ✔ | ✔ | — | — |
| Devoluciones | `/dashboard/returns` | ✔ | ✔ | ✔ confirmar | — |
| Incidencias | `/dashboard/incidents` | ✔ | ✔ | — | — |
| Clientes | `/dashboard/customers` | ✔ | ✔ | — | ✔ |
| Catálogo | `/dashboard/catalog` | ✔ | ✔ | ✔ propio | — |
| Horarios de sucursal | `/dashboard/catalog/schedules` | ✔ | ✔ | ✔ propio | — |
| Reportes | `/dashboard/reports` | ✔ global | ✔ | ✔ operativo | — |
| Alertas | `/dashboard/alerts` | ✔ | ✔ | ✔ propio | ✔ |
| Integraciones | `/dashboard/integrations` | ✔ | — | — | — |
| Usuarios y roles | `/dashboard/users` | ✔ | — | — | — |
| Configuración | `/dashboard/settings` | ✔ | — | — | — |
| Auditoría | `/dashboard/audit` | ✔ | — | — | — |

Leyenda: ✔ = visible · — = no visible · (p) = depende de ajuste · “propio” = solo sus sucursales.

### 3.2 Menú del repartidor (PWA móvil, tema oscuro)

| Opción | Ruta | Descripción |
|---|---|---|
| Entregas | `/deliveries` | Pedidos asignados y activos |
| Detalle de entrega | `/deliveries/[id]` | Dirección, ítems, cobro, acciones |
| Mi billetera | `/wallet` | Garantía, deuda, movimientos, adelantos |
| Mis métricas | `/metrics` | Entregas, puntualidad, ingresos estimados |
| Mi perfil | `/profile` | Datos, vehículo, estado, ubicación |

### 3.3 Cabecera común del staff

- Nombre del inquilino y de la sucursal activa.
- Selector de sucursal (solo si el usuario tiene más de una; el Encargado siempre ve su lista).
- Campana de alertas con contador por severidad.
- Indicador de salud de integraciones (solo Admin y Coordinador).
- Menú de usuario: perfil, cambiar contraseña, cerrar sesión.
- **Banner de modo demostración** si se usan datos seed.

---

## 4. Mapa global de rutas

| Ruta | Tipo | Estado | Roles |
|---|---|:-:|---|
| `/` | Landing | ✅ | Público |
| `/login` | Autenticación | ✅ | Público |
| `/m/[branchSlug]` | Carta pública | 🟡 | Cliente |
| `/p/[publicToken]` | Seguimiento público | 🟡 | Cliente |
| `/dashboard` | Panel | 🟡 | Staff |
| `/dashboard?view=kanban` | Despacho | ⬜ | Admin, Coordinador |
| `/dashboard?view=branch` | Mi sucursal | ⬜ | Encargado |
| `/dashboard?view=support` | Atención | ⬜ | Empleado |
| `/dashboard/orders` | Pedidos | ⬜ | Admin, Coord, Encargado, Empleado |
| `/dashboard/orders/new` | Crear pedido | ⬜ | Admin, Coord, Empleado |
| `/dashboard/orders/[id]` | Detalle | ⬜ | Según alcance |
| `/dashboard/kanban` | Tablero | ⬜ | Admin, Coord |
| `/dashboard/payments` | Validación de pagos | ⬜ | Admin, Coord, Empleado |
| `/dashboard/payouts` | Pago a restaurantes | ⬜ | Admin, Coord, Empleado |
| `/dashboard/riders` | Repartidores | ⬜ | Admin, Coord |
| `/dashboard/riders/[id]` | Ficha del rider | ⬜ | Admin, Coord |
| `/dashboard/wallets` | Billeteras | ⬜ | Admin, Coord, Empleado (lectura) |
| `/dashboard/advances` | Adelantos | ⬜ | Admin, Coord, Empleado (p) |
| `/dashboard/settlements` | Liquidaciones | ⬜ | Admin, Coord |
| `/dashboard/returns` | Devoluciones | ⬜ | Admin, Coord, Encargado |
| `/dashboard/incidents` | Incidencias | ⬜ | Admin, Coord |
| `/dashboard/customers` | Clientes | ⬜ | Admin, Coord, Empleado |
| `/dashboard/customers/[id]` | Ficha del cliente | ⬜ | Admin, Coord, Empleado |
| `/dashboard/catalog` | Catálogo | ⬜ | Admin, Coord, Encargado |
| `/dashboard/catalog/schedules` | Horarios | ⬜ | Admin, Coord, Encargado |
| `/dashboard/reports` | Reportes | ⬜ | Admin, Coord, Encargado |
| `/dashboard/alerts` | Alertas | ⬜ | Admin, Coord, Encargado, Empleado |
| `/dashboard/integrations` | Integraciones | ⬜ | Admin |
| `/dashboard/users` | Usuarios | ⬜ | Admin |
| `/dashboard/settings` | Configuración | ⬜ | Admin |
| `/dashboard/audit` | Auditoría | ⬜ | Admin |
| `/deliveries` | Entregas rider | 🟡 | Rider |
| `/deliveries/[id]` | Detalle rider | ⬜ | Rider |
| `/wallet` | Billetera rider | ⬜ | Rider |
| `/metrics` | Métricas rider | ⬜ | Rider |
| `/profile` | Perfil rider | ⬜ | Rider |

---

## 5. Detalle de pedido: pantalla compartida

Es la pantalla más importante y la que más cambia según el rol. Cada rol tiene su archivo con su variante; esta es la matriz única de referencia.

| Sección / acción | ADMIN | COORD | ENCARGADO | EMPLEADO | RIDER |
|---|:-:|:-:|:-:|:-:|:-:|
| Cabecera (N°, estado, tiempos) | ✔ | ✔ | ✔ | ✔ | ✔ |
| Cliente y teléfono | ✔ | ✔ | ✔ | ✔ | ✔ activo |
| Dirección | ✔ | ✔ | ✔ | ✔ | ✔ activo |
| Ítems | ✔ | ✔ | ✔ | ✔ | ✔ |
| Base + empaque | ✔ | ✔ | ✔ | ✔ | — |
| Margen | ✔ | ✔ | — | ✔ | — |
| Total | ✔ | ✔ | ✔ | ✔ | ✔ |
| Cobro en efectivo | ✔ | ✔ | ✔ | ✔ | ✔ |
| Pago del cliente | ✔ | ✔ | ver estado | ✔ | ver estado |
| Validar pago | ✔ | ✔ | — | ✔ | — |
| Corregir pago | ✔ | ✔ | — | — | — |
| Reembolsar | ✔ | ✔ | — | — | — |
| Payout al restaurante | ✔ | ✔ | ver estado | ✔ confirmar | — |
| Handoff | ✔ | — | ✔ | — | — |
| Asignar rider | ✔ | ✔ | — | ✔ (p) | — |
| Aceptar / rechazar | ✔ | ✔ | ✔ | — | — |
| Preparar / listo | ✔ | — | ✔ | — | — |
| Transiciones de entrega | ✔ override | — | — | — | ✔ propias |
| Cancelar (solicitar) | ✔ | ✔ | — | ✔ | — |
| Cancelar (autorizar) | ✔ | ✔ | — | — | — |
| Cambio de dirección | ✔ | ✔ | — | ✔ | — |
| Notas | ✔ | ✔ | ✔ | ✔ | ✔ incidencia |
| Devolución: recepción física | ✔ | ✔ | ✔ | — | — |
| Devolución: resolver | ✔ | ✔ | — | — | — |
| Incidencia económica | ✔ | ✔ | — | — | — |
| GPS del rider | ✔ | ✔ | — | ✔ lectura | ✔ propio |
| Historial de estados | ✔ | ✔ | ✔ | ✔ | ✔ |
| Auditoría del pedido | ✔ | — | — | — | — |
| Override de estado | ✔ | — | — | — | — |

**Reglas de la pantalla:**

- Toda acción sensible exige confirmación con resumen del efecto.
- Todo motivo tiene mínimo 3 caracteres y contador visible.
- Si otro usuario cambió el pedido, se avisa y no se pierde lo escrito (bloqueo optimista).
- Doble clic no duplica transiciones ni asientos (idempotencia).
- “Actualizado por X a las HH:MM” siempre visible.

---

## 6. Patrones comunes de interfaz

| Patrón | Regla |
|---|---|
| Confirmación destructiva | Cancelar, autorizar, ajustar y liquidar piden confirmación con el resumen del efecto. |
| Motivo obligatorio | Mínimo 3 caracteres; el botón no se habilita hasta cumplirlo. Se guarda con actor y fecha. |
| Bloqueo optimista | Si la versión del pedido cambió, se muestra “El pedido cambió. Recargue para ver el estado actual”. |
| Idempotencia | Doble clic no duplica pedidos, transiciones ni asientos. |
| Trazabilidad | Cada cambio muestra quién y cuándo. |
| Errores | Mensaje humano + código + `requestId` para soporte. |
| Estados vacíos | Explicación y acción siguiente, nunca una tabla vacía sin contexto. |
| Carga | Skeletons; nunca pantalla en blanco. |
| Permisos | Ocultar lo imposible, deshabilitar con motivo lo condicionado, `403` en servidor siempre. |
| Exportación | CSV UTF-8 con BOM, mismos filtros y alcance que la pantalla. |
| Impresión | Comanda de cocina y comprobante interno imprimibles. |

---

## 7. Pantallas públicas del cliente

Sin login. No exponen datos internos.

### 7.1 Carta digital — `/m/[branchSlug]` 🟡

- Sucursal, nombre, horario, estado abierto/cerrado.
- Categorías, productos, precio final, disponibilidad.
- Carrito y checkout como invitado (nombre, teléfono, dirección, método de pago).
- **Nunca** muestra base, empaque, margen ni payout.
- Si la sucursal está cerrada, se bloquea el pedido con mensaje claro.
- Captura de embudo: impresión, vista de menú, agregar al carrito, compra.

### 7.2 Seguimiento — `/p/[publicToken]` 🟡

- Estado legible, línea de tiempo, ETA estimado si existe.
- Enlace a Google Maps de la dirección, **nunca** ubicación del rider.
- Datos del pedido: número, ítems, total.
- Sin teléfono del rider ni datos internos.

### 7.3 Reglas de privacidad pública

- Token opaco, no adivinable.
- Rate limiting en rutas públicas.
- No indexar (`noindex`).
- El token no da acceso a otros pedidos.

---

## 8. Elementos transversales

| Elemento | Regla |
|---|---|
| Idioma | Español (Perú). Todo texto pasa por `src/shared/i18n/es-PE.ts`. |
| Moneda | Soles, formato `S/ 12.50`; internamente céntimos enteros. |
| Zona horaria | America/Lima para fechas operativas y cortes. |
| Fechas | “Hoy”, “Ayer”, luego `dd/mm/aaaa HH:MM`. |
| Accesibilidad | Foco visible, contraste AA, botones de 44 px en móvil, etiquetas ARIA, navegación por teclado. |
| Offline | Solo el rider tiene banner explícito; las acciones requieren conexión. |
| Alertas | Campana con contador por severidad; enlace directo al recurso. |
| Auditoría | Toda acción sensible muestra “quedó registrado” sin exponer el log al rol. |
| Modo demo | Banner visible cuando se usan datos seed. |

---

## 9. Matriz pantalla × permiso

| Pantalla | Permiso principal | Alternativos / condiciones |
|---|---|---|
| Panel general | — | Cualquier rol autenticado ve su propio panel |
| Pedidos | `order.view` | Alcance por sucursal o asignación |
| Nuevo pedido | `order.create_manual` | — |
| Detalle de pedido | `order.view` | Acciones según la matriz de la sección 5 |
| Kanban | `order.view` + acciones | `order.assign_rider`, `order.accept_reject` |
| Pagos | `payment.validate`, `payout.restaurant.confirm`, `payment.correct`, `refund.manage` | — |
| Repartidores | `rider.manage` | — |
| Billeteras | `wallet.view_any` o `wallet.view_own` | `wallet.adjust` para escribir |
| Adelantos | `advance.create` | `support.can_create_advance` |
| Liquidaciones | `settlement.confirm` | — |
| Devoluciones | `return.confirm_physical`, `return.resolve` | — |
| Incidencias | `incident.loss.decide` | — |
| Clientes | `customer.history.view` | `customer.risk_flag.set` para riesgo |
| Catálogo | `product.create`, `product.availability.edit`, `product.price.edit` | `restaurant.manage`, `branch.toggle` |
| Horarios | `branch.schedule.edit` | Alcance de sucursal |
| Reportes | `report.*` | Ajustes `reports.*` |
| Alertas | — | Filtradas por alcance |
| Integraciones | `settings.global.manage` | Solo Admin |
| Usuarios | `user.manage` | Solo Admin |
| Configuración | `settings.global.manage` | Solo Admin |
| Auditoría | `audit.view` | Solo Admin |
| Entregas rider | `order.view` + `delivery.update_own` | Solo asignados |
| Billetera rider | `wallet.view_own` | Solo propia |
| Métricas rider | `report.operational` | Solo propias |

---

## 10. Brechas y orden de implementación

### 10.1 Lo que hoy existe

- Login único funcional con redirección por rol.
- Sesión con cookie, bloqueo y logout.
- Dashboard de staff y pantalla de rider **informativas**.
- Landing, carta pública y seguimiento público **vacíos**.
- Dominio completo de RBAC, transiciones, liberación, elegibilidad, billetera, pagos y precios, con pruebas.
- Webhook y adaptador de Vocero, con contrato y firma.

### 10.2 Lo que falta para que esta documentación sea real

| Prioridad | Trabajo |
|:-:|---|
| 1 | Middleware y guardas de sesión; cargar el actor en los layouts |
| 2 | Respetar `?view=` y construir los 4 paneles por rol |
| 3 | API de pedidos: listar, detalle, crear, transiciones |
| 4 | Kanban con acciones por rol y bloqueo optimista |
| 5 | Pagos: validar, payout, corregir, reembolsar |
| 6 | Asignación de rider con elegibilidad visible |
| 7 | Handoff y regla de liberación en UI |
| 8 | Billetera, adelantos y liquidaciones |
| 9 | Catálogo, horarios, zonas |
| 10 | Clientes, riesgo e historial |
| 11 | Reportes y exportación CSV |
| 12 | Alertas y jobs |
| 13 | PWA del rider funcional y offline |
| 14 | Integración Vocero: persistencia, worker, columna de conversación, UI |

### 10.3 Advertencia final

- Las pantallas descritas son **diseño**, no implementación.
- El esquema español `0001_esquema_zero_delivery_es.sql` **no es compatible** con el código actual sin alinear `schema.ts`, roles, estados y claves de configuración.
- No encender `feature.integration.vocero` hasta completar el checklist de [`06-VOCERO_CRM.md`](./06-VOCERO_CRM.md#16-checklist-de-puesta-en-marcha).
- Ninguna automatización debe decidir dinero: pagos, correcciones, reembolsos y liquidaciones son siempre humanos.
