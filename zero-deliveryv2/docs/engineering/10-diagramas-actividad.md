# 10 — Diagramas de Actividad y Flujos de Proceso

> **Estado:** `[DESIGNED]` · **Versión:** 1.0-mvp · **Fuente:** `docs/ZERO_DELIVERY_MVP_BUILD_SPEC.md` §7–§10

---

## 1. Proceso de Evaluación de la Regla de Liberación (`evaluateReleaseGate` — CU-009)

```mermaid
flowchart TD
    Start(["Inicio: Repartidor solicita pasar a ON_THE_WAY"]) --> CheckRider{"1. ¿Tiene repartidor asignado<br/>y elegible (canAssignRider)?"}
    CheckRider -->|No| FailRider["Agregar fallo: RIDER_NOT_ASSIGNED_OR_INELIGIBLE"]
    CheckRider -->|Sí| CheckMethod{"2. ¿Método de pago es<br/>YAPE o BANK_TRANSFER?"}

    CheckMethod -->|Sí| CheckPaid{"¿payment_status == PAID<br/>(validado por humano)?"}
    CheckMethod -->|No (CASH)| CheckPayout

    CheckPaid -->|No| FailPayment["Agregar fallo: PREPAID_PAYMENT_NOT_VALIDATED"]
    CheckPaid -->|Sí| CheckPayout{"3. ¿Pago al restaurante confirmado<br/>(restaurant_payout_status == CONFIRMED)?"}

    FailRider --> CheckMethod
    FailPayment --> CheckPayout

    CheckPayout -->|No| FailPayout["Agregar fallo: RESTAURANT_PAYOUT_NOT_CONFIRMED"]
    CheckPayout -->|Sí| CheckHandoff{"4. ¿Encargado registró entrega física<br/>(handoff_at != null)?"}
    FailPayout --> CheckHandoff

    CheckHandoff -->|No| FailHandoff["Agregar fallo: HANDOFF_NOT_REGISTERED"]
    CheckHandoff -->|Sí| EvaluateResult{"¿Lista de fallos vacía?"}
    FailHandoff --> EvaluateResult

    EvaluateResult -->|Sí| Approve(["Permitir transición a ON_THE_WAY<br/>Registrar released_at y released_by"])
    EvaluateResult -->|No| Reject(["Rechazar con 409 RELEASE_GATE_FAILED<br/>Devolver detalle de condiciones faltantes"])
```

---

## 2. Proceso de Elegibilidad del Repartidor (`canAssignRider` — CU-008)

```mermaid
flowchart TD
    Start(["Inicio: Evaluar elegibilidad de Repartidor para Pedido"]) --> ActiveCheck{"¿Repartidor activo y<br/>status == AVAILABLE<br/>(o BUSY con multi-pedido activo)?"}
    ActiveCheck -->|No| IneligibleStatus(["No elegible: RIDER_UNAVAILABLE"])
    ActiveCheck -->|Sí| FragileCheck{"¿Pedido contiene producto frágil<br/>que requiere CAR?"}

    FragileCheck -->|Sí y vehicle_type != CAR| IneligibleVehicle(["No elegible: VEHICLE_MISMATCH_REQUIRES_CAR"])
    FragileCheck -->|No o vehicle_type == CAR| PaymentCheck{"¿Pedido es en EFECTIVO (CASH)?"}

    PaymentCheck -->|No (Ya pagado Yape/Transfer)| EligiblePrepaid(["Elegible: Pedido sin cobro en efectivo"])
    PaymentCheck -->|Sí (CASH)| DebtCheck{"¿guarantee_balance < 0<br/>(Tiene deuda pendiente)?"}

    DebtCheck -->|Sí| BlockedDebt(["Bloqueado: RIDER_HAS_NEGATIVE_BALANCE<br/>Mostrar deuda y motivo"])
    DebtCheck -->|No| ExemptionCheck{"¿Exento de garantía?<br/>(edad >= min_age [35] O high_trust == true)"}

    ExemptionCheck -->|Sí| EligibleExempt(["Elegible por Excepción<br/>Registrar condición que habilitó excepción"])
    ExemptionCheck -->|No| BalanceCheck{"¿guarantee_balance >= max(min_cents, cash_to_collect_cents)?"}

    BalanceCheck -->|Sí| EligibleGuarantee(["Elegible: Garantía suficiente"])
    BalanceCheck -->|No| BlockedGuarantee(["Bloqueado para Efectivo: INSUFFICIENT_GUARANTEE"])
```

---

## 3. Proceso de Entrega Fallida, Segundo Intento y Devolución (CU-011)

```mermaid
flowchart TD
    Start(["Inicio: Repartidor en ON_THE_WAY no logra entregar"]) --> RecordFail["Repartidor registra DELIVERY_FAILED<br/>con motivo obligatorio y foto opcional"]
    RecordFail --> CheckAttempt{"¿attempt_no == 2<br/>(Alcanzó máximo de 2 intentos)?"}

    CheckAttempt -->|Sí (2.º intento falló)| AutoPending["Transición automática a PENDING_RESOLUTION<br/>Alerta crítica al Coordinador"]
    CheckAttempt -->|No (1.er intento falló)| CoordDecision{"Decisión del Coordinador"}

    CoordDecision -->|"Autorizar 2.º intento"| SecondAttempt["Autorizar 2.º intento (authorized_by)<br/>Pasa a RIDER_ASSIGNED"]
    SecondAttempt --> RetryDelivery["Repartidor ejecuta 2.º intento (ON_THE_WAY)"]

    CoordDecision -->|"Ordenar devolución al local"| ReturnPending["Pasa a RETURN_PENDING<br/>Repartidor regresa a la sucursal"]
    AutoPending --> ReturnOrClose{"¿Producto físico debe<br/>devolverse al local?"}
    ReturnOrClose -->|Sí| ReturnPending
    ReturnOrClose -->|No / Ya devuelto| FinalResolution

    ReturnPending --> ManagerConfirm["Encargado confirma recepción física<br/>Pasa a RETURNED_TO_RESTAURANT"]
    ManagerConfirm --> FinalResolution["Pasa a PENDING_RESOLUTION"]

    FinalResolution --> LossCheck{"¿Existe pérdida económica?"}
    LossCheck -->|Sí| CreateIncident["Coordinador/Admin registra decisión y justificación<br/>en order_incidents (sin cargo automático)"]
    LossCheck -->|No| CloseOrder["Coordinador cierra en CANCELLED con resolution"]
    CreateIncident --> CloseOrder
    CloseOrder --> EndNode(["Fin del flujo de excepción"])
```
