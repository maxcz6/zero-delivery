# Pruebas de carga realistas — k6

Simulación de un local en hora punta: **6 roles trabajando a la vez** sobre el mismo
inquilino demo (`zero-delivery-demo`), cada uno haciendo lo que haría en la vida real.

| Escenario | VUs | Qué hace |
|---|---|---|
| `clientes` | 4 | Entra a `/m`, mira sucursales y carta, y ~25 % de las visitas crea un pedido real (efectivo/Yape/transferencia) y consulta su seguimiento. |
| `soporte` | 1 | Revisa pedidos activos, valida comprobantes Yape/Transferencia y consulta recomendaciones de repartidor. |
| `coordinador` | 1 | Acepta pedidos `NUEVO`, asigna repartidor (usando el ranking) y confirma el pago a la sucursal cuando existe. |
| `cocina` | 1 | `CONFIRMADO → EN_PREPARACION → LISTO`, registra el traspaso y despacha a `EN_CAMINO`. |
| `repartidor` | 1 | Envía GPS cada vuelta, marca recojo, entrega y registra el cobro en efectivo. |
| `admin` | 1 | Consulta métricas, sucursales, catálogo y flota. |

Cada usuario mantiene su sesión y hace pausas de 2–8 s entre acciones (think time),
como una persona real; no es un martilleo de un solo endpoint.

## Ejecutar

```powershell
# Instalado con winget: winget install GrafanaLabs.k6
& 'C:\Program Files\k6\k6.exe' run zero-delivery/tests/k6/realistic-flows.js

# Humo (20 s, la mitad de usuarios)
& 'C:\Program Files\k6\k6.exe' run -e DURATION=20s -e SCALE=0.5 zero-delivery/tests/k6/realistic-flows.js

# Contra otra URL
& 'C:\Program Files\k6\k6.exe' run -e BASE_URL=http://localhost:4000 zero-delivery/tests/k6/realistic-flows.js

# Escalar
& 'C:\Program Files\k6\k6.exe' run -e SCALE=2 -e DURATION=5m zero-delivery/tests/k6/realistic-flows.js
```

Variables:

| Variable | Default | Uso |
|---|---|---|
| `BASE_URL` | `http://localhost:4000` | API objetivo (no el web :3001). |
| `DURATION` | `2m` | Duración de cada escenario. |
| `SCALE` | `1` | Multiplica los VUs (0.5 = humo). |

## Qué valida

- `checks` ≥ 92 %: sucursales, carta, seguimiento, métricas y recomendaciones responden 200.
- `http_req_failed` < 6 %: sin 401/403/404/5xx inesperados.
- Latencias: p95 < 2.5 s global, p95 < 1.5 s en login/carta, p95 < 2.5 s al crear pedido.
- Contadores de negocio: `orders_created`, `payments_validated`, `riders_assigned`,
  `kitchen_started`, `kitchen_ready`, `handoffs_registered`, `orders_dispatched`,
  `orders_delivered`, `cash_collections`, `gps_pings`, `release_gate_blocked`.

Las respuestas `400/409/422` se consideran esperables (carreras por el mismo pedido,
comprobante ya validado, compuerta de liberación) y no cuentan como fallo HTTP; sí se
miden con sus propios contadores.

## Efectos sobre los datos

- **Abre la sucursal** al empezar y la deja como estaba al terminar (`teardown`).
- **Crea pedidos reales** (y clientes) con el teléfono aleatorio.
- Valida pagos, asigna repartidores y mueve estados de pedidos existentes.
- **No borra nada.** Ejecútalo contra el entorno demo, nunca contra producción.

Si el proceso se corta antes del `teardown`, la sucursal queda abierta: se cierra a mano
desde `/admin/sucursales`.

## Hallazgos que la prueba destapó

1. **Los pedidos nuevos no pueden despacharse**: al crear un pedido no se crea el
   registro en `pagos_restaurante` y la configuración
   `requiere_confirmacion_pago_restaurante` no existe en el inquilino, así que la
   compuerta de liberación (`EN_CAMINO`) siempre responde
   `RELEASE_GATE_RESTAURANT_PAYOUT_PENDING`. Por eso `orders_dispatched` y
   `orders_delivered` quedan en 0 salvo pedidos sembrados con el pago ya confirmado.
2. **El traspaso devuelve 500 en vez de 400** cuando el pago a la sucursal no está
   confirmado: el constraint `pedidos_traspaso_requiere_pago_chk` revienta dentro de
   `registerHandoff`. La prueba evita ese caso filtrando por `estado_pago_restaurante`.
3. Las sesiones no sobreviven entre iteraciones de k6; el script usa además
   `Authorization: Bearer` (soportado por el `AuthGuard`) y re-loguea ante un 401.
