# Integración con Vocero CRM

> Cómo se conectan Zero Delivery y Vocero CRM en ambos sentidos: qué viaja, quién manda, cómo se autentica, qué se guarda, qué se ignora y qué se reintenta.
>
> Aplica a: Administrador (configura), Coordinador (recibe alertas), Empleado (atiende conversaciones) y desarrollo.
> Fecha: 2026-10-26

---

## Índice

1. [Reparto de responsabilidades](#1-reparto-de-responsabilidades)
2. [Arquitectura](#2-arquitectura)
3. [Configuración](#3-configuración)
4. [Flujo entrante paso a paso](#4-flujo-entrante-paso-a-paso)
5. [Idempotencia y estados de entrada](#5-idempotencia-y-estados-de-entrada)
6. [Flujo saliente (Zero → Vocero)](#6-flujo-saliente-zero--vocero)
7. [Mapa de la ficha](#7-mapa-de-la-ficha)
8. [Mensajes por evento](#8-mensajes-por-evento)
9. [Handoff a humano](#9-handoff-a-humano)
10. [Medios entrantes (comprobantes)](#10-medios-entrantes-comprobantes)
11. [Errores, reintentos y cola muerta](#11-errores-reintentos-y-cola-muerta)
12. [Seguridad y privacidad](#12-seguridad-y-privacidad)
13. [Pantallas de integración](#13-pantallas-de-integración)
14. [Secuencia completa](#14-secuencia-completa)
15. [Estado real de la integración](#15-estado-real-de-la-integración)
16. [Checklist de puesta en marcha](#16-checklist-de-puesta-en-marcha)

---

## 1. Reparto de responsabilidades

| Dominio | Vocero CRM | Zero Delivery |
|---|---|---|
| Canales de mensajería (WhatsApp, Instagram, Messenger, TikTok) | **Dueño** | — |
| Token de WhatsApp | **Nunca sale de Vocero** | Nunca lo recibe |
| IA conversacional y ventana de 24 h | **Dueño** | — |
| Ficha del contacto | **Almacena** | Envía datos |
| Handoff a humano | **Ejecuta** | Lo solicita |
| Catálogo, precios, pedidos | — | **Dueño** |
| Pagos y validación humana | — | **Dueño** |
| Logística, riders, garantía, liquidación | — | **Dueño** |
| Decisión de dinero | — | **Siempre humana** |

Regla de oro: **Vocero conversa; Zero Delivery opera.** La IA de Vocero no aprueba pagos, no fija precios, no asigna riders y no decide reembolsos. Cuando el cliente pide algo sensible, se hace handoff a una persona.

**Por qué esta separación:**

- El token de WhatsApp es el activo más delicado; queda en un solo sistema.
- Zero Delivery no necesita implementar mensajería ni IA.
- Vocero no necesita conocer reglas de negocio ni montos internos.
- Un fallo de mensajería no bloquea una venta; un fallo de pedido no tumba el canal.

---

## 2. Arquitectura

```
                    ┌──────────────────────────────────────┐
                    │            VOCERO CRM 2.1            │
                    │  WhatsApp · IG · Messenger · TikTok  │
                    │  IA · ventana 24h · ficha · handoff  │
                    └───────┬──────────────────▲───────────┘
      EventoDespacho        │                  │   /api/bot/*
      POST /api/webhooks/vocero               │   X-API-Key
      X-Vocero-Signature: sha256=…            │
                            ▼                  │
                    ┌──────────────────────────────────────┐
                    │           ZERO DELIVERY              │
                    │  webhook  →  eventos_entrada         │
                    │  pedidos  →  eventos_salida (outbox) │
                    │  worker   →  VoceroCrmAdapter        │
                    └──────────────────────────────────────┘
```

| Componente | Responsabilidad |
|---|---|
| `POST /api/webhooks/vocero` | Recibir, autenticar y validar el evento |
| `eventos_entrada` | Registro idempotente del evento crudo |
| Worker de entrada | Procesar el evento y vincularlo a un pedido/cliente |
| `eventos_salida` | Cola de mensajes, fichas y handoffs |
| Worker de salida | Ejecutar el envío con reintentos |
| `VoceroCrmAdapter` | Hablar con `/api/bot/*` |
| `GET /api/webhooks/vocero/health` | Responder al healthcheck de Vocero |

---

## 3. Configuración

### 3.1 Variables de entorno

| Variable | Uso | Default |
|---|---|---|
| `VOCERO_BASE_URL` | URL de Vocero CRM | `http://localhost:3000` |
| `VOCERO_BOT_API_KEY` | Secreto compartido: verifica HMAC entrante y autentica llamadas salientes | — (obligatorio para encender) |
| `FEATURE_INTEGRATION_VOCERO` | Interruptor maestro por entorno | ausente / `false` |
| `APP_BASE_URL` | URL pública de Zero Delivery | `http://localhost:3001` |

Ajuste de inquilino: `feature.integration.vocero` (por defecto **false**). El código evalúa el flag de entorno **OR** el de configuración.

### 3.2 Endpoints

| Endpoint | Dirección | Propósito |
|---|---|---|
| `POST /api/webhooks/vocero` | Vocero → Zero | Recibe `EventoDespacho` |
| `GET /api/webhooks/vocero/health` | Vocero → Zero | Healthcheck |
| `POST /api/bot/messages` | Zero → Vocero | Enviar mensaje |
| `PUT /api/bot/ficha` | Zero → Vocero | Actualizar ficha |
| `POST /api/bot/handoff` | Zero → Vocero | Pedir humano |
| `GET /api/bot/media/{mediaId}` | Zero → Vocero | Descargar archivo |

### 3.3 Healthcheck implementado

```json
{ "ok": true, "service": "zero-delivery", "voceroIntegrationEnabled": false }
```

Vocero lo consulta antes de permitir encender el interruptor de despacho. Si `voceroIntegrationEnabled` es `false`, Vocero no debe encender su lado.

### 3.4 Regla de configuración

- Encender exige: `voceroIntegrationEnabled = true`, `VOCERO_BOT_API_KEY` presente y health `ok`.
- Apagar es inmediato: el webhook pasa a responder `404`.
- La API key nunca se muestra completa en la UI.
- El valor de `VOCERO_BOT_API_KEY` debe ser **idéntico** al `BOT_API_KEY` de Vocero.

---

## 4. Flujo entrante paso a paso

1. **Vocero** agrupa los mensajes de una conversación y envía `POST /api/webhooks/vocero` con el cuerpo `EventoDespacho` y la cabecera `X-Vocero-Signature: sha256=<hex>`.
2. **Zero Delivery** normaliza el proveedor y evalúa el flag. Si está apagado o el proveedor no es `vocero` → `404 NOT_FOUND` (no revela que el endpoint existe).
3. **Lee el cuerpo crudo** (`request.text()`) antes de parsear; la firma se calcula sobre los bytes exactos.
4. **Verifica HMAC-SHA256** con `VOCERO_BOT_API_KEY` y comparación en tiempo constante (`timingSafeEqual`). Firma inválida o ausente → `401 UNAUTHENTICATED`.
5. **Parsea JSON**. Si falla → `422 VALIDATION_ERROR`.
6. **Valida el esquema Zod** `voceroDispatchEventSchema`. Si falla → `422` con `details`.
7. **Ignora conversaciones de laboratorio**: `conversation.test === true` → `200 { status: "IGNORED_TEST_CONVERSATION" }`.
8. **Idempotencia** (diseñada): registra `(provider='vocero', external_event_id=dispatchId)` en `eventos_entrada`. Si ya existe → `200` sin reprocesar.
9. **Procesamiento asíncrono** (diseñado): el evento queda `RECIBIDO` y un worker lo procesa; el webhook responde rápido.
10. **Respuesta**: `200 { ok: true, dispatchId, status: "RECEIVED" }`.

> 🟡 **Estado real:** los pasos 1–7 y 10 están implementados. Los pasos 8 y 9 **no**: hoy el webhook valida y responde, pero **no persiste** en `eventos_entrada` ni crea pedidos. La tabla y el índice único existen; falta conectarlos.

### 4.1 Cuerpo `EventoDespacho`

```json
{
  "dispatchId": "dsp_123",
  "organization": { "id": "org_1", "slug": "zero-delivery" },
  "conversation": {
    "id": "conv_abc",
    "channel": "whatsapp",
    "aiEnabled": true,
    "windowOpen": true,
    "windowExpiresAt": "2026-10-26T23:59:59.000Z",
    "test": false
  },
  "contact": {
    "id": "ct_1",
    "displayName": "María López",
    "identity": "+51987654321"
  },
  "messages": [
    {
      "id": "msg_1",
      "at": "2026-10-26T18:02:00.000Z",
      "type": "text",
      "text": "Quiero 2 combos al +51987654321",
      "mediaId": null,
      "mimeType": null,
      "caption": null
    }
  ],
  "firstMessageAt": "2026-10-26T18:00:00.000Z",
  "lastMessageAt": "2026-10-26T18:05:00.000Z"
}
```

### 4.2 Campos del contrato

| Campo | Tipo | Nota |
|---|---|---|
| `dispatchId` | string | Clave de idempotencia |
| `organization.id` / `slug` | string | Debe corresponder al inquilino |
| `conversation.id` | string | ID de conversación de Vocero |
| `conversation.channel` | enum | `whatsapp`, `instagram`, `messenger`, `tiktok` |
| `conversation.aiEnabled` | boolean | Si la IA está activa |
| `conversation.windowOpen` | boolean | Ventana de 24 h |
| `conversation.windowExpiresAt` | string \| null | Vencimiento |
| `conversation.test` | `true` opcional | Laboratorio: se ignora |
| `contact.id` / `displayName` / `identity` | string | `identity` suele ser el teléfono E.164 |
| `messages[]` | array | Mínimo 1 |
| `messages[].type` | string | `text`, media, ubicación, contactos |
| `messages[].mediaId` | string \| null | Para descargar el archivo |
| `messages[].location` | objeto opcional | `latitude`, `longitude`, `name`, `address` |
| `messages[].contacts` | array opcional | `[{ name }]` |
| `firstMessageAt` / `lastMessageAt` | string | Marcas de la conversación |

### 4.3 Códigos de respuesta

| Situación | HTTP | Código |
|---|---:|:-:|
| Proveedor distinto o flag apagado | 404 | `NOT_FOUND` |
| Firma ausente/inválida | 401 | `UNAUTHENTICATED` |
| JSON inválido | 422 | `VALIDATION_ERROR` |
| Esquema inválido | 422 | `VALIDATION_ERROR` + details |
| Conversación de prueba | 200 | `IGNORED_TEST_CONVERSATION` |
| Recibido | 200 | `RECEIVED` |
| Duplicado (diseñado) | 200 | `DUPLICATE_IGNORED` |

### 4.4 Reglas de procesamiento (diseñadas)

- `organization.slug` debe coincidir con el inquilino; si no, se descarta y se alerta.
- El teléfono `contact.identity` se normaliza a E.164 y se busca/crea el cliente.
- Un mensaje no crea un pedido por sí solo: se interpreta y se confirma con el cliente o con un humano.
- **Nunca** se crea un pedido con pago aprobado automáticamente.
- Los mensajes de tipo media se guardan como referencia, no se interpretan como pago.
- Si el evento llega sin `messages`, se rechaza por esquema.

---

## 5. Idempotencia y estados de entrada

Tabla `eventos_entrada` (esquema español):

| Campo | Uso |
|---|---|
| `proveedor` | `vocero` |
| `id_evento_externo` | `dispatchId` |
| `carga_util` | Payload original completo |
| `estado` | `RECIBIDO` → `PROCESADO` / `FALLIDO` / `IGNORADO` |
| `intentos` | Reintentos de procesamiento |
| `error` | Último error |
| `recibido_en`, `procesado_en` | Marcas de tiempo |

Reglas:

- Índice único `(proveedor, id_evento_externo)`.
- Un duplicado **no** reprocesa ni duplica pedidos.
- La tabla es de solo inserción; por excepción se permite actualizar únicamente `estado`, `procesado_en`, `error` e `intentos`. DELETE y TRUNCATE están bloqueados por trigger.
- Un evento `FALLIDO` puede reprocesarse manualmente desde la pantalla de integraciones.
- El payload se guarda completo para auditoría y depuración.

```
Vocero ──► POST ──► ¿flag? ──no──► 404
                     │sí
                     ▼
              ¿firma válida? ──no──► 401
                     │sí
                     ▼
              ¿JSON + esquema? ──no──► 422
                     │sí
                     ▼
              ¿test? ──sí──► 200 IGNORED
                     │no
                     ▼
        INSERT eventos_entrada (único) ──duplicado──► 200 DUPLICATE
                     │nuevo
                     ▼
              200 RECEIVED + worker
```

---

## 6. Flujo saliente (Zero → Vocero)

El adaptador `VoceroCrmAdapter` implementa `CrmPort` y `NotificationPort`. Si `enabled = false` o falta `voceroConversationId`, es **no-op seguro** y devuelve `ok: true` sin llamar a la red.

| Método | Endpoint | Cuerpo | Uso |
|---|---|---|---|
| `send` | `POST /api/bot/messages` | `{ conversationId, text }` | Enviar mensaje al cliente |
| `upsertCustomer` | `PUT /api/bot/ficha` | `{ conversationId, ficha: { zeroDeliveryCustomerId, nombreCliente, segmentoZeroDelivery } }` | Sincronizar cliente |
| `pushOrder` | `PUT /api/bot/ficha` | `{ conversationId, ficha: { ultimoPedidoNumero, ultimoPedidoEstado, ultimoPedidoTotal } }` | Sincronizar último pedido |
| `pushOrderStatus` | `PUT /api/bot/ficha` | `{ conversationId, ficha: { ultimoPedidoNumero, ultimoPedidoEstado } }` | Actualizar estado |
| `requestHumanHandoff` | `POST /api/bot/handoff` | `{ conversationId, reason }` | Pedir atención humana |
| `downloadInboundMedia` | `GET /api/bot/media/{mediaId}` | — | Descargar comprobante o foto |

Cabeceras salientes:

```
Content-Type: application/json
X-API-Key: <VOCERO_BOT_API_KEY>
```

### 6.1 Comportamiento del adaptador

- Normaliza `baseUrl` quitando barras finales.
- `send`: si está apagado o no hay conversación, devuelve `{ ok: true, externalMessageId: "noop_disabled_or_no_conversation" }`.
- `send`: si la respuesta es OK, lee `messageId`; si no, devuelve `VOCERO_HTTP_<status>:<body>`.
- `upsertCustomer`, `pushOrder`, `pushOrderStatus`, `requestHumanHandoff`: no-op si está apagado o falta conversación.
- `downloadInboundMedia`: lanza error con el HTTP si falla; devuelve `buffer` y `contentType`.

### 6.2 Qué dispara cada llamada (diseñado)

| Evento | Llamada |
|---|---|
| Cliente creado/actualizado | `upsertCustomer` |
| Pedido creado | `pushOrder` + `send` |
| Cambio de estado | `pushOrderStatus` + `send` |
| Cliente pide humano | `requestHumanHandoff` |
| Llega un comprobante | `downloadInboundMedia` |
| Pedido entregado | `pushOrderStatus` + `send` |

Nada de esto se ejecuta hoy de punta a punta: falta el worker de outbox que lea `eventos_salida`.

---

## 7. Mapa de la ficha

| Campo ficha | Origen en Zero Delivery | Ejemplo |
|---|---|---|
| `zeroDeliveryCustomerId` | `customers.id` | `9f1c…` |
| `nombreCliente` | `customers.name` | `María López` |
| `segmentoZeroDelivery` | `NEW` / `RECURRING` / `TOP` | `RECURRING` |
| `ultimoPedidoNumero` | `orders.number` con `#` | `#1042` |
| `ultimoPedidoEstado` | Etiqueta `ES_PE.orderStatus[status]` | `En preparación` |
| `ultimoPedidoTotal` | `formatPenCents(totalCents)` | `S/ 48.50` |

> La ficha usa etiquetas en español, no códigos internos. Así el agente de Vocero lee “En camino”, no “ON_THE_WAY”.

### 7.1 Reglas de la ficha

- Solo se envía lo necesario; nunca margen, payout, garantía ni deuda.
- Si el cliente no tiene conversación vinculada, no se envía nada.
- La ficha se actualiza, no se borra.
- Un error al actualizar la ficha no revierte el pedido.

### 7.2 Brecha de datos

Ni `customers` ni `orders` tienen columna para el ID de conversación. Hoy el adaptador recibe `voceroConversationId` como parámetro, pero **no hay dónde guardarlo de forma estable**. Antes de encender la integración hay que agregar la columna (o una tabla de vínculo `cliente ↔ conversación`) y su migración.

---

## 8. Mensajes por evento

Plantillas que el worker encolaría en `eventos_salida`. Ninguna está implementada todavía.

| Evento Zero | Destino | Texto propuesto |
|---|---|---|
| Pedido creado | Cliente | “Recibimos tu pedido #1042 por S/ 48.50. Te avisamos cuando el local lo acepte.” |
| `CONFIRMED` | Cliente | “Tu pedido #1042 fue aceptado y ya está en preparación.” |
| `READY` | Cliente | “Tu pedido #1042 está listo. Estamos asignando repartidor.” |
| `RIDER_ASSIGNED` | Cliente | “Tu pedido #1042 va con Carlos. Llega en aprox. 20 min.” |
| `ON_THE_WAY` | Cliente | “Tu pedido #1042 está en camino.” |
| `DELIVERED` | Cliente | “Pedido #1042 entregado. ¡Gracias!” |
| `DELIVERY_FAILED` | Cliente + staff | “No pudimos entregar #1042. Te contactamos para coordinar.” |
| `CANCELLED` | Cliente | “Tu pedido #1042 fue cancelado. Motivo: …” |
| Pago validado | Cliente | “Confirmamos tu pago de #1042.” |
| Pago rechazado | Cliente | “No pudimos validar tu pago. Envía un nuevo comprobante.” |
| Devolución pendiente | Staff | Alerta interna, no al cliente |

Reglas:

- Nada se envía si el flag está apagado o no hay `voceroConversationId`.
- Un fallo de mensajería **nunca** revierte la transición del pedido: son transacciones separadas vía outbox.
- Los textos no incluyen datos internos (margen, payout, garantía).
- Los mensajes respetan la ventana de 24 h; fuera de ella se usa plantilla o handoff.
- El idioma es español (Perú) y la moneda `S/`.

---

## 9. Handoff a humano

Motivos permitidos y cuándo usarlos:

| Motivo | Cuándo |
|---|---|
| `cliente` | El cliente pide hablar con una persona |
| `modelo` | La IA no entiende o no puede resolver |
| `error` | Falla técnica del flujo |
| `ventana` | Se cerró la ventana de 24 h de WhatsApp |
| `hostilidad` | Lenguaje agresivo o riesgo |

En Zero Delivery, el handoff se dispara desde la ficha del pedido o del cliente (“Pasar a atención humana”). Queda auditado con actor, conversación y motivo.

**Después del handoff:**

- La conversación queda marcada para atención humana en Vocero.
- El Empleado ve el vínculo en la ficha del cliente.
- La IA no debe responder hasta que se resuelva.
- Zero Delivery no controla el estado del handoff; solo lo solicita.

---

## 10. Medios entrantes (comprobantes)

1. El cliente envía la captura por WhatsApp.
2. Vocero la recibe y la expone como `mediaId`.
3. `EventoDespacho` llega con `mediaId`, `mimeType`, `caption`.
4. Zero Delivery llama `GET /api/bot/media/{mediaId}` con `X-API-Key`.
5. Guarda el archivo en almacenamiento propio (`STORAGE_DRIVER=local|s3`).
6. El comprobante queda adjunto al pago en estado `PENDING`.
7. **Un humano** lo valida. Subir la imagen **no** marca el pago como pagado.

El token de WhatsApp nunca participa: Zero solo usa el `mediaId` y la API de Vocero.

**Reglas:**

- Validar tipo MIME y tamaño máximo.
- Guardar con nombre opaco; no confiar en el nombre original.
- No ejecutar OCR como decisión de pago; a lo sumo, sugerencia para el humano.
- El archivo se conserva como evidencia del pago.

---

## 11. Errores, reintentos y cola muerta

Vocero puede responder `409` con motivos tipados:

| Motivo | Significado | Acción en Zero |
|---|---|---|
| `ai_paused` | La IA está pausada en esa conversación | Reintentar más tarde o handoff |
| `window_closed` | Ventana de 24 h cerrada | No reintentar mensaje libre; usar plantilla o marcar para humano |
| `message_limit` | Límite de mensajes alcanzado | Backoff y alerta |
| `sandbox_violation` | Intento de escribir a un número no permitido en sandbox | Error de configuración; alerta crítica |

El adaptador hoy devuelve `errorReason: "VOCERO_HTTP_<status>:<body>"`. El diseño completo:

- `4xx` de negocio → **no** reintentar en bucle; registrar y alertar.
- `5xx` o error de red → reintentar con backoff exponencial.
- Tras el máximo de intentos → estado `MUERTO` en `eventos_salida` y alerta `INTEGRATION_DEAD_LETTER`.
- La UI de integraciones permite **reprocesar** un evento muerto y ver el error.
- Un error saliente no bloquea la operación interna.

### 11.1 Estados de `eventos_salida`

| Estado | Significado |
|---|---|
| `PENDIENTE` | En cola |
| `PROCESANDO` | Tomado por el worker |
| `ENVIADO` | Confirmado |
| `FALLIDO` | Error temporal; se reintenta |
| `MUERTO` | Se agotaron los intentos; requiere intervención |

Campos: `intentos`, `ultimo_error`, `proximo_intento_en`, `procesado_en`, `clave_deduplicacion`.

---

## 12. Seguridad y privacidad

| Invariante | Implementación |
|---|---|
| El token de WhatsApp no sale de Vocero | Zero nunca lo pide ni lo guarda |
| Webhook autenticado | HMAC-SHA256 sobre el cuerpo crudo, comparación en tiempo constante |
| Secreto compartido | `VOCERO_BOT_API_KEY`, mínimo 16 caracteres |
| Endpoint invisible si está apagado | `404`, no `403` |
| Idempotencia | `(proveedor, id_evento_externo)` único |
| Conversaciones de prueba | Se ignoran explícitamente |
| Sin decisiones de dinero por IA | Pagos, precios y reembolsos siempre humanos |
| Minimización | Solo se envían a Vocero los datos necesarios para la ficha |
| Aislamiento | Todo evento se resuelve contra un inquilino |
| Auditable | Cada envío, fallo y handoff queda registrado |

Buenas prácticas adicionales recomendadas:

- Rotar `VOCERO_BOT_API_KEY` con período de transición.
- Rechazar cuerpos mayores a un límite razonable (p. ej. 1 MB) antes de parsear.
- Registrar `dispatchId` y `requestId` en logs, nunca el contenido sensible.
- Verificar que `organization.slug` corresponda al inquilino antes de procesar.
- Guardar el cuerpo crudo solo el tiempo necesario.
- No registrar teléfonos completos en logs de producción.

---

## 13. Pantallas de integración

| Pantalla | Rol | Contenido |
|---|---|---|
| `/dashboard/integrations` | Admin | Estado del flag, URL, última recepción, salud, eventos entrantes y salientes, cola muerta |
| `/dashboard/integrations/vocero` | Admin | Detalle: eventos, payload, error, botón reprocesar |
| `/dashboard/alerts` | Admin, Coord | Alerta `INTEGRATION_DEAD_LETTER` con enlace |
| Detalle de pedido | Admin, Coord, Empleado | Panel “Conversación de origen” con ID y enlace a Vocero, si existe |
| Ficha de cliente | Admin, Coord, Empleado | Conversación vinculada, último mensaje, botón “Pasar a atención humana” |
| Configuración | Admin | Encender/apagar `feature.integration.vocero` |

**Estado:** ninguna de estas pantallas existe hoy.

### 13.1 Diseño de `/dashboard/integrations`

```
┌────────────────────────────────────────────────────────────┐
│ Integración con Vocero CRM                    [ Apagada ]  │
├────────────────────────────────────────────────────────────┤
│ Interruptor:  ( ) Encendida   (•) Apagada                  │
│ URL:          http://localhost:3000                        │
│ API Key:      ••••••••••••  (configurada)                  │
│ Health:       ✔ ok · integración deshabilitada             │
│ Último evento: hace 3 días · dispatch dsp_123 · RECIBIDO   │
├────────────────────────────────────────────────────────────┤
│ Entrantes (eventos_entrada)     Salientes (eventos_salida) │
│ [RECIBIDO] [PROCESADO] [FALLIDO] [IGNORADO]                 │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ dsp_123 · vocero · 26/10 18:05 · RECIBIDO   [Ver]      │ │
│ │ dsp_124 · vocero · 26/10 18:07 · FALLIDO    [Reintentar]│ │
│ └────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│ Cola muerta: 2 eventos · [Ver detalle] [Reprocesar todos]  │
└────────────────────────────────────────────────────────────┘
```

Reglas:

- Encender exige health `ok` y API key configurada; si no, se bloquea con explicación.
- Apagar es inmediato y el webhook pasa a `404`.
- Reprocesar un evento es idempotente: si ya se procesó, no duplica.
- Nunca se muestra la API key completa.

---

## 14. Secuencia completa

```
Cliente      Vocero CRM                 Zero Delivery              Staff
  │              │                          │                       │
  │ "2 combos"   │                          │                       │
  ├─────────────►│                          │                       │
  │              │ EventoDespacho + HMAC    │                       │
  │              ├─────────────────────────►│                       │
  │              │                          │ valida flag + firma    │
  │              │                          │ guarda eventos_entrada │
  │              │                          │ crea pedido NEW        │
  │              │                          │ alerta NEW_ORDER       │
  │              │                          ├──────────────────────►│
  │              │                          │                       │ acepta
  │              │                          │◄──────────────────────┤
  │              │  PUT /api/bot/ficha      │                       │
  │              │◄─────────────────────────┤                       │
  │              │  POST /api/bot/messages  │                       │
  │              │◄─────────────────────────┤                       │
  │ "Aceptado"   │                          │                       │
  │◄─────────────┤                          │                       │
```

---

## 15. Estado real de la integración

| Pieza | Estado |
|---|:-:|
| Contrato Zod `EventoDespacho` | ✅ |
| Firma HMAC y verificación en tiempo constante | ✅ |
| Webhook `POST /api/webhooks/vocero` | 🟡 valida y responde, no persiste |
| Feature flag (entorno + configuración) | ✅ |
| Healthcheck | ✅ |
| Adaptador saliente (`/api/bot/messages`, `/ficha`, `/handoff`, `/media`) | ✅ |
| Modo no-op cuando está apagado | ✅ |
| Tablas `eventos_entrada` / `eventos_salida` | ✅ (esquema) |
| Persistencia de eventos entrantes | ⬜ |
| Worker de outbox | ⬜ |
| Creación de pedidos desde una conversación | ⬜ |
| Descarga y adjunto de comprobantes | ⬜ (método listo, sin flujo) |
| UI de integraciones | ⬜ |
| Campo persistente `vocero_conversation_id` en clientes/pedidos | ⬜ **falta** |
| Plantillas de mensajes | ⬜ |
| Alertas de cola muerta | ⬜ |

**Brecha de datos importante:** ni `clientes` ni `pedidos` tienen columna para el ID de conversación. Hoy el adaptador recibe `voceroConversationId` como parámetro, pero no hay dónde guardarlo de forma estable. Antes de encender la integración hay que agregar la columna (o una tabla de vínculo `cliente ↔ conversación`) y migrar.

---

## 16. Checklist de puesta en marcha

1. Igualar `VOCERO_BOT_API_KEY` en ambos `.env`.
2. Configurar `VOCERO_BASE_URL` y `APP_BASE_URL` accesibles entre sí.
3. Agregar la columna de conversación y la migración.
4. Implementar persistencia en `eventos_entrada` y el worker de outbox.
5. Implementar el mapeo conversación → pedido con reglas de negocio (nunca automático en dinero).
6. Implementar las plantillas y el envío por outbox.
7. Construir la pantalla de integraciones y la alerta de cola muerta.
8. Probar con conversaciones `test: true` (deben ignorarse).
9. Verificar firma inválida → 401 y flag apagado → 404.
10. Recién entonces encender `feature.integration.vocero`.

---

## Referencias

- `src/modules/integrations/domain/vocero-contract.ts` — contrato y firma.
- `src/modules/integrations/infra/vocero-crm.adapter.ts` — llamadas salientes.
- `src/modules/integrations/domain/ports.ts` — `CrmPort` y `NotificationPort`.
- `src/app/api/webhooks/[provider]/route.ts` — recepción.
- `src/app/api/webhooks/vocero/health/route.ts` — healthcheck.
- `src/shared/env.ts` y `.env.example` — variables.
- `docs/engineering/02-casos-de-uso.md` — CU-015.
- [`00-COMUN.md`](./00-COMUN.md) — login, navegación y brechas.
