# 11 — Mapa de Errores y Estrategias de Recuperación

> **Estado:** `[DESIGNED]` · **Versión:** 1.0-mvp · **Fuente:** `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md` §11, §15 + contratos de `vocero-crm`

---

## Catálogo Estandarizado de Errores (`AppError`)

Todas las respuestas de error de la API `/api/v1/*` devuelven la estructura uniforme `{ error: { code, message, details?, requestId } }` sin exponer *stack traces* ni datos sensibles en producción.

| Código de Error (`code`) | HTTP | Origen | Mensaje al Usuario (`es-PE`) | Log Técnico (`pino`, sin PII) | Estrategia de Recuperación | Caso de Uso | Severidad |
|---|---|---|---|---|---|---|---|
| `UNAUTHENTICATED` | `401` | `identity` | "Tu sesión ha expirado o no has iniciado sesión." | `Session token missing, expired or revoked` | Redirigir a `/login` conservando ruta destino. | CU-001 | Baja |
| `INVALID_CREDENTIALS` | `401` | `identity` | "Usuario o contraseña incorrectos." | `Login failed for username hash` | Incrementar `failed_login_count`; mostrar error en formulario. | CU-001 | Media |
| `ACCOUNT_LOCKED` | `429` | `identity` | "Cuenta bloqueada temporalmente por múltiples intentos fallidos." | `User locked until timestamp` | Esperar expiración de `locked_until` o desbloqueo por `ADMIN`. | CU-001 | Alta |
| `FORBIDDEN` | `403` | `identity/can` | "No tienes permisos para realizar esta acción." | `RBAC denied: role X action Y resource Z` | Auditar intento si es crítico; ocultar/deshabilitar acción en UI. | Todos | Alta |
| `VALIDATION_ERROR` | `422` | `shared/zod` | "Revisa los campos del formulario." | `Zod validation failed on fields [...]` | Resaltar campos inválidos en el formulario (`react-hook-form`). | Todos | Baja |
| `NOT_FOUND` | `404` | `shared` | "El recurso solicitado no existe o no pertenece a tu alcance." | `Entity not found in tenant scope` | Volver al listado o refrescar tablero. | Todos | Baja |
| `BRANCH_CLOSED` | `409` | `tenancy` | "La sucursal seleccionada se encuentra cerrada en este momento." | `Order creation rejected: branch closed` | Mostrar horarios de la sucursal o consultar al Coordinador. | CU-004 | Media |
| `MIN_ORDER_NOT_MET` | `422` | `orders` | "El subtotal no alcanza el pedido mínimo de la zona seleccionada." | `Subtotal cents below zone min_order_cents` | Informar monto faltante al operador/cliente. | CU-004 | Baja |
| `CUSTOMER_BLOCKED` | `403` | `customers` | "El cliente registra una restricción de seguridad activa (`BLOCKED`)." | `Customer risk_flag=BLOCKED prevented order` | Requiere revisión manual y autorización de `COORDINATOR` / `ADMIN`. | CU-004 | Alta |
| `PRODUCT_HAS_HISTORY_ARCHIVED` | `200` / `409` | `catalog` | "El producto tiene pedidos históricos; fue archivado en lugar de eliminado." | `Product soft-archived instead of deleted` | Marcar `archived_at = now()` e `is_active = false`. | CU-003 | Baja |
| `INVALID_STATE_TRANSITION` | `409` | `orders` | "El pedido no puede pasar al estado solicitado desde su estado actual." | `Transition from X to Y not in ORDER_TRANSITIONS` | Refrescar estado del pedido (`useLiveOrders`). | CU-005..11 | Media |
| `VERSION_CONFLICT` | `409` | `orders` | "Otro usuario actualizó este pedido hace unos instantes. Se recargará la vista." | `Optimistic lock mismatch: expected V1 got V2` | Invalidar query en TanStack Query y mostrar datos actualizados. | CU-005..11 | Media |
| `RESTAURANT_PAYOUT_NOT_CONFIRMED` | `409` | `orders/payments` | "No puedes registrar la entrega física al repartidor hasta que se confirme el pago al restaurante." | `Handoff blocked: restaurant_payout_status != CONFIRMED` | Solicitar al Coordinador/Soporte confirmar el abono al local. | CU-009 | Crítica |
| `RELEASE_GATE_FAILED` | `409` | `orders` | "El pedido aún no cumple los requisitos de liberación para salir a ruta." | `evaluateReleaseGate failed with reasons [...]` | Mostrar lista exacta de requisitos pendientes (pago cliente, pago local, handoff, rider). | CU-009 | Crítica |
| `RIDER_NOT_ELIGIBLE` | `409` | `logistics` | "El repartidor no cumple los requisitos para este pedido (vehículo o garantía en efectivo)." | `canAssignRider returned false: reasons [...]` | Seleccionar otro repartidor, abonar garantía o asignar pedido ya pagado. | CU-008 | Alta |
| `MAX_DELIVERY_ATTEMPTS_REACHED` | `409` | `logistics` | "Este pedido ya alcanzó el máximo de 2 intentos de entrega permitidos." | `Attempt > delivery.max_attempts (2)` | Pasar a `PENDING_RESOLUTION` para decisión del Coordinador. | CU-011 | Alta |
| `IMMUTABLE_LEDGER_VIOLATION` | `500` | `db` | "Operación no permitida: los registros contables y de auditoría son inmutables." | `Postgres trigger forbid_mutation raised restrict_violation` | Usar asientos compensatorios (`ADJUSTMENT` o `payment_events` `CORRECTED`). | CU-007, CU-012 | Crítica |
| `VOCERO_CRM_ERROR` | `502` / Async | `integrations` | "Notificación en cola; se reintentará automáticamente." | `VoceroCrmAdapter HTTP error / timeout on outbox event` | El worker incrementa `attempts`, aplica backoff exponencial y alerta si pasa a `DEAD`. | CU-015 | Media |
| `INTERNAL_ERROR` | `500` | `shared` | "Ocurrió un error interno. Comparte el código de referencia con soporte." | `Unhandled error [requestId]` | Mostrar `requestId` al usuario y registrar error estructurado en `pino`. | Todos | Crítica |
