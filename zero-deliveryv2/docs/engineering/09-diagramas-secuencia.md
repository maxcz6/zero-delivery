# 09 — Diagramas de Secuencia

> **Estado:** `[DESIGNED]` · **Versión:** 1.0-mvp · **Fuente:** `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md` + `02-casos-de-uso.md`

---

## 1. Registro Manual de Pedido con Idempotencia y Snapshot (CU-004)

```mermaid
sequenceDiagram
    actor Staff as Empleado / Coordinador
    participant UI as Panel Staff (Next.js)
    participant API as POST /api/v1/orders
    participant Svc as OrderApplicationService
    participant Pricing as ProvisionalPricingPolicy
    participant DB as PostgreSQL (ACID)
    participant Worker as Worker (pg-boss / Outbox)

    Staff->>UI: Completa formulario y pulsa "Crear Pedido" (botón se deshabilita)
    UI->>API: POST /api/v1/orders (Header: Idempotency-Key: uuid)
    API->>Svc: createManualOrder(actor, input)
    Svc->>Svc: can(actor, "order.create_manual")
    Svc->>DB: SELECT * FROM orders WHERE tenant_id = $1 AND idempotency_key = $2
    alt Pedido ya existe (Reintento de red)
        DB-->>Svc: Orden existente
        Svc-->>API: 200 OK (StaffOrderDTO existente)
        API-->>UI: Muestra pedido sin duplicar
    else Pedido nuevo
        Svc->>DB: Upsert customer por (tenant_id, phone_e164)
        alt customer.risk_flag == 'BLOCKED' y sin override
            Svc-->>API: 403 Forbidden (CUSTOMER_BLOCKED)
        else Cliente permitido
            Svc->>Pricing: Calcula snapshots (base + packaging + margin + modifiers)
            Pricing-->>Svc: PricedItems[] + itemsSubtotalCents
            Svc->>DB: BEGIN TRANSACTION
            Svc->>DB: INSERT orders (number via next_counter) + order_items
            Svc->>DB: INSERT payments (PENDING) + restaurant_payouts (PENDING)
            Svc->>DB: INSERT order_status_history (NULL -> NEW) + audit_logs
            Svc->>DB: INSERT alerts (NEW_ORDER) + outbox_events (ORDER_CREATED)
            Svc->>DB: COMMIT
            Svc-->>API: 201 Created (StaffOrderDTO)
            API-->>UI: Confirmación + actualiza Kanban
            Worker->>DB: Consume outbox_events (ORDER_CREATED)
        end
    end
```

---

## 2. Validación de Pago, Abono al Restaurante, Handoff y Regla de Liberación (CU-007, CU-008, CU-009)

```mermaid
sequenceDiagram
    actor Coord as Coordinador / Empleado
    actor Manager as Encargado (Sucursal)
    actor Rider as Repartidor (PWA)
    participant Svc as Orders & Payments Services
    participant Gate as evaluateReleaseGate()
    participant DB as PostgreSQL

    Note over Coord,DB: Pedido en estado READY con pago YAPE pendiente
    Coord->>Svc: validatePayment(actor, orderId)
    Svc->>DB: UPDATE payments SET status='PAID', validated_by=actor; INSERT payment_events
    Svc->>DB: UPDATE orders SET payment_status='PAID'

    Coord->>Svc: assignRider(actor, orderId, riderId)
    Svc->>Svc: canAssignRider(rider, order, guaranteeBalance)
    Svc->>DB: UPDATE orders SET operational_status='RIDER_ASSIGNED', rider_id=riderId

    Rider->>Svc: transition(RIDER_ASSIGNED -> RIDER_AT_PICKUP)
    Svc->>DB: UPDATE orders SET operational_status='RIDER_AT_PICKUP'

    alt Encargado intenta handoff ANTES de que el restaurante cobre
        Manager->>Svc: registerHandoff(actor, orderId)
        Svc-->>Manager: 409 Conflict (RESTAURANT_PAYOUT_NOT_CONFIRMED)
    end

    Coord->>Svc: confirmRestaurantPayout(actor, orderId, reference)
    Svc->>DB: UPDATE restaurant_payouts SET status='CONFIRMED'; UPDATE orders SET restaurant_payout_status='CONFIRMED'

    Manager->>Svc: registerHandoff(actor, orderId)
    Svc->>DB: UPDATE orders SET handoff_at=now(), handoff_by=managerId

    Rider->>Svc: transition(RIDER_AT_PICKUP -> ON_THE_WAY)
    Svc->>DB: SELECT * FROM orders WHERE id=orderId FOR UPDATE
    Svc->>Gate: evaluateReleaseGate(order, payment, payout, rider, handoff)
    Gate-->>Svc: { ok: true, failures: [] }
    Svc->>DB: UPDATE orders SET operational_status='ON_THE_WAY', released_at=now(), version=version+1
    Svc->>DB: INSERT delivery_attempts (attempt_no=1, outcome='IN_PROGRESS')
    Svc->>DB: INSERT order_status_history + audit_logs + outbox_events
    Svc-->>Rider: 200 OK (En camino al cliente)
```

---

## 3. Entrega en Efectivo, Libro Mayor de Garantía y Liquidación Diaria (CU-010, CU-012)

```mermaid
sequenceDiagram
    actor Rider as Repartidor
    actor Coord as Coordinador
    participant Svc as Logistics & Wallet Services
    participant DB as PostgreSQL (Append-Only Ledger)

    Rider->>Svc: markDelivered(actor, orderId, cashCollectedCents: 4500)
    Svc->>DB: BEGIN TRANSACTION
    Svc->>DB: SELECT * FROM orders WHERE id = orderId FOR UPDATE
    Svc->>DB: SELECT * FROM riders WHERE id = riderId FOR UPDATE
    Svc->>DB: UPDATE orders SET operational_status='DELIVERED', payment_status='PAID', version=version+1
    Svc->>DB: UPDATE delivery_attempts SET outcome='DELIVERED', cash_collected_cents=4500, ended_at=now()
    Svc->>DB: INSERT INTO wallet_entries (type='CASH_COLLECTED', amount_cents=-4500, order_id=orderId)
    Note right of DB: Garantía disponible del repartidor disminuye en S/ 45.00
    Svc->>DB: COMMIT
    Svc-->>Rider: 200 OK (Nuevo saldo de garantía reflejado)

    Note over Coord,DB: Corte diario 23:00 America/Lima
    Coord->>Svc: confirmSettlement(actor, settlementId, cashReceivedCents: 4500)
    Svc->>DB: BEGIN TRANSACTION
    Svc->>DB: SELECT * FROM riders WHERE id = riderId FOR UPDATE
    Svc->>DB: UPDATE settlements SET cash_received_cents=4500, status='CONFIRMED', confirmed_by=actorId
    Svc->>DB: INSERT INTO wallet_entries (type='CASH_SETTLED', amount_cents=+4500, settlement_id=settlementId)
    Svc->>DB: UPDATE rider_advances SET status='DEDUCTED', deducted_in_settlement_id=settlementId WHERE status='PENDING_DEDUCTION'
    Svc->>DB: COMMIT
    Svc-->>Coord: 200 OK (Liquidación confirmada y garantía restaurada)
```

---

## 4. Integración Bidireccional con Vocero CRM (CU-015 / Punto de Extensión)

```mermaid
sequenceDiagram
    actor Customer as Cliente (WhatsApp)
    participant Vocero as Vocero CRM (../vocero-crm)
    participant Webhook as POST /api/webhooks/vocero
    participant DB as PostgreSQL (Zero Delivery)
    participant Worker as Outbox Worker (Zero Delivery)
    participant Adapter as VoceroCrmAdapter

    Customer->>Vocero: Envía mensaje o comprobante Yape por WhatsApp
    Vocero->>Webhook: POST EventoDespacho (Header: X-Vocero-Signature: sha256=...)
    Webhook->>Webhook: Verifica feature.integration.vocero y firma HMAC-SHA256
    Webhook->>DB: INSERT INTO inbound_events (provider='vocero', external_event_id=dispatchId) ON CONFLICT DO NOTHING
    Webhook-->>Vocero: 200 OK { "ok": true }

    opt Mensaje contiene mediaId (comprobante Yape)
        Worker->>Adapter: downloadMedia(mediaId)
        Adapter->>Vocero: GET /api/bot/media/{mediaId} (X-API-Key: BOT_API_KEY)
        Vocero-->>Adapter: Binario de imagen (sin exponer token de Meta)
        Adapter->>DB: Guarda en StoragePort y asocia proof_asset_id al pago (status sigue PENDING hasta validación humana)
    end

    Note over DB,Vocero: Cuando el pedido cambia de estado (ej. ON_THE_WAY)
    Worker->>DB: Lee outbox_events (type='ORDER_STATUS_CHANGED')
    Worker->>Adapter: notifyOrderStatus(order)
    Adapter->>Vocero: POST /api/bot/messages { conversationId, text: "Tu pedido #1042 está en camino 🛵" }
    Adapter->>Vocero: PUT /api/bot/ficha { conversationId, ficha: { ultimoPedido: "#1042", estado: "ON_THE_WAY" } }
    Adapter->>Vocero: POST /api/bot/stage { conversationId, stage: "En reparto" }
    Vocero-->>Customer: Entrega mensaje por WhatsApp Cloud API
    Worker->>DB: UPDATE outbox_events SET status='SENT', processed_at=now()
```
