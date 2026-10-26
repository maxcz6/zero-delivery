# 08 — Matriz de Trazabilidad (Requerimientos × Casos de Uso × Criterios de Aceptación)

> **Estado:** `[DESIGNED]` · **Versión:** 1.0-mvp · **Dependencias:** `02-casos-de-uso.md` + `07-requerimientos.md`

---

## 1. Cruce de Requerimientos Funcionales (RF) y No Funcionales (RNF) vs. Casos de Uso

| Requerimiento | CU-001 Auth/RBAC | CU-002 Sucursales | CU-003 Catálogo | CU-004 Crear Pedido | CU-005 Preparación | CU-006 Excepciones | CU-007 Pagos/Payout | CU-008 Asignar Rider | CU-009 Liberación | CU-010 Entrega/Ledger | CU-011 Fallo/Devol. | CU-012 Liquidación | CU-013 Reportes/CSV | CU-014 Web Público | CU-015 Vocero CRM | Cobertura |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|---|
| **RF-001** (Auth + 5 roles + `can()`) | **X** | x | x | x | x | x | x | x | x | x | x | x | x | | | **Cubierto (Hito 0)** |
| **RF-002** (Dashboard por rol/periodo) | | | | | | | | | | | | | **X** | | | **Cubierto (Hito 4)** |
| **RF-003** (Monitoreo operativo/alertas) | | **X** | | | **X** | | | **X** | | | | | **X** | | | **Cubierto (Hito 2–4)** |
| **RF-004** (Pedidos + snapshot + costos) | | | | **X** | **X** | | | | | | | | | **X** | | **Cubierto (Hito 2)** |
| **RF-005** (Trazabilidad + pago anticipado) | | | | **X** | **X** | | **X** | | **X** | **X** | **X** | | | | | **Cubierto (Hito 2–3)** |
| **RF-006** (Repartidores + edad 35/garantía) | | | | | | | | **X** | | **X** | | **X** | | | | **Cubierto (Hito 3)** |
| **RF-007** (Visibilidad logística por rol) | **X** | | | | **X** | | | **X** | **X** | **X** | | | | **X** | | **Cubierto (Hito 2–4)** |
| **RF-008** (Catálogo, frágiles, archivado) | | | **X** | **X** | | | | **X** | | | | | | **X** | | **Cubierto (Hito 1)** |
| **RF-009** (Modificadores con precio) | | | **X** | **X** | | | | | | | | | | **X** | | **Cubierto (Hito 1–2)** |
| **RF-010** (Horarios y turnos por sucursal) | | **X** | | **X** | | | | | | | | | | **X** | | **Cubierto (Hito 1)** |
| **RF-011** (Zonas de reparto y tarifas) | | **X** | | **X** | | **X** | | | | | | | | **X** | | **Cubierto (Hito 1)** |
| **RF-012** (Clientes E.164 + `risk_flag`) | | | | **X** | | | | | | | | | **X** | **X** | **X** | **Cubierto (Hito 2)** |
| **RF-013** (Historial de compras cliente) | | | | **X** | | | | | | | | | **X** | | | **Cubierto (Hito 2)** |
| **RF-014** (Estructura de calificaciones) | | | | | | | | | | **X** | | | **X** | | | **Cubierto (SHOULD H4)** |
| **RF-015** (Reporte de Ventas) | | | | | | | | | | | | | **X** | | | **Cubierto (Hito 4)** |
| **RF-016** (Reporte Operativo y Rider) | | | | | | | | | | | | | **X** | | | **Cubierto (Hito 4)** |
| **RF-017** (Reporte de Clientes) | | | | | | | | | | | | | **X** | | | **Cubierto (Hito 4)** |
| **RF-018** (Captura de eventos de embudo) | | | | | | | | | | | | | | **X** | | **Cubierto (SHOULD H4)** |
| **RF-019** (Pagos, Payout y Liberación) | | | | | | | **X** | | **X** | **X** | | | | | | **Cubierto (Hito 3)** |
| **RF-020** (Ledger Garantía y Corte 23:00) | | | | | | | | **X** | | **X** | | **X** | | | | **Cubierto (Hito 3)** |
| **RF-021** (Extensión de Promociones) | | | **X** | **X** | | | | | | | | | | | | **Cubierto (Extensión)** |
| **RF-023..27** (Integración Vocero CRM) | | | | | | | | | | | | | | | **X** | **Cubierto (Extensión/R1)** |
| **RF-028** (Tablero Kanban por rol) | | | | | **X** | | | **X** | **X** | **X** | **X** | | | | | **Cubierto (Hito 2)** |
| **RF-029** (Alertas operativas + sonido) | | | | **X** | **X** | **X** | | | **X** | | **X** | | | | | **Cubierto (Hito 2–4)** |
| **RF-030** (Búsqueda y filtros avanzados) | | | | **X** | **X** | | | | | | | | **X** | | | **Cubierto (Hito 2)** |
| **RF-031** (Auditoría inmutable `audit_logs`) | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | | | | **Cubierto (Hito 0–4)** |
| **RF-032** (Exportación CSV con permisos) | | | | | | | | | | | | | **X** | | | **Cubierto (Hito 4)** |
| **RNF-001..10** (Seguridad, Ledger, PWA, `es-PE`) | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **X** | **Cubierto (Hito 0–4)** |

---

## 2. Matriz de Trazabilidad de Criterios de Aceptación Oficiales (`CA-01` a `CA-15`)

| ID | Criterio de Aceptación | Casos de Uso | Módulos Responsables | Hito de Cierre | Verificación Automatizada |
|---|---|---|---|---|---|
| **CA-01** | Usuario no autorizado no puede ejecutar acciones restringidas ni modificando la UI ni llamando directo al servidor. | CU-001 a CU-013 | `identity/domain/permissions.ts` | Hito 0–4 | Test table-driven de matriz `can()` + test de integración HTTP `403`. |
| **CA-02** | Encargado y Coordinador aceptan/rechazan; sin respuesta genera alerta al Coordinador, sin cancelación automática. | CU-005 | `orders`, `alerts`, `worker` | Hito 2 | Test de transición `NEW -> CONFIRMED/REJECTED` y job de timeout. |
| **CA-03** | Pago anticipado pendiente no impide preparar, pero sí despachar. | CU-005, CU-007, CU-009 | `orders`, `payments` | Hito 3 | Test `PREPARING/READY` con `payment_status = PENDING` OK, `ON_THE_WAY` bloqueado. |
| **CA-04** | El sistema impide el despacho si no se cumplen pago al cliente, pago al restaurante, handoff y asignación aplicables. | CU-009 | `orders/domain/release-gate.ts` + SQL `CHECK` | Hito 3 | Test unitario exhaustivo de `evaluateReleaseGate()` + constraint BD. |
| **CA-05** | Producto faltante: se registra, se informa a cliente y Coordinador, y se conserva la decisión del cliente. | CU-006 | `orders` | Hito 2 | Test de ítem `UNAVAILABLE` → `ACCEPTED_REPLACEMENT` / `CANCELLED_ITEM`. |
| **CA-06** | Asignación manual respeta disponibilidad, permisos, vehículo y garantía. | CU-008 | `logistics/domain/eligibility.ts` | Hito 3 | Test unitario de `canAssignRider()` en todos los escenarios. |
| **CA-07** | Entrega fallida registra motivo, fecha, intento y evidencia; 2.º intento exige Coordinador. | CU-011 | `logistics`, `orders` | Hito 3 | Test de transición `DELIVERY_FAILED` con `attempt_no = 1, 2`. |
| **CA-08** | Encargado confirma recepción física de devolución; Coordinador decide reintento o cierre. | CU-011 | `orders`, `logistics` | Hito 3 | Test `RETURN_PENDING -> RETURNED_TO_RESTAURANT -> PENDING_RESOLUTION`. |
| **CA-09** | Garantía insuficiente o deuda (`balance < 0`) bloquea nuevos pedidos en efectivo. | CU-008, CU-012 | `wallet`, `logistics` | Hito 3 | Test de `canAssignRider()` con efectivo vs. prepago cuando hay deuda o saldo bajo. |
| **CA-10** | Adelanto requiere autorización humana, queda registrado y se descuenta en la siguiente liquidación diaria. | CU-012 | `wallet` | Hito 3 | Test de `rider_advances` (`PENDING_DEDUCTION -> DEDUCTED`) al confirmar `settlement`. |
| **CA-11** | Toda corrección de pago registra motivo, actor, valor anterior y nuevo. | CU-007 | `payments`, `db` | Hito 3 | Test de `payment_events` (`type = 'CORRECTED'`) + constraint SQL. |
| **CA-12** | Cada rol consulta solo los datos personales y financieros necesarios. | CU-004, CU-014 | `orders/domain/dtos.ts` | Hito 2–4 | Test unitario que verifica que `CustomerOrderDTO` no expone costos internos ni GPS. |
| **CA-13** | Eventos duplicados no generan pedidos/pagos duplicados; fallos quedan registrados y alertan. | CU-004, CU-015 | `orders`, `integrations` | Hito 0 (Infra) / R1 | Test de `idempotency_key` y dedupe de `inbound_events` + firma HMAC de Vocero CRM. |
| **CA-14** | Exportación CSV (y futuros Excel/PDF) respeta los permisos de lectura del reporte. | CU-013 | `reporting` | Hito 4 | Test de `CsvStreamExporter` + autorización previa del servicio de reporte. |
| **CA-15** | Las copias de seguridad se generan y pueden restaurarse. | Todos | `scripts/backup.sh`, `scripts/restore.sh` | Hito 4 | Runbook y scripts de respaldo/restauración. |
