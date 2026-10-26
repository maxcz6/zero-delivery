-- =============================================================================
-- ZERO DELIVERY — Esquema PostgreSQL EN ESPAÑOL (MVP escalable)
-- Compatible con PostgreSQL 14+
-- =============================================================================
-- Este archivo es una RECREACIÓN EN ESPAÑOL de `0000_initial_zero_delivery.sql`.
-- NO reemplaza ni modifica al original: es un archivo independiente, listo para
-- ejecutarse en una base de datos vacía.
--
-- CONVENCIONES DE TRADUCCIÓN (léelas antes de usar el archivo):
--   * Se tradujeron TABLAS, COLUMNAS, RESTRICCIONES, ÍNDICES, FUNCIONES,
--     DISPARADORES, VISTA y COMENTARIOS al español.
--   * TAMBIÉN se tradujeron los VALORES de dominio (por ejemplo
--     'ACTIVO', 'PENDIENTE', 'EFECTIVO', 'ENTREGADO') y las CLAVES de
--     configuración (por ejemplo 'pedido.minutos_espera_aceptacion').
--     El archivo es 100 % español. Si la aplicación actual todavía espera los
--     valores en inglés, habrá que alinearla: este cambio se hizo únicamente
--     en el código de la base de datos.
--   * `tenant` se traduce como `inquilino` (multi-inquilino).
--   * Los identificadores usan snake_case ASCII: sin tildes, sin mayúsculas
--     y sin espacios, para evitar problemas de compatibilidad.
--   * El dinero sigue siendo bigint en CÉNTIMOS (S/ 12.50 = 1250). Nunca float.
--   * Las fechas siguen en timestamptz (UTC); se muestran en America/Lima.
--   * Los estados se modelan como text + CHECK (más simples de migrar).
--   * Toda tabla de negocio lleva `inquilino_id` (multi-inquilino desde el día 1).
--   * Tablas de SOLO INSERCIÓN (solo se agregan filas): registro_auditoria,
--     historial_estados_pedido, eventos_pago y movimientos_billetera.
--     `eventos_entrada` tiene una excepción documentada: solo permite actualizar
--     estado, procesado_en, error e intentos.
--
-- USO:
--   psql -v ON_ERROR_STOP=1 -f 0001_esquema_zero_delivery_es.sql <base_de_datos>
-- =============================================================================
--
-- DICCIONARIO RÁPIDO DE TABLAS (original -> español)
--   tenant_counters              -> contadores_inquilino
--   tenants                      -> inquilinos
--   users                        -> usuarios
--   sessions                     -> sesiones
--   restaurants                  -> restaurantes
--   branches                     -> sucursales
--   user_branch_access           -> acceso_usuario_sucursal
--   branch_schedules             -> horarios_sucursal
--   delivery_zones               -> zonas_entrega
--   assets                       -> archivos
--   categories                   -> categorias
--   products                     -> productos
--   modifier_groups              -> grupos_modificadores
--   modifier_options             -> opciones_modificador
--   product_modifier_groups      -> productos_grupos_modificadores
--   menus                        -> cartas
--   menu_items                   -> items_carta
--   customers                    -> clientes
--   customer_addresses           -> direcciones_cliente
--   riders                       -> repartidores
--   orders                       -> pedidos
--   order_items                  -> detalle_pedido
--   order_item_modifiers         -> modificadores_detalle_pedido
--   order_status_history         -> historial_estados_pedido
--   order_notes                  -> notas_pedido
--   order_incidents              -> incidencias_pedido
--   delivery_attempts            -> intentos_entrega
--   rider_location_pings         -> ubicaciones_repartidor
--   payments                     -> pagos
--   payment_events               -> eventos_pago
--   restaurant_payouts           -> pagos_restaurante
--   refunds                      -> reembolsos
--   settlements                  -> liquidaciones
--   rider_advances               -> adelantos_repartidor
--   wallet_entries               -> movimientos_billetera
--   ratings                      -> calificaciones
--   alerts                       -> alertas
--   settings                     -> configuraciones
--   audit_logs                   -> registro_auditoria
--   outbox_events                -> eventos_salida
--   inbound_events               -> eventos_entrada
--   funnel_events                -> eventos_embudo
--   promotions                   -> promociones
--   promotion_rules              -> reglas_promocion
--   push_subscriptions           -> suscripciones_push
-- =============================================================================

BEGIN;

-- Extensión necesaria para búsquedas difusas por nombre (índices GIN + trigramas).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- -----------------------------------------------------------------------------
-- 0. FUNCIONES AUXILIARES
-- -----------------------------------------------------------------------------

-- Actualiza automáticamente la columna `actualizado_en` en cada UPDATE.
-- Se instala más abajo, mediante un bloque DO, en toda tabla que tenga esa columna.
CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion() RETURNS trigger AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Bloquea UPDATE y DELETE sobre las tablas de solo inserción.
-- Se usa tanto en triggers de fila como de sentencia (TRUNCATE).
CREATE OR REPLACE FUNCTION prohibir_mutacion() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'La tabla % es de solo-inserción: % no permitido', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'restrict_violation';
END $$ LANGUAGE plpgsql;

-- Guardia especial para `eventos_entrada` (webhooks entrantes):
--   * No permite DELETE.
--   * Permite UPDATE únicamente de estado, procesado_en, error e intentos.
--   * El resto de columnas (id, proveedor, id_evento_externo, datos, recibido_en)
--     son inmutables una vez registrado el evento.
CREATE OR REPLACE FUNCTION guardia_eventos_entrada() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'eventos_entrada no permite DELETE' USING ERRCODE = 'restrict_violation';
  END IF;
  IF (NEW.id, NEW.proveedor, NEW.id_evento_externo, NEW.datos, NEW.recibido_en)
     IS DISTINCT FROM
     (OLD.id, OLD.proveedor, OLD.id_evento_externo, OLD.datos, OLD.recibido_en) THEN
    RAISE EXCEPTION 'eventos_entrada: solo estado/procesado_en/error/intentos son modificables'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Contadores por inquilino. Se usan, por ejemplo, para generar el número de
-- pedido legible y secuencial (1, 2, 3, ...) sin colisiones entre inquilinos.
CREATE TABLE contadores_inquilino (
  inquilino_id  uuid NOT NULL,
  nombre        text NOT NULL,
  valor         bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (inquilino_id, nombre)
);

-- Incrementa y devuelve el contador indicado dentro del inquilino.
-- Es atómico: la cláusula ON CONFLICT evita condiciones de carrera.
CREATE OR REPLACE FUNCTION siguiente_contador(p_inquilino uuid, p_nombre text) RETURNS bigint AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO contadores_inquilino (inquilino_id, nombre, valor)
  VALUES (p_inquilino, p_nombre, 1)
  ON CONFLICT (inquilino_id, nombre)
  DO UPDATE SET valor = contadores_inquilino.valor + 1
  RETURNING valor INTO v;
  RETURN v;
END $$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 1. IDENTIDAD Y ESTRUCTURA
-- -----------------------------------------------------------------------------

-- Inquilinos (tenants) de la plataforma. Cada restaurante/cliente SaaS vive aquí.
CREATE TABLE inquilinos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        text NOT NULL,
  slug          text NOT NULL UNIQUE,   -- identificador legible para URLs
  estado        text NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO','SUSPENDIDO')),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- La FK se agrega después porque `contadores_inquilino` se creó antes.
ALTER TABLE contadores_inquilino
  ADD CONSTRAINT contadores_inquilino_inquilino_fk
  FOREIGN KEY (inquilino_id) REFERENCES inquilinos(id);

-- Usuarios internos (Admin, Coordinador, Encargado de sucursal, Soporte, Repartidor).
-- El login es por `nombre_usuario`, único dentro de cada inquilino.
CREATE TABLE usuarios (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id        uuid NOT NULL REFERENCES inquilinos(id),
  nombre_usuario      text NOT NULL,
  hash_contrasena     text NOT NULL,                        -- argon2id
  nombre_mostrado     text NOT NULL,
  rol                 text NOT NULL CHECK (rol IN ('ADMINISTRADOR','COORDINADOR','ENCARGADO_SUCURSAL','AGENTE_SOPORTE','REPARTIDOR')),
  esta_activo         boolean NOT NULL DEFAULT true,
  intentos_fallidos   integer NOT NULL DEFAULT 0,           -- para bloqueo temporal por fuerza bruta
  bloqueado_hasta     timestamptz,
  ultimo_acceso_en    timestamptz,
  creado_en           timestamptz NOT NULL DEFAULT now(),
  actualizado_en      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuarios_nombre_usuario_uq ON usuarios (inquilino_id, lower(nombre_usuario));
CREATE INDEX usuarios_inquilino_rol_idx ON usuarios (inquilino_id, rol);

-- Sesiones activas. Se guarda el HASH del token de la cookie, nunca el token plano.
CREATE TABLE sesiones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  hash_token    text NOT NULL UNIQUE,
  expira_en     timestamptz NOT NULL,
  revocado_en   timestamptz,
  ip            inet,
  agente_usuario text,
  creado_en     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sesiones_usuario_idx ON sesiones (usuario_id);
CREATE INDEX sesiones_expira_idx ON sesiones (expira_en);

-- Restaurantes (marcas) que operan dentro de un inquilino.
CREATE TABLE restaurantes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id  uuid NOT NULL REFERENCES inquilinos(id),
  nombre        text NOT NULL,
  razon_social  text,
  ruc           text CHECK (ruc IS NULL OR ruc ~ '^[0-9]{11}$'),   -- RUC peruano: 11 dígitos
  esta_activo   boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurantes_inquilino_idx ON restaurantes (inquilino_id);

-- Sucursales físicas de un restaurante. Cada sucursal tiene su propia carta,
-- zonas de entrega, horarios y usuarios con acceso.
CREATE TABLE sucursales (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id     uuid NOT NULL REFERENCES inquilinos(id),
  restaurante_id   uuid NOT NULL REFERENCES restaurantes(id),
  nombre           text NOT NULL,
  slug             text NOT NULL,
  direccion        text NOT NULL,
  latitud          numeric(9,6) CHECK (latitud BETWEEN -90 AND 90),
  longitud         numeric(9,6) CHECK (longitud BETWEEN -180 AND 180),
  telefono         text,
  apertura_manual  boolean NOT NULL DEFAULT true,   -- cierre/apertura temporal por el Coordinador
  esta_activo      boolean NOT NULL DEFAULT true,
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inquilino_id, slug)                       -- el slug es único por inquilino
);
CREATE INDEX sucursales_restaurante_idx ON sucursales (restaurante_id);

-- Relación N:M: qué usuarios pueden operar en qué sucursales.
CREATE TABLE acceso_usuario_sucursal (
  usuario_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  sucursal_id  uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, sucursal_id)
);

-- Horarios de atención por sucursal. Puede haber varios turnos por día.
-- `cierra_a` puede ser menor que `abre_a` cuando el turno cruza medianoche.
CREATE TABLE horarios_sucursal (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id   uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  dia_semana    smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),   -- 0 = domingo
  numero_turno  smallint NOT NULL DEFAULT 1 CHECK (numero_turno >= 1),
  abre_a        time NOT NULL,
  cierra_a      time NOT NULL,
  UNIQUE (sucursal_id, dia_semana, numero_turno)
);

-- Zonas de entrega por sucursal, con tarifa y pedido mínimo.
-- `radio_km` queda preparado para una futura validación geográfica.
CREATE TABLE zonas_entrega (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id          uuid NOT NULL REFERENCES inquilinos(id),
  sucursal_id           uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre                text NOT NULL,
  tarifa_centavos       bigint NOT NULL DEFAULT 0 CHECK (tarifa_centavos >= 0),
  pedido_minimo_centavos bigint NOT NULL DEFAULT 0 CHECK (pedido_minimo_centavos >= 0),
  radio_km              numeric(6,2) CHECK (radio_km IS NULL OR radio_km > 0),
  esta_activo           boolean NOT NULL DEFAULT true,
  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sucursal_id, nombre)
);

-- Archivos subidos (imágenes de productos, comprobantes de pago, evidencias, etc.).
-- `clave_almacenamiento` apunta al objeto en el almacenamiento externo.
CREATE TABLE archivos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id        uuid NOT NULL REFERENCES inquilinos(id),
  clave_almacenamiento text NOT NULL,
  tipo_mime           text NOT NULL,
  tamano_bytes        bigint NOT NULL CHECK (tamano_bytes >= 0),
  subido_por          uuid REFERENCES usuarios(id),
  creado_en           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX archivos_inquilino_idx ON archivos (inquilino_id);

-- -----------------------------------------------------------------------------
-- 2. CATÁLOGO
-- -----------------------------------------------------------------------------

-- Categorías de productos de un restaurante (ej. Entradas, Platos de fondo).
CREATE TABLE categorias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id    uuid NOT NULL REFERENCES inquilinos(id),
  restaurante_id  uuid NOT NULL REFERENCES restaurantes(id),
  nombre          text NOT NULL,
  orden           integer NOT NULL DEFAULT 0,   -- orden de despliegue en la carta
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurante_id, nombre)
);

-- Productos del catálogo maestro del restaurante.
-- Los precios se guardan en céntimos. El margen de Zero Delivery es PROVISIONAL
-- (ver DECISION-01): FIJO usa `valor_margen` en céntimos; PORCENTAJE usa porcentaje.
CREATE TABLE productos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id          uuid NOT NULL REFERENCES inquilinos(id),
  restaurante_id        uuid NOT NULL REFERENCES restaurantes(id),
  categoria_id          uuid REFERENCES categorias(id),
  nombre                text NOT NULL,
  descripcion           text,
  archivo_imagen_id     uuid REFERENCES archivos(id),
  es_fragil             boolean NOT NULL DEFAULT false,   -- ej. tortas: requiere cuidado
  precio_base_centavos  bigint NOT NULL CHECK (precio_base_centavos >= 0),
  empaque_centavos      bigint NOT NULL DEFAULT 0 CHECK (empaque_centavos >= 0),
  tipo_margen           text NOT NULL DEFAULT 'FIJO' CHECK (tipo_margen IN ('FIJO','PORCENTAJE')),
  valor_margen          numeric(12,4) NOT NULL DEFAULT 0 CHECK (valor_margen >= 0),
  esta_activo           boolean NOT NULL DEFAULT true,
  archivado_en          timestamptz,   -- nunca se borra un producto con historial
  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX productos_restaurante_idx ON productos (restaurante_id) WHERE archivado_en IS NULL;
CREATE INDEX productos_nombre_trgm_idx ON productos USING gin (nombre gin_trgm_ops);

-- Grupos de modificadores (ej. "Punto de la carne", "Extras").
-- `minimo_seleccion` y `maximo_seleccion` definen cuántas opciones se deben elegir.
CREATE TABLE grupos_modificadores (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id     uuid NOT NULL REFERENCES inquilinos(id),
  restaurante_id   uuid NOT NULL REFERENCES restaurantes(id),
  nombre           text NOT NULL,
  minimo_seleccion smallint NOT NULL DEFAULT 0 CHECK (minimo_seleccion >= 0),
  maximo_seleccion smallint NOT NULL DEFAULT 1 CHECK (maximo_seleccion >= 1),
  creado_en        timestamptz NOT NULL DEFAULT now(),
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  CHECK (maximo_seleccion >= minimo_seleccion)
);

-- Opciones concretas dentro de un grupo de modificadores.
-- `incremento_precio_centavos` puede ser negativo (ej. "sin queso": -200).
CREATE TABLE opciones_modificador (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id                 uuid NOT NULL REFERENCES grupos_modificadores(id) ON DELETE CASCADE,
  nombre                   text NOT NULL,
  incremento_precio_centavos bigint NOT NULL DEFAULT 0,
  esta_activo              boolean NOT NULL DEFAULT true,
  orden                    integer NOT NULL DEFAULT 0
);
CREATE INDEX opciones_modificador_grupo_idx ON opciones_modificador (grupo_id);

-- Relación N:M entre productos y grupos de modificadores aplicables.
CREATE TABLE productos_grupos_modificadores (
  producto_id  uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  grupo_id     uuid NOT NULL REFERENCES grupos_modificadores(id) ON DELETE CASCADE,
  PRIMARY KEY (producto_id, grupo_id)
);

-- Cartas (menús) por sucursal. Una sucursal puede tener varias cartas, pero
-- solo una puede ser la predeterminada (`es_predeterminada = true`).
-- Las banderas `incluye_*_en_precio` permiten expresar precios "todo incluido".
CREATE TABLE cartas (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id                   uuid NOT NULL REFERENCES inquilinos(id),
  sucursal_id                    uuid NOT NULL REFERENCES sucursales(id) ON DELETE CASCADE,
  nombre                         text NOT NULL,
  es_predeterminada              boolean NOT NULL DEFAULT false,
  incluye_entrega_en_precio      boolean NOT NULL DEFAULT false,
  incluye_impuesto_en_precio     boolean NOT NULL DEFAULT false,
  horario                        jsonb,   -- vigencia opcional de la carta (días/horas)
  esta_activa                    boolean NOT NULL DEFAULT true,
  creado_en                      timestamptz NOT NULL DEFAULT now(),
  actualizado_en                 timestamptz NOT NULL DEFAULT now()
);
-- Garantiza una sola carta predeterminada por sucursal.
CREATE UNIQUE INDEX cartas_una_predeterminada_por_sucursal
  ON cartas (sucursal_id) WHERE es_predeterminada;

-- Ítems publicados en una carta: producto + precio mostrado al cliente.
-- Un mismo producto puede estar en varias cartas con distinto precio.
CREATE TABLE items_carta (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carta_id         uuid NOT NULL REFERENCES cartas(id) ON DELETE CASCADE,
  producto_id      uuid NOT NULL REFERENCES productos(id),
  precio_centavos  bigint NOT NULL CHECK (precio_centavos >= 0),
  esta_disponible  boolean NOT NULL DEFAULT true,   -- disponibilidad por sucursal/carta
  orden            integer NOT NULL DEFAULT 0,
  UNIQUE (carta_id, producto_id)
);
CREATE INDEX items_carta_producto_idx ON items_carta (producto_id);

-- -----------------------------------------------------------------------------
-- 3. CLIENTES
-- -----------------------------------------------------------------------------

-- Clientes finales. Se deduplican por teléfono dentro de cada inquilino.
-- `segmento` permite clasificar en NUEVO, RECURRENTE o TOP.
-- El filtro de seguridad (`marca_riesgo`) es SOLO manual y exige motivo y
-- responsable; no se recopilan datos externos.
CREATE TABLE clientes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id          uuid NOT NULL REFERENCES inquilinos(id),
  nombre                text NOT NULL,
  telefono_e164         text NOT NULL CHECK (telefono_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  correo                text,
  segmento              text NOT NULL DEFAULT 'NUEVO' CHECK (segmento IN ('NUEVO','RECURRENTE','TOP')),
  marca_riesgo          text NOT NULL DEFAULT 'NINGUNO' CHECK (marca_riesgo IN ('NINGUNO','PRECAUCION','BLOQUEADO')),
  motivo_riesgo         text,
  riesgo_definido_por   uuid REFERENCES usuarios(id),
  riesgo_definido_en    timestamptz,
  notas                 text,
  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now(),
  -- No puede haber marca de riesgo sin motivo ni responsable.
  CHECK (marca_riesgo = 'NINGUNO' OR (motivo_riesgo IS NOT NULL AND riesgo_definido_por IS NOT NULL)),
  UNIQUE (inquilino_id, telefono_e164)
);
CREATE INDEX clientes_nombre_trgm_idx ON clientes USING gin (nombre gin_trgm_ops);

-- Direcciones guardadas del cliente. `zona_id` permite asociar una zona de entrega.
CREATE TABLE direcciones_cliente (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  etiqueta        text,          -- ej. Casa, Oficina
  texto_direccion text NOT NULL,
  referencia      text,          -- ej. "frente al parque"
  latitud         numeric(9,6) CHECK (latitud BETWEEN -90 AND 90),
  longitud        numeric(9,6) CHECK (longitud BETWEEN -180 AND 180),
  zona_id         uuid REFERENCES zonas_entrega(id),
  creado_en       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX direcciones_cliente_cliente_idx ON direcciones_cliente (cliente_id);

-- -----------------------------------------------------------------------------
-- 4. REPARTIDORES
-- -----------------------------------------------------------------------------

-- Repartidores. Pueden ser propios, de agencia o de terceros.
-- `alta_confianza` es una marca manual (Admin/Coordinador).
-- `puntaje_confianza` queda preparado para una futura extensión.
CREATE TABLE repartidores (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id      uuid NOT NULL REFERENCES inquilinos(id),
  usuario_id        uuid UNIQUE REFERENCES usuarios(id),
  nombre_completo   text NOT NULL,
  telefono          text NOT NULL,
  fecha_nacimiento  date NOT NULL,
  tipo_flota        text NOT NULL CHECK (tipo_flota IN ('PROPIO','AGENCIA','TERCERO')),
  nombre_agencia    text,          -- ej. Turbo Delivery, Wanka Flash
  tipo_vehiculo     text NOT NULL CHECK (tipo_vehiculo IN ('MOTO','AUTO')),
  estado            text NOT NULL DEFAULT 'DESCONECTADO'
                    CHECK (estado IN ('DISPONIBLE','OCUPADO','EN_CAMINO','DESCONECTADO')),
  alta_confianza    boolean NOT NULL DEFAULT false,
  puntaje_confianza numeric(5,2)
                    CHECK (puntaje_confianza IS NULL OR puntaje_confianza BETWEEN 0 AND 100),
  esta_activo       boolean NOT NULL DEFAULT true,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX repartidores_inquilino_estado_idx ON repartidores (inquilino_id, estado) WHERE esta_activo;

-- -----------------------------------------------------------------------------
-- 5. PEDIDOS
-- -----------------------------------------------------------------------------

-- Pedido: entidad central del negocio.
-- Tiene tres ejes de estado INDEPENDIENTES:
--   1) estado_operativo          -> avance logístico del pedido
--   2) estado_pago               -> cobro al cliente
--   3) estado_pago_restaurante   -> pago/liquidación al restaurante antes del despacho
-- `traspaso_en` es la entrega física del pedido al repartidor.
-- `numero` es secuencial por inquilino y lo asigna un disparador.
CREATE TABLE pedidos (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id                    uuid NOT NULL REFERENCES inquilinos(id),
  numero                          bigint NOT NULL,   -- legible y secuencial por inquilino
  sucursal_id                     uuid NOT NULL REFERENCES sucursales(id),
  cliente_id                      uuid NOT NULL REFERENCES clientes(id),
  direccion_snapshot              jsonb NOT NULL,    -- dirección tal como se entregó
  canal                           text NOT NULL DEFAULT 'MANUAL'
                                  CHECK (canal IN ('MANUAL','WEB','WHATSAPP','CRM')),

  -- Eje 1: estado operativo / logístico
  estado_operativo                text NOT NULL DEFAULT 'NUEVO' CHECK (estado_operativo IN (
                                    'NUEVO','CONFIRMADO','EN_PREPARACION','LISTO','REPARTIDOR_ASIGNADO','REPARTIDOR_EN_RECOJO',
                                    'EN_CAMINO','ENTREGADO','RECHAZADO','CANCELACION_SOLICITADA','CANCELADO',
                                    'ENTREGA_FALLIDA','DEVOLUCION_PENDIENTE','DEVUELTO_A_RESTAURANTE','PENDIENTE_RESOLUCION')),
  -- Eje 2: estado del pago al cliente
  estado_pago                     text NOT NULL DEFAULT 'PENDIENTE'
                                  CHECK (estado_pago IN ('PENDIENTE','PAGADO','RECHAZADO','REEMBOLSADO')),
  metodo_pago                     text NOT NULL CHECK (metodo_pago IN ('EFECTIVO','YAPE','TRANSFERENCIA_BANCARIA')),
  -- Eje 3: pago al restaurante antes del despacho
  estado_pago_restaurante         text NOT NULL DEFAULT 'PENDIENTE'
                                  CHECK (estado_pago_restaurante IN ('PENDIENTE','CONFIRMADO')),

  -- Liberación / despacho
  traspaso_en                     timestamptz,   -- entrega física al repartidor (Encargado)
  traspaso_por                    uuid REFERENCES usuarios(id),
  liberado_en                     timestamptz,
  liberado_por                    uuid REFERENCES usuarios(id),

  repartidor_id                   uuid REFERENCES repartidores(id),
  zona_entrega_id                 uuid REFERENCES zonas_entrega(id),
  cantidad_intentos               smallint NOT NULL DEFAULT 0 CHECK (cantidad_intentos >= 0),
  estado_previo_solicitud_cancelacion text,   -- para revertir una solicitud denegada
  resolucion                      text,       -- cierre de PENDIENTE_RESOLUCION (valores a definir)

  -- Importes en céntimos. El precio unitario de cada ítem YA incluye modificadores.
  subtotal_items_centavos         bigint NOT NULL CHECK (subtotal_items_centavos >= 0),
  descuento_centavos              bigint NOT NULL DEFAULT 0 CHECK (descuento_centavos >= 0),
  tarifa_entrega_centavos         bigint NOT NULL DEFAULT 0 CHECK (tarifa_entrega_centavos >= 0),
  impuesto_centavos               bigint NOT NULL DEFAULT 0 CHECK (impuesto_centavos >= 0),   -- MVP = 0
  total_centavos                  bigint NOT NULL CHECK (total_centavos >= 0),
  efectivo_por_cobrar_centavos    bigint NOT NULL DEFAULT 0 CHECK (efectivo_por_cobrar_centavos >= 0),
  factura_solicitada              boolean NOT NULL DEFAULT false,

  token_publico                   text NOT NULL UNIQUE
                                  DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  clave_idempotencia              text,
  notas                           text,
  version                         integer NOT NULL DEFAULT 1,   -- bloqueo optimista
  creado_por                      uuid REFERENCES usuarios(id),  -- NULL si vino de invitado/canal
  creado_en                       timestamptz NOT NULL DEFAULT now(),
  actualizado_en                  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (inquilino_id, numero),

  -- Invariante de importes: el total siempre cuadra con sus componentes.
  CONSTRAINT pedidos_total_chk CHECK (
    total_centavos = subtotal_items_centavos - descuento_centavos
                     + tarifa_entrega_centavos + impuesto_centavos
  ),
  -- El efectivo a cobrar nunca supera el total y solo aplica a pagos en efectivo.
  CONSTRAINT pedidos_efectivo_chk CHECK (
    efectivo_por_cobrar_centavos <= total_centavos
    AND (metodo_pago = 'EFECTIVO' OR efectivo_por_cobrar_centavos = 0)
  ),
  -- Regla reforzada en BD: no hay traspaso al repartidor sin pago confirmado
  -- al restaurante.
  CONSTRAINT pedidos_traspaso_requiere_pago_chk CHECK (
    traspaso_en IS NULL OR estado_pago_restaurante = 'CONFIRMADO'
  ),
  -- No se puede estar "en camino" o "entregado" sin traspaso, sin repartidor y,
  -- si el pago es anticipado, sin pago validado.
  CONSTRAINT pedidos_control_despacho_chk CHECK (
    estado_operativo NOT IN ('EN_CAMINO','ENTREGADO')
    OR (traspaso_en IS NOT NULL
        AND repartidor_id IS NOT NULL
        AND (metodo_pago = 'EFECTIVO' OR estado_pago IN ('PAGADO','REEMBOLSADO')))
  )
);
-- Idempotencia: evita duplicar pedidos si la app reintenta la creación.
CREATE UNIQUE INDEX pedidos_idempotencia_uq
  ON pedidos (inquilino_id, clave_idempotencia)
  WHERE clave_idempotencia IS NOT NULL;
CREATE INDEX pedidos_sucursal_estado_idx
  ON pedidos (inquilino_id, sucursal_id, estado_operativo, creado_en DESC);
CREATE INDEX pedidos_estado_creado_idx
  ON pedidos (inquilino_id, estado_operativo, creado_en DESC);
CREATE INDEX pedidos_cliente_idx ON pedidos (cliente_id, creado_en DESC);
CREATE INDEX pedidos_repartidor_idx ON pedidos (repartidor_id) WHERE repartidor_id IS NOT NULL;
CREATE INDEX pedidos_creado_idx ON pedidos (inquilino_id, creado_en DESC);
-- Pedidos pendientes de pago que NO son en efectivo (para conciliación).
CREATE INDEX pedidos_pago_pendiente_idx
  ON pedidos (inquilino_id)
  WHERE estado_pago = 'PENDIENTE' AND metodo_pago <> 'EFECTIVO';

-- Asigna el número secuencial por inquilino al insertar y aumenta la versión
-- en cada UPDATE (bloqueo optimista).
-- `numero` es NOT NULL: la app inserta 0 y el disparador lo reemplaza.
CREATE OR REPLACE FUNCTION pedidos_antes_escribir() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.numero IS NULL OR NEW.numero = 0 THEN
      NEW.numero := siguiente_contador(NEW.inquilino_id, 'numero_pedido');
    END IF;
  ELSE
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Uso desde la app: INSERT INTO pedidos (numero, ...) VALUES (0, ...)
CREATE TRIGGER pedidos_antes_escribir_trg
  BEFORE INSERT OR UPDATE ON pedidos
  FOR EACH ROW EXECUTE FUNCTION pedidos_antes_escribir();

-- Detalle del pedido. Guarda una "foto" del nombre y del desglose interno de
-- precios, para que cambios posteriores del catálogo no alteren el historial.
-- El desglose interno (base, empaque, margen) NUNCA se expone al cliente.
CREATE TABLE detalle_pedido (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id                uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id              uuid NOT NULL REFERENCES productos(id),
  nombre_snapshot          text NOT NULL,
  cantidad                 integer NOT NULL CHECK (cantidad > 0),
  precio_base_centavos     bigint NOT NULL CHECK (precio_base_centavos >= 0),
  empaque_centavos         bigint NOT NULL DEFAULT 0 CHECK (empaque_centavos >= 0),
  margen_centavos          bigint NOT NULL DEFAULT 0 CHECK (margen_centavos >= 0),   -- PROVISIONAL
  precio_unitario_centavos bigint NOT NULL CHECK (precio_unitario_centavos >= 0),    -- incluye modificadores
  total_linea_centavos     bigint NOT NULL CHECK (total_linea_centavos >= 0),
  estado                   text NOT NULL DEFAULT 'ACTIVO'
                           CHECK (estado IN ('ACTIVO','NO_DISPONIBLE','REEMPLAZADO','CANCELADO')),
  motivo_no_disponible     text,
  reemplazo_de_item_id     uuid REFERENCES detalle_pedido(id),   -- si este ítem reemplaza a otro
  decision_cliente         text CHECK (decision_cliente IN ('REEMPLAZO_ACEPTADO','ITEM_CANCELADO')),
  decision_cliente_en      timestamptz,
  creado_en                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT detalle_pedido_linea_chk CHECK (
    total_linea_centavos = cantidad * precio_unitario_centavos
  )
);
CREATE INDEX detalle_pedido_pedido_idx ON detalle_pedido (pedido_id);
CREATE INDEX detalle_pedido_producto_idx ON detalle_pedido (producto_id);

-- Modificadores aplicados a una línea del pedido (snapshot de nombre y precio).
CREATE TABLE modificadores_detalle_pedido (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detalle_pedido_id        uuid NOT NULL REFERENCES detalle_pedido(id) ON DELETE CASCADE,
  nombre_snapshot          text NOT NULL,
  incremento_precio_centavos bigint NOT NULL DEFAULT 0
);
CREATE INDEX modificadores_detalle_pedido_item_idx
  ON modificadores_detalle_pedido (detalle_pedido_id);

-- Historial de cambios de estado del pedido. SOLO INSERCIÓN.
-- `actor_id` NULL significa que el cambio lo hizo el sistema.
CREATE TABLE historial_estados_pedido (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id    uuid NOT NULL REFERENCES inquilinos(id),
  pedido_id       uuid NOT NULL REFERENCES pedidos(id),
  estado_anterior text,
  estado_nuevo    text NOT NULL,
  actor_id        uuid REFERENCES usuarios(id),
  rol_actor       text,
  motivo          text,
  creado_en       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX historial_estados_pedido_pedido_idx
  ON historial_estados_pedido (pedido_id, creado_en);

-- Notas internas del pedido (observaciones, incidencias, mensajes del sistema).
CREATE TABLE notas_pedido (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   uuid NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  autor_id    uuid REFERENCES usuarios(id),
  tipo        text NOT NULL DEFAULT 'NOTA' CHECK (tipo IN ('NOTA','INCIDENCIA','SISTEMA')),
  contenido   text NOT NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notas_pedido_pedido_idx ON notas_pedido (pedido_id, creado_en);

-- Incidencias del pedido, incluidas pérdidas económicas.
-- Una incidencia no puede cerrarse como DECIDIDA/CERRADA sin decisión, justificación
-- y revisor. Así se evita cargar pérdidas sin respaldo.
CREATE TABLE incidencias_pedido (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id           uuid NOT NULL REFERENCES inquilinos(id),
  pedido_id              uuid NOT NULL REFERENCES pedidos(id),
  tipo                   text NOT NULL,
  descripcion            text NOT NULL,
  ids_archivos_evidencia uuid[] NOT NULL DEFAULT '{}',
  revisor_id             uuid REFERENCES usuarios(id),
  decision               text,
  monto_centavos         bigint CHECK (monto_centavos IS NULL OR monto_centavos >= 0),
  justificacion          text,
  estado                 text NOT NULL DEFAULT 'ABIERTA'
                         CHECK (estado IN ('ABIERTA','EN_REVISION','DECIDIDA','CERRADA')),
  creado_por             uuid REFERENCES usuarios(id),
  creado_en              timestamptz NOT NULL DEFAULT now(),
  actualizado_en         timestamptz NOT NULL DEFAULT now(),
  CHECK (estado NOT IN ('DECIDIDA','CERRADA')
         OR (decision IS NOT NULL AND justificacion IS NOT NULL AND revisor_id IS NOT NULL))
);
CREATE INDEX incidencias_pedido_pedido_idx ON incidencias_pedido (pedido_id);

-- Intentos de entrega. Un pedido puede tener varios intentos (máximo configurable).
-- `autorizado_por` es obligatorio en el segundo intento (lo valida la app).
CREATE TABLE intentos_entrega (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id            uuid NOT NULL REFERENCES inquilinos(id),
  pedido_id               uuid NOT NULL REFERENCES pedidos(id),
  numero_intento          smallint NOT NULL CHECK (numero_intento >= 1),
  repartidor_id           uuid NOT NULL REFERENCES repartidores(id),
  resultado               text NOT NULL DEFAULT 'EN_PROGRESO'
                          CHECK (resultado IN ('EN_PROGRESO','ENTREGADO','FALLIDO')),
  motivo_fallo            text,
  notas                   text,
  archivo_evidencia_id    uuid REFERENCES archivos(id),   -- foto opcional
  efectivo_cobrado_centavos bigint
                          CHECK (efectivo_cobrado_centavos IS NULL OR efectivo_cobrado_centavos >= 0),
  autorizado_por          uuid REFERENCES usuarios(id),
  iniciado_en             timestamptz NOT NULL DEFAULT now(),
  finalizado_en           timestamptz,
  UNIQUE (pedido_id, numero_intento),
  CHECK (resultado <> 'FALLIDO' OR motivo_fallo IS NOT NULL)
);
CREATE INDEX intentos_entrega_repartidor_idx
  ON intentos_entrega (repartidor_id, iniciado_en DESC);

-- Posiciones GPS del repartidor, asociadas opcionalmente a un pedido.
CREATE TABLE ubicaciones_repartidor (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repartidor_id uuid NOT NULL REFERENCES repartidores(id) ON DELETE CASCADE,
  pedido_id   uuid REFERENCES pedidos(id),
  latitud     numeric(9,6) NOT NULL CHECK (latitud BETWEEN -90 AND 90),
  longitud    numeric(9,6) NOT NULL CHECK (longitud BETWEEN -180 AND 180),
  precision_m numeric(8,2),
  creado_en   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ubicaciones_repartidor_idx
  ON ubicaciones_repartidor (repartidor_id, creado_en DESC);

-- -----------------------------------------------------------------------------
-- 6. PAGOS
-- -----------------------------------------------------------------------------

-- Pagos recibidos del cliente. Un comprobante subido NO equivale a pago válido:
-- para marcar PAGADO/REEMBOLSADO se exige validador y fecha de validación.
CREATE TABLE pagos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id          uuid NOT NULL REFERENCES inquilinos(id),
  pedido_id             uuid NOT NULL REFERENCES pedidos(id),
  metodo                text NOT NULL CHECK (metodo IN ('EFECTIVO','YAPE','TRANSFERENCIA_BANCARIA')),
  monto_centavos        bigint NOT NULL CHECK (monto_centavos > 0),
  estado                text NOT NULL DEFAULT 'PENDIENTE'
                        CHECK (estado IN ('PENDIENTE','PAGADO','RECHAZADO','REEMBOLSADO')),
  archivo_comprobante_id uuid REFERENCES archivos(id),
  referencia            text,          -- número de operación del medio de pago
  validado_por          uuid REFERENCES usuarios(id),
  validado_en           timestamptz,
  creado_en             timestamptz NOT NULL DEFAULT now(),
  actualizado_en        timestamptz NOT NULL DEFAULT now(),
  CHECK (estado NOT IN ('PAGADO','REEMBOLSADO')
         OR (validado_por IS NOT NULL AND validado_en IS NOT NULL))
);
CREATE INDEX pagos_pedido_idx ON pagos (pedido_id);
CREATE INDEX pagos_estado_idx ON pagos (inquilino_id, estado);

-- Bitácora de eventos de pago. SOLO INSERCIÓN.
-- Corregir un pago exige motivo y los valores anterior/nuevo.
CREATE TABLE eventos_pago (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id  uuid NOT NULL REFERENCES inquilinos(id),
  pago_id       uuid NOT NULL REFERENCES pagos(id),
  tipo          text NOT NULL
                CHECK (tipo IN ('CREADO','VALIDADO','RECHAZADO','CORREGIDO','REEMBOLSADO')),
  antes         jsonb,
  despues       jsonb,
  motivo        text,
  actor_id      uuid REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CHECK (tipo <> 'CORREGIDO'
         OR (motivo IS NOT NULL AND antes IS NOT NULL AND despues IS NOT NULL))
);
CREATE INDEX eventos_pago_pago_idx ON eventos_pago (pago_id, creado_en);

-- Pago/liquidación al restaurante, previo al despacho del pedido.
-- Un pedido tiene como máximo un registro de este tipo (UNIQUE en pedido_id).
CREATE TABLE pagos_restaurante (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id    uuid NOT NULL REFERENCES inquilinos(id),
  pedido_id       uuid NOT NULL UNIQUE REFERENCES pedidos(id),
  monto_centavos  bigint NOT NULL CHECK (monto_centavos >= 0),
  estado          text NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','CONFIRMADO')),
  metodo          text,
  referencia      text,
  confirmado_por  uuid REFERENCES usuarios(id),
  confirmado_en   timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  CHECK (estado <> 'CONFIRMADO'
         OR (confirmado_por IS NOT NULL AND confirmado_en IS NOT NULL))
);

-- Reembolsos manuales (no hay API de reembolso automática).
-- Siempre requieren autorización humana.
CREATE TABLE reembolsos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id     uuid NOT NULL REFERENCES inquilinos(id),
  pedido_id        uuid NOT NULL REFERENCES pedidos(id),
  pago_id          uuid REFERENCES pagos(id),
  monto_centavos   bigint NOT NULL CHECK (monto_centavos > 0),
  motivo           text NOT NULL,
  autorizado_por   uuid NOT NULL REFERENCES usuarios(id),
  metodo           text,
  referencia       text,
  confirmado_en    timestamptz,
  creado_en        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reembolsos_pedido_idx ON reembolsos (pedido_id);

-- -----------------------------------------------------------------------------
-- 7. FINANZAS DEL REPARTIDOR (garantía / adelantos / liquidaciones)
-- -----------------------------------------------------------------------------

-- Liquidación diaria por repartidor. Resume el efectivo cobrado, el efectivo
-- recibido, los adelantos descontados y la tarifa que se le paga.
-- `fecha_operativa` es el día operativo en America/Lima.
-- Si la tarifa pagable difiere de la de referencia, se exige un motivo.
CREATE TABLE liquidaciones (
  id                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id                   uuid NOT NULL REFERENCES inquilinos(id),
  repartidor_id                  uuid NOT NULL REFERENCES repartidores(id),
  fecha_operativa                date NOT NULL,
  corte_en                       timestamptz NOT NULL,
  efectivo_cobrado_centavos      bigint NOT NULL DEFAULT 0 CHECK (efectivo_cobrado_centavos >= 0),
  efectivo_recibido_centavos     bigint NOT NULL DEFAULT 0 CHECK (efectivo_recibido_centavos >= 0),
  adelantos_deducidos_centavos   bigint NOT NULL DEFAULT 0 CHECK (adelantos_deducidos_centavos >= 0),
  tarifa_repartidor_referencia_centavos bigint NOT NULL DEFAULT 0
                                 CHECK (tarifa_repartidor_referencia_centavos >= 0),   -- informativo
  tarifa_repartidor_pagable_centavos    bigint NOT NULL DEFAULT 0
                                 CHECK (tarifa_repartidor_pagable_centavos >= 0),      -- editable con motivo
  motivo_ajuste_tarifa_repartidor text,
  neto_centavos                  bigint NOT NULL DEFAULT 0,
                                 -- neto = tarifa_pagable - adelantos - (cobrado - recibido)
  estado                         text NOT NULL DEFAULT 'BORRADOR' CHECK (estado IN ('BORRADOR','CONFIRMADO')),
  confirmado_por                 uuid REFERENCES usuarios(id),
  confirmado_en                  timestamptz,
  creado_en                      timestamptz NOT NULL DEFAULT now(),
  actualizado_en                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (repartidor_id, fecha_operativa),
  CHECK (estado <> 'CONFIRMADO'
         OR (confirmado_por IS NOT NULL AND confirmado_en IS NOT NULL)),
  CHECK (tarifa_repartidor_pagable_centavos = tarifa_repartidor_referencia_centavos
         OR motivo_ajuste_tarifa_repartidor IS NOT NULL)
);
CREATE INDEX liquidaciones_inquilino_fecha_idx
  ON liquidaciones (inquilino_id, fecha_operativa DESC);

-- Adelantos entregados al repartidor (ej. combustible).
-- Siempre requieren autorización humana.
-- La restricción garantiza que un adelanto no se descuente dos veces.
CREATE TABLE adelantos_repartidor (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id                uuid NOT NULL REFERENCES inquilinos(id),
  repartidor_id               uuid NOT NULL REFERENCES repartidores(id),
  monto_centavos              bigint NOT NULL CHECK (monto_centavos > 0),
  proposito                   text NOT NULL DEFAULT 'COMBUSTIBLE',
  autorizado_por              uuid NOT NULL REFERENCES usuarios(id),
  estado                      text NOT NULL DEFAULT 'PENDIENTE_DEDUCCION'
                              CHECK (estado IN ('PENDIENTE_DEDUCCION','DEDUCIDO')),
  deducido_en_liquidacion_id  uuid REFERENCES liquidaciones(id),
  creado_en                   timestamptz NOT NULL DEFAULT now(),
  CHECK ((estado = 'DEDUCIDO') = (deducido_en_liquidacion_id IS NOT NULL))
);
CREATE INDEX adelantos_repartidor_pendientes_idx
  ON adelantos_repartidor (repartidor_id)
  WHERE estado = 'PENDIENTE_DEDUCCION';

-- LIBRO MAYOR de la billetera/garantía del repartidor. SOLO INSERCIÓN.
-- `monto_centavos` lleva signo: + aumenta la garantía disponible, - la reduce.
-- El saldo NUNCA se guarda: siempre se deriva sumando este libro.
CREATE TABLE movimientos_billetera (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id    uuid NOT NULL REFERENCES inquilinos(id),
  repartidor_id   uuid NOT NULL REFERENCES repartidores(id),
  tipo            text NOT NULL
                  CHECK (tipo IN ('DEPOSITO_GARANTIA','RETIRO_GARANTIA','EFECTIVO_COBRADO','EFECTIVO_LIQUIDADO','AJUSTE')),
  monto_centavos  bigint NOT NULL,
  pedido_id       uuid REFERENCES pedidos(id),
  adelanto_id     uuid REFERENCES adelantos_repartidor(id),
  liquidacion_id  uuid REFERENCES liquidaciones(id),
  motivo          text,
  actor_id        uuid REFERENCES usuarios(id),
  creado_en       timestamptz NOT NULL DEFAULT now(),

  -- Reglas de signo por tipo de movimiento.
  CONSTRAINT movimientos_billetera_signo_chk CHECK (
       (tipo IN ('DEPOSITO_GARANTIA','EFECTIVO_LIQUIDADO') AND monto_centavos > 0)
    OR (tipo IN ('RETIRO_GARANTIA','EFECTIVO_COBRADO') AND monto_centavos < 0)
    OR (tipo = 'AJUSTE' AND monto_centavos <> 0 AND motivo IS NOT NULL)
  ),
  -- Un cobro en efectivo debe referenciar su pedido.
  CONSTRAINT movimientos_billetera_efectivo_pedido_chk
    CHECK (tipo <> 'EFECTIVO_COBRADO' OR pedido_id IS NOT NULL),
  -- Un cierre de efectivo debe referenciar su liquidación.
  CONSTRAINT movimientos_billetera_liquidacion_chk
    CHECK (tipo <> 'EFECTIVO_LIQUIDADO' OR liquidacion_id IS NOT NULL)
);
CREATE INDEX movimientos_billetera_repartidor_idx
  ON movimientos_billetera (repartidor_id, creado_en);
-- Un pedido solo puede generar UN cobro en efectivo en el libro mayor.
CREATE UNIQUE INDEX movimientos_billetera_un_cobro_por_pedido
  ON movimientos_billetera (pedido_id) WHERE tipo = 'EFECTIVO_COBRADO';
-- Una liquidación solo puede registrar UN asiento de efectivo recibido.
CREATE UNIQUE INDEX movimientos_billetera_un_cierre_por_liquidacion
  ON movimientos_billetera (liquidacion_id) WHERE tipo = 'EFECTIVO_LIQUIDADO';

-- Saldo de garantía disponible = suma del libro mayor (siempre derivable).
CREATE OR REPLACE FUNCTION saldo_garantia_repartidor(p_repartidor uuid) RETURNS bigint AS $$
  SELECT COALESCE(SUM(monto_centavos), 0)::bigint
  FROM movimientos_billetera
  WHERE repartidor_id = p_repartidor;
$$ LANGUAGE sql STABLE;

-- Vista de saldo por repartidor. `tiene_deuda` es true cuando el saldo es negativo.
CREATE VIEW vista_saldo_garantia_repartidor AS
SELECT r.id AS repartidor_id,
       r.inquilino_id,
       r.nombre_completo,
       COALESCE(SUM(w.monto_centavos), 0)::bigint AS saldo_centavos,
       COALESCE(SUM(w.monto_centavos), 0) < 0     AS tiene_deuda
FROM repartidores r
LEFT JOIN movimientos_billetera w ON w.repartidor_id = r.id
GROUP BY r.id, r.inquilino_id, r.nombre_completo;

-- -----------------------------------------------------------------------------
-- 8. CALIFICACIONES, ALERTAS, CONFIGURACIÓN, AUDITORÍA, INTEGRACIÓN
-- -----------------------------------------------------------------------------

-- Calificaciones. La estructura está lista, pero el uso es mínimo en el MVP.
-- Se califica a restaurante, repartidor o cliente, y quien califica puede ser
-- cliente, repartidor o personal interno.
CREATE TABLE calificaciones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id      uuid NOT NULL REFERENCES inquilinos(id),
  pedido_id         uuid NOT NULL REFERENCES pedidos(id),
  tipo_sujeto       text NOT NULL CHECK (tipo_sujeto IN ('RESTAURANTE','REPARTIDOR','CLIENTE')),
  sujeto_id         uuid NOT NULL,
  tipo_calificador  text NOT NULL CHECK (tipo_calificador IN ('CLIENTE','REPARTIDOR','PERSONAL')),
  estrellas         smallint NOT NULL CHECK (estrellas BETWEEN 1 AND 5),
  comentario        text,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pedido_id, tipo_sujeto, tipo_calificador)
);
CREATE INDEX calificaciones_sujeto_idx ON calificaciones (tipo_sujeto, sujeto_id);

-- Alertas operativas: pedido nuevo, tiempo de espera de aceptación, demora de preparación,
-- ausencia de repartidor, etc. `clave_deduplicacion` evita alertas duplicadas.
CREATE TABLE alertas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id          uuid NOT NULL REFERENCES inquilinos(id),
  tipo                  text NOT NULL,
  severidad             text NOT NULL DEFAULT 'INFO'
                        CHECK (severidad IN ('INFO','ADVERTENCIA','CRITICO')),
  pedido_id             uuid REFERENCES pedidos(id),
  repartidor_id         uuid REFERENCES repartidores(id),
  sucursal_id           uuid REFERENCES sucursales(id),
  datos                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  clave_deduplicacion   text NOT NULL,
  estado                text NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA','RECONOCIDA','RESUELTA')),
  reconocido_por        uuid REFERENCES usuarios(id),
  creado_en             timestamptz NOT NULL DEFAULT now(),
  resuelto_en           timestamptz,
  UNIQUE (inquilino_id, clave_deduplicacion)
);
CREATE INDEX alertas_abiertas_idx
  ON alertas (inquilino_id, creado_en DESC) WHERE estado <> 'RESUELTA';

-- Configuración por inquilino (JSON). `es_marcador = true` significa que el
-- valor NO está aprobado todavía (marcador provisional).
CREATE TABLE configuraciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id    uuid NOT NULL REFERENCES inquilinos(id),
  clave           text NOT NULL,
  valor           jsonb NOT NULL,
  es_marcador     boolean NOT NULL DEFAULT false,
  actualizado_por uuid REFERENCES usuarios(id),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inquilino_id, clave)
);

-- Registro de auditoría. SOLO INSERCIÓN.
-- Guarda quién hizo qué, sobre qué objeto, y los valores antes/después.
-- Cuando crezca, conviene particionar por mes: PARTITION BY RANGE (creado_en).
CREATE TABLE registro_auditoria (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id  uuid NOT NULL REFERENCES inquilinos(id),
  actor_id      uuid REFERENCES usuarios(id),
  rol_actor     text,
  accion        text NOT NULL,
  tipo_objeto   text NOT NULL,
  objeto_id     text,
  antes         jsonb,
  despues       jsonb,
  id_solicitud  text,
  ip            inet,
  creado_en     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX registro_auditoria_inquilino_creado_idx
  ON registro_auditoria (inquilino_id, creado_en DESC);
CREATE INDEX registro_auditoria_objeto_idx
  ON registro_auditoria (inquilino_id, tipo_objeto, objeto_id);
CREATE INDEX registro_auditoria_actor_idx
  ON registro_auditoria (inquilino_id, actor_id, creado_en DESC);

-- Bandeja de salida (outbox) para efectos secundarios: notificaciones, CRM, etc.
-- El proceso en segundo plano toma los pendientes, reintenta con espera
-- incremental y marca ENVIADO o MUERTO.
CREATE TABLE eventos_salida (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id       uuid NOT NULL REFERENCES inquilinos(id),
  tipo               text NOT NULL,
  datos              jsonb NOT NULL,
  clave_deduplicacion text,
  estado             text NOT NULL DEFAULT 'PENDIENTE'
                     CHECK (estado IN ('PENDIENTE','PROCESANDO','ENVIADO','FALLIDO','MUERTO')),
  intentos           integer NOT NULL DEFAULT 0,
  ultimo_error       text,
  proximo_intento_en timestamptz NOT NULL DEFAULT now(),
  creado_en          timestamptz NOT NULL DEFAULT now(),
  procesado_en       timestamptz
);
CREATE UNIQUE INDEX eventos_salida_deduplicacion_uq
  ON eventos_salida (inquilino_id, clave_deduplicacion)
  WHERE clave_deduplicacion IS NOT NULL;
CREATE INDEX eventos_salida_pendientes_idx
  ON eventos_salida (proximo_intento_en)
  WHERE estado IN ('PENDIENTE','FALLIDO');

-- Webhooks entrantes. Sirve para idempotencia: (proveedor, id_evento_externo)
-- es único, así un reintento del proveedor no procesa dos veces el mismo evento.
-- Por eso esta tabla tiene un guardia especial y no el bloqueo total.
CREATE TABLE eventos_entrada (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor          text NOT NULL,
  id_evento_externo  text NOT NULL,
  datos              jsonb NOT NULL,
  estado             text NOT NULL DEFAULT 'RECIBIDO'
                     CHECK (estado IN ('RECIBIDO','PROCESADO','FALLIDO','IGNORADO')),
  intentos           integer NOT NULL DEFAULT 0,
  error              text,
  recibido_en        timestamptz NOT NULL DEFAULT now(),
  procesado_en       timestamptz,
  UNIQUE (proveedor, id_evento_externo)
);
CREATE INDEX eventos_entrada_estado_idx ON eventos_entrada (estado, recibido_en);

-- Eventos del embudo de conversión, para reportes posteriores.
CREATE TABLE eventos_embudo (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id uuid NOT NULL REFERENCES inquilinos(id),
  sucursal_id  uuid REFERENCES sucursales(id),
  id_sesion    text NOT NULL,
  paso         text NOT NULL CHECK (paso IN ('IMPRESION','VISTA_CARTA','AGREGAR_AL_CARRITO','COMPRA')),
  creado_en    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX eventos_embudo_idx ON eventos_embudo (inquilino_id, sucursal_id, creado_en);

-- Tablas creadas vacías para el futuro (promociones y notificaciones push web).
CREATE TABLE promociones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inquilino_id   uuid NOT NULL REFERENCES inquilinos(id),
  restaurante_id uuid REFERENCES restaurantes(id),
  sucursal_id    uuid REFERENCES sucursales(id),
  nombre         text NOT NULL,
  tipo           text NOT NULL CHECK (tipo IN ('DESCUENTO','CUPON','COMBO')),
  codigo         text,
  inicia_en      timestamptz,
  termina_en     timestamptz,
  esta_activa    boolean NOT NULL DEFAULT false,
  creado_por     uuid REFERENCES usuarios(id),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE reglas_promocion (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promocion_id  uuid NOT NULL REFERENCES promociones(id) ON DELETE CASCADE,
  regla         jsonb NOT NULL
);
CREATE TABLE suscripciones_push (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id   uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  punto_final  text NOT NULL UNIQUE,
  claves       jsonb NOT NULL,
  creado_en    timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 9. DISPARADORES (TRIGGERS): solo inserción y actualizado_en automático
-- -----------------------------------------------------------------------------

-- Bloqueo de UPDATE/DELETE en las tablas de solo inserción.
CREATE TRIGGER registro_auditoria_solo_insercion
  BEFORE UPDATE OR DELETE ON registro_auditoria
  FOR EACH ROW EXECUTE FUNCTION prohibir_mutacion();
CREATE TRIGGER historial_estados_pedido_solo_insercion
  BEFORE UPDATE OR DELETE ON historial_estados_pedido
  FOR EACH ROW EXECUTE FUNCTION prohibir_mutacion();
CREATE TRIGGER eventos_pago_solo_insercion
  BEFORE UPDATE OR DELETE ON eventos_pago
  FOR EACH ROW EXECUTE FUNCTION prohibir_mutacion();
CREATE TRIGGER movimientos_billetera_solo_insercion
  BEFORE UPDATE OR DELETE ON movimientos_billetera
  FOR EACH ROW EXECUTE FUNCTION prohibir_mutacion();

-- `eventos_entrada` usa un guardia propio (permite actualizar solo 4 columnas).
CREATE TRIGGER guardia_eventos_entrada_trg
  BEFORE UPDATE OR DELETE ON eventos_entrada
  FOR EACH ROW EXECUTE FUNCTION guardia_eventos_entrada();

-- TRUNCATE también debe bloquearse en las tablas críticas.
CREATE TRIGGER registro_auditoria_sin_truncate
  BEFORE TRUNCATE ON registro_auditoria
  FOR EACH STATEMENT EXECUTE FUNCTION prohibir_mutacion();
CREATE TRIGGER historial_estados_pedido_sin_truncate
  BEFORE TRUNCATE ON historial_estados_pedido
  FOR EACH STATEMENT EXECUTE FUNCTION prohibir_mutacion();
CREATE TRIGGER eventos_pago_sin_truncate
  BEFORE TRUNCATE ON eventos_pago
  FOR EACH STATEMENT EXECUTE FUNCTION prohibir_mutacion();
CREATE TRIGGER movimientos_billetera_sin_truncate
  BEFORE TRUNCATE ON movimientos_billetera
  FOR EACH STATEMENT EXECUTE FUNCTION prohibir_mutacion();

-- Instala automáticamente el disparador de `actualizado_en` en TODA tabla
-- base que tenga esa columna. Así no hay que repetirlo tabla por tabla.
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema
     AND tb.table_name = c.table_name
     AND tb.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.column_name = 'actualizado_en'
  LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion()',
      t.table_name || '_actualizar_fecha_actualizacion', t.table_name);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 10. CONFIGURACIÓN POR DEFECTO (valores MARCADORES PROVISIONALES = NO aprobados)
-- -----------------------------------------------------------------------------
-- Las claves y los valores también están en español (por ejemplo
-- 'pedido.minutos_espera_aceptacion'). `es_marcador = true` indica que el
-- valor aún no fue aprobado por el negocio. Si la aplicación consulta las
-- claves antiguas en inglés, debe actualizarse para usar estas claves.
CREATE OR REPLACE FUNCTION sembrar_configuracion_predeterminada(p_inquilino uuid) RETURNS void AS $$
BEGIN
  INSERT INTO configuraciones (inquilino_id, clave, valor, es_marcador) VALUES
    (p_inquilino, 'pedido.minutos_espera_aceptacion',            '5'::jsonb,       true),   -- DECISION-05
    (p_inquilino, 'pedido.minutos_umbral_demora_preparacion',          '30'::jsonb,      true),   -- DECISION-05
    (p_inquilino, 'pedido.minutos_umbral_sin_repartidor',            '10'::jsonb,      true),   -- DECISION-05
    (p_inquilino, 'repartidor.minutos_espera_recojo',                   '15'::jsonb,      false),  -- aprobado
    (p_inquilino, 'repartidor.edad_minima_efectivo_sin_garantia',    '35'::jsonb,      true),   -- doc original; DECISION-02
    (p_inquilino, 'repartidor.permitir_multiples_pedidos',                 'false'::jsonb,   true),
    (p_inquilino, 'garantia.minimo_centavos',                         '0'::jsonb,       true),   -- DECISION-02
    (p_inquilino, 'entrega.maximo_intentos',                       '2'::jsonb,       false),  -- aprobado
    (p_inquilino, 'liquidacion.hora_corte',                      '"23:00"'::jsonb, true),   -- confirmar procedimiento
    (p_inquilino, 'cliente.minimo_pedidos_top',                     '10'::jsonb,      true),
    (p_inquilino, 'reportes.encargado_sucursal_puede_ver_ventas',       'false'::jsonb,   true),   -- DECISION-04
    (p_inquilino, 'reportes.coordinador_puede_ver_embudo',         'false'::jsonb,   true),   -- DECISION-04
    (p_inquilino, 'soporte.puede_asignar_repartidor',                    'true'::jsonb,    false),
    (p_inquilino, 'soporte.puede_crear_adelanto',                  'false'::jsonb,   true),
    (p_inquilino, 'funcionalidad.integracion.vocero',                  'false'::jsonb,   false),
    (p_inquilino, 'funcionalidad.integracion.whatsapp',                'false'::jsonb,   false),
    (p_inquilino, 'localizacion.zona_horaria',                             '"America/Lima"'::jsonb, false),
    (p_inquilino, 'localizacion.moneda',                             '"PEN"'::jsonb,   false)
  ON CONFLICT (inquilino_id, clave) DO NOTHING;
END $$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 11. OPCIONAL / ENDURECIMIENTO (descomentar según el entorno)
-- -----------------------------------------------------------------------------

-- Rol de la aplicación SIN poder alterar las tablas de solo inserción:
--   CREATE ROLE zd_app LOGIN PASSWORD '<desde variable de entorno>';
--   GRANT USAGE ON SCHEMA public TO zd_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zd_app;
--   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zd_app;
--   REVOKE UPDATE, DELETE, TRUNCATE
--     ON registro_auditoria, historial_estados_pedido, eventos_pago, movimientos_billetera
--     FROM zd_app;
--   REVOKE DELETE, TRUNCATE ON eventos_entrada FROM zd_app;

-- Aislamiento por inquilino con seguridad a nivel de fila (RLS; segunda barrera;
-- la app fija el inquilino por sesión):
--   ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY pedidos_aislamiento_inquilino ON pedidos
--     USING (inquilino_id = current_setting('app.inquilino_id')::uuid);
--   -- y SELECT set_config('app.inquilino_id', '<uuid>', true) al inicio de cada transacción.

-- Primer arranque (ejemplo):
--   INSERT INTO inquilinos (nombre, slug)
--   VALUES ('Zero Delivery', 'zero-delivery') RETURNING id;
--   SELECT sembrar_configuracion_predeterminada('<inquilino_id>');

COMMIT;
