# 03 — Modelo de Dominio Conceptual

> **Estado:** `[DESIGNED]` · **Versión:** 1.0-mvp · **Fuente:** `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md` §6–§10

---

## 1. Diagrama de Clases Conceptual (Mermaid)

```mermaid
classDiagram
    class Tenant {
        +UUID id
        +String name
        +String slug
        +TenantStatus status
    }

    class User {
        +UUID id
        +String username
        +String displayName
        +Role role
        +Boolean isActive
    }

    class Restaurant {
        +UUID id
        +String name
        +String legalName
        +String ruc
        +Boolean isActive
    }

    class Branch {
        +UUID id
        +String name
        +String slug
        +String address
        +Boolean isOpenManual
        +Boolean isActive
    }

    class BranchSchedule {
        +Int dayOfWeek
        +Int shiftNo
        +Time opensAt
        +Time closesAt
    }

    class DeliveryZone {
        +UUID id
        +String name
        +Cents feeCents
        +Cents minOrderCents
    }

    class Product {
        +UUID id
        +String name
        +Boolean isFragile
        +Cents basePriceCents
        +Cents packagingCents
        +MarginType marginType
        +Decimal marginValue
        +DateTime archivedAt
    }

    class Menu {
        +UUID id
        +String name
        +Boolean isDefault
        +Boolean includesDeliveryInPrice
        +Boolean includesTaxInPrice
    }

    class MenuItem {
        +Cents priceCents
        +Boolean isAvailable
    }

    class Customer {
        +UUID id
        +String name
        +PhoneE164 phoneE164
        +CustomerSegment segment
        +RiskFlag riskFlag
        +String riskReason
    }

    class Order {
        +UUID id
        +BigInt number
        +OrderChannel channel
        +OperationalStatus operationalStatus
        +PaymentStatus paymentStatus
        +PaymentMethod paymentMethod
        +PayoutStatus restaurantPayoutStatus
        +DateTime handoffAt
        +DateTime releasedAt
        +Cents itemsSubtotalCents
        +Cents deliveryFeeCents
        +Cents totalCents
        +Cents cashToCollectCents
        +Int version
    }

    class OrderItem {
        +UUID id
        +String nameSnapshot
        +Int qty
        +Cents basePriceCents
        +Cents packagingCents
        +Cents marginCents
        +Cents unitPriceCents
        +Cents lineTotalCents
        +OrderItemStatus status
        +CustomerDecision customerDecision
    }

    class Payment {
        +UUID id
        +PaymentMethod method
        +Cents amountCents
        +PaymentStatus status
        +DateTime validatedAt
    }

    class RestaurantPayout {
        +UUID id
        +Cents amountCents
        +PayoutStatus status
        +DateTime confirmedAt
    }

    class Rider {
        +UUID id
        +String fullName
        +Date birthDate
        +FleetType fleetType
        +VehicleType vehicleType
        +RiderStatus status
        +Boolean highTrust
    }

    class DeliveryAttempt {
        +Int attemptNo
        +AttemptOutcome outcome
        +String failureReason
        +Cents cashCollectedCents
    }

    class WalletEntry {
        +UUID id
        +WalletEntryType type
        +SignedCents amountCents
        +String reason
        +DateTime createdAt
    }

    class RiderAdvance {
        +UUID id
        +Cents amountCents
        +String purpose
        +AdvanceStatus status
    }

    class Settlement {
        +UUID id
        +Date businessDate
        +Cents cashCollectedCents
        +Cents cashReceivedCents
        +Cents advancesDeductedCents
        +Cents riderFeePayableCents
        +SignedCents netCents
        +SettlementStatus status
    }

    Tenant "1" --> "*" User : emplea/registra
    Tenant "1" --> "*" Restaurant : administra
    Restaurant "1" --> "*" Branch : opera en
    Branch "1" --> "*" BranchSchedule : atiende según
    Branch "1" --> "*" DeliveryZone : cubre
    Restaurant "1" --> "*" Product : ofrece
    Branch "1" --> "*" Menu : publica
    Menu "1" --> "*" MenuItem : contiene
    Product "1" --> "*" MenuItem : listado en
    Customer "1" --> "*" Order : realiza
    Branch "1" --> "*" Order : prepara
    Order "1" --> "1..*" OrderItem : incluye snapshot
    Order "1" --> "1..*" Payment : se paga con
    Order "1" --> "1" RestaurantPayout : liquida al local
    Rider "0..1" --> "*" Order : reparte
    Order "1" --> "*" DeliveryAttempt : registra intentos
    Rider "1" --> "*" WalletEntry : libro mayor garantía
    Rider "1" --> "*" RiderAdvance : solicita adelantos
    Rider "1" --> "*" Settlement : liquida diario
```

---

## 2. Responsabilidad de las Entidades de Dominio

| Entidad | Módulo | Responsabilidad de Negocio e Invariantes Clave |
|---|---|---|
| **Tenant** | `tenancy` | Representa la agencia operadora (aislamiento lógico multi-tenant desde el día 1). |
| **User** | `identity` | Actor autenticado con uno de los 5 roles (`ADMIN`, `COORDINATOR`, `BRANCH_MANAGER`, `SUPPORT_AGENT`, `RIDER`) y alcance opcional por sucursales (`user_branch_access`). |
| **Restaurant & Branch** | `tenancy` | Separa la marca gastronómica (`Restaurant`) del punto físico de despacho (`Branch`). Cada sucursal gestiona sus turnos (`BranchSchedule`), su interruptor manual (`isOpenManual`) y sus zonas de reparto (`DeliveryZone`). |
| **Product, Modifier & Menu** | `catalog` | Define el catálogo con desglose de costos internos (`basePriceCents`, `packagingCents`, `marginType`, `marginValue`) y marca `isFragile`. Nunca se elimina físicamente si tuvo ventas (`archivedAt`). |
| **Customer** | `customers` | Identificado de forma única por `(tenantId, phoneE164)`. Posee clasificación comercial (`NEW`, `RECURRING`, `TOP`) e indicador de seguridad manual auditado (`riskFlag`: `NONE`, `CAUTION`, `BLOCKED`). |
| **Order & OrderItem** | `orders` | Agregado central. Separa estrictamente `operationalStatus`, `paymentStatus` y `restaurantPayoutStatus`. Guarda snapshots de precios y modificadores en `OrderItem` para que cambios futuros de catálogo no alteren la contabilidad histórica. |
| **Payment & RestaurantPayout** | `payments` | Separa el cobro al cliente (`Payment` + bitácora inmutable `PaymentEvent`) del pago que la agencia realiza al encargado del restaurante antes del retiro (`RestaurantPayout`). |
| **Rider & DeliveryAttempt** | `logistics` | Modela al repartidor (flota propia, agencia externa o tercero), su vehículo (`MOTO`/`CAR`), elegibilidad para efectivo (edad ≥ 35 o `highTrust` o garantía suficiente) y hasta 2 intentos de entrega por pedido. |
| **WalletEntry, RiderAdvance & Settlement** | `wallet` | Implementa el libro mayor de solo-inserción (`WalletEntry`) donde el saldo de garantía es siempre `SUM(amount_cents)`. Los cobros en efectivo restan garantía (`CASH_COLLECTED -`) y las entregas de efectivo en la liquidación diaria de las 23:00 la restauran (`CASH_SETTLED +`). |
