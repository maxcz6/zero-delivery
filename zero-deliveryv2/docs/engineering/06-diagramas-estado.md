# 06 — Diagramas de Estado y Ciclo de Vida de Entidades

> **Estado:** `[DESIGNED]` · **Versión:** 1.0-mvp · **Fuente:** `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md` §8

---

## 1. Estado Operativo del Pedido (`orders.operational_status`)

Los pedidos se rigen por dos ejes principales independientes (`operational_status` y `payment_status`) más el estado de liquidación al restaurante (`restaurant_payout_status`) y el sello de entrega física (`handoff_at`).

```mermaid
stateDiagram-v2
    [*] --> NEW : Creación (Manual / Web / Vocero)

    NEW --> CONFIRMED : Aceptar (BRANCH_MANAGER, COORDINATOR, ADMIN)
    NEW --> REJECTED : Rechazar con motivo (BRANCH_MANAGER, COORDINATOR, ADMIN)

    CONFIRMED --> PREPARING : Iniciar preparación (BRANCH_MANAGER, ADMIN)
    PREPARING --> READY : Marcar listo (BRANCH_MANAGER, ADMIN)

    READY --> RIDER_ASSIGNED : Asignar repartidor elegible (COORDINATOR, SUPPORT_AGENT, ADMIN)
    RIDER_ASSIGNED --> RIDER_AT_PICKUP : Llegada al local (RIDER)
    RIDER_AT_PICKUP --> ON_THE_WAY : Iniciar ruta [evaluateReleaseGate OK + handoff_at != null] (RIDER)

    ON_THE_WAY --> DELIVERED : Entregar [+ asiento CASH_COLLECTED si efectivo] (RIDER)
    ON_THE_WAY --> DELIVERY_FAILED : Fallo de entrega con motivo [crea delivery_attempt] (RIDER)

    DELIVERY_FAILED --> RIDER_ASSIGNED : Autorizar 2.º intento [attempt_no < 2] (COORDINATOR, ADMIN)
    DELIVERY_FAILED --> RETURN_PENDING : Iniciar devolución (RIDER, COORDINATOR)
    DELIVERY_FAILED --> PENDING_RESOLUTION : Automático cuando attempt_no == 2 (SISTEMA)

    RETURN_PENDING --> RETURNED_TO_RESTAURANT : Confirmar recepción física (BRANCH_MANAGER, COORDINATOR, ADMIN)
    RETURNED_TO_RESTAURANT --> PENDING_RESOLUTION : Pasar a resolución (COORDINATOR, ADMIN)

    PENDING_RESOLUTION --> CANCELLED : Cerrar con resolución obligatoria (COORDINATOR, ADMIN)
    PENDING_RESOLUTION --> RIDER_ASSIGNED : Reintento excepcional [solo si attempt_no < 2] (COORDINATOR, ADMIN)

    NEW --> CANCELLATION_REQUESTED : Solicitar cancelación (SUPPORT_AGENT, COORDINATOR, ADMIN)
    CONFIRMED --> CANCELLATION_REQUESTED : Solicitar cancelación
    PREPARING --> CANCELLATION_REQUESTED : Solicitar cancelación
    READY --> CANCELLATION_REQUESTED : Solicitar cancelación
    RIDER_ASSIGNED --> CANCELLATION_REQUESTED : Solicitar cancelación
    RIDER_AT_PICKUP --> CANCELLATION_REQUESTED : Solicitar cancelación

    CANCELLATION_REQUESTED --> CANCELLED : Autorizar cancelación (COORDINATOR, ADMIN)
    CANCELLATION_REQUESTED --> CONFIRMED : Denegar cancelación [restaura prev_status] (COORDINATOR, ADMIN)

    REJECTED --> [*]
    DELIVERED --> [*]
    CANCELLED --> [*]
```

| Estado | Etiqueta UI (`es-PE`) | Descripción | Terminal |
|---|---|---|---|
| `NEW` | Nuevo | Pedido registrado; genera alerta sonora en sucursal y corre temporizador de aceptación. | No |
| `CONFIRMED` | Confirmado | Aceptado por sucursal o coordinador. | No |
| `PREPARING` | En preparación | Cocina preparando el pedido (permitido aunque el pago anticipado siga `PENDING`). | No |
| `READY` | Listo | Empaquetado y listo para ser asignado y retirado. | No |
| `RIDER_ASSIGNED` | Repartidor asignado | Motorizado/conductor elegible asignado. | No |
| `RIDER_AT_PICKUP` | Rider cerca del punto de retiro | Repartidor en el local; corre temporizador de espera de 15 min (`rider.pickup_wait_minutes`). | No |
| `ON_THE_WAY` | En camino | Despachado tras superar `evaluateReleaseGate` (pago validado + pago a restaurante confirmado + `handoff_at`). | No |
| `DELIVERED` | Entregado | Entregado al cliente final; cobro en efectivo asentado en `wallet_entries`. | **Sí** |
| `REJECTED` | Rechazado | Rechazado antes de preparación con motivo obligatorio. | **Sí** |
| `CANCELLATION_REQUESTED` | Cancelación solicitada | Petición de anulación pendiente de autorización por Coordinador/Admin. | No |
| `CANCELLED` | Cancelado | Anulado definitivamente con motivo/resolución auditada. | **Sí** |
| `DELIVERY_FAILED` | Entrega fallida | Cliente no recibió el pedido en el intento actual (`attempt_no` 1 o 2). | No |
| `RETURN_PENDING` | Devolución pendiente | Repartidor en retorno hacia la sucursal con el producto físico. | No |
| `RETURNED_TO_RESTAURANT` | Devuelto al restaurante | Recepción física confirmada por el Encargado. | No |
| `PENDING_RESOLUTION` | Pendiente de resolución | Requiere decisión del Coordinador tras 2 intentos fallidos o devolución física. | No |

---

## 2. Estado de Pago del Cliente (`payments.status` / `orders.payment_status`)

```mermaid
stateDiagram-v2
    [*] --> PENDING : Creación del pedido (CASH / YAPE / BANK_TRANSFER)
    PENDING --> PAID : Validación humana (YAPE/TRANSFER) o Entrega en efectivo (CASH)
    PENDING --> REJECTED : Comprobante inválido / rechazado (COORDINATOR, SUPPORT_AGENT, ADMIN)
    REJECTED --> PENDING : Nuevo comprobante subido / corrección auditada
    PAID --> REFUNDED : Reembolso manual registrado y confirmado (COORDINATOR, ADMIN)
    PAID --> PENDING : Corrección administrativa con motivo obligatorio [payment_events.type = CORRECTED]
    REFUNDED --> [*]
```

---

## 3. Estado de Pago al Restaurante (`restaurant_payouts.status`)

```mermaid
stateDiagram-v2
    [*] --> PENDING : Pedido creado
    PENDING --> CONFIRMED : Abono confirmado por COORDINATOR / SUPPORT_AGENT / ADMIN [Habilita handoff físico]
    CONFIRMED --> [*]
```

---

## 4. Estado Operativo del Repartidor (`riders.status`)

```mermaid
stateDiagram-v2
    [*] --> OFFLINE : Alta de repartidor / Fin de turno
    OFFLINE --> AVAILABLE : Iniciar turno
    AVAILABLE --> BUSY : Asignado a pedido (RIDER_ASSIGNED / RIDER_AT_PICKUP)
    BUSY --> ON_THE_WAY : Sale a ruta (ON_THE_WAY)
    ON_THE_WAY --> AVAILABLE : Completa entrega (DELIVERED) o devolución sin otros pedidos activos
    AVAILABLE --> OFFLINE : Cerrar turno
```

---

## 5. Ciclo de Vida de Liquidación Diaria (`settlements.status`) y Adelantos (`rider_advances.status`)

```mermaid
stateDiagram-v2
    state "Liquidación Diaria (settlements)" as S {
        [*] --> DRAFT : Job 23:00 America/Lima o generación manual
        DRAFT --> CONFIRMED : Coordinador registra cash_received_cents y confirma [+ asiento CASH_SETTLED]
        CONFIRMED --> [*]
    }

    state "Adelanto Operativo (rider_advances)" as A {
        [*] --> PENDING_DEDUCTION : Autorizado por Coordinador/Admin
        PENDING_DEDUCTION --> DEDUCTED : Descontado al confirmar liquidación diaria (deducted_in_settlement_id)
        DEDUCTED --> [*]
    }
```

---

## 6. Ciclo de Vida de Eventos de Integración (`outbox_events` e `inbound_events`)

```mermaid
stateDiagram-v2
    state "Outbox Saliente (outbox_events)" as Outbox {
        [*] --> PENDING : Insertado en la misma transacción del dominio
        PENDING --> PROCESSING : Worker toma lease
        PROCESSING --> SENT : Adaptador (InApp / Vocero CRM) responde 2xx
        PROCESSING --> FAILED : Error de red / 429 / 5xx [incrementa attempts + backoff]
        FAILED --> PROCESSING : Reintento en next_attempt_at
        FAILED --> DEAD : Supera max_attempts [crea alerta de integración]
        SENT --> [*]
    }

    state "Webhook Entrante (inbound_events)" as Inbound {
        [*] --> RECEIVED : Firma HMAC válida + UNIQUE(provider, external_event_id)
        RECEIVED --> PROCESSED : Procesado con éxito
        RECEIVED --> IGNORED : Evento irrelevante o conversación de prueba (test=true)
        RECEIVED --> FAILED_IN : Error al procesar [permite reintento manual]
        PROCESSED --> [*]
        IGNORED --> [*]
    }
```
