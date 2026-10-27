import { scrypt, randomBytes } from "node:crypto";
import fs from "node:fs";

const N = 16384;
const r = 8;
const p = 1;
const keylen = 64;

function deriveKey(password, salt, len) {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      len,
      { N, r, p, maxmem: 64 * 1024 * 1024 },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      }
    );
  });
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await deriveKey(password, salt, keylen);
  return `scrypt$N=${N},r=${r},p=${p}$${salt}$${derivedKey.toString("hex")}`;
}

async function main() {
  console.log("Generando hashes de contraseñas...");
  const adminHash = await hashPassword("AdminPass123!");
  const demoHash = await hashPassword("DemoPass123!");
  const kitchenHash = await hashPassword("KitchenPass123!");
  const riderHash = await hashPassword("RiderPass123!");

  const sql = `
-- Inquilino Demo
INSERT INTO inquilinos (id, slug, nombre, estado)
VALUES ('01bea9f8-a7db-44a6-b066-a0cee610300c', 'zero-delivery-demo', 'Zero Delivery Demo', 'ACTIVO')
ON CONFLICT (slug) DO UPDATE SET estado = 'ACTIVO';

-- Usuarios
INSERT INTO usuarios (id, inquilino_id, nombre_usuario, hash_contrasena, nombre_mostrado, rol, esta_activo)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'admin_demo', '${adminHash}', 'Administrador Demo', 'ADMINISTRADOR', true),
  ('a0000000-0000-0000-0000-000000000002', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'coordinator_demo', '${demoHash}', 'Coordinador Demo', 'COORDINADOR', true),
  ('a0000000-0000-0000-0000-000000000003', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'branch_demo', '${demoHash}', 'Encargado Central', 'ENCARGADO_SUCURSAL', true),
  ('a0000000-0000-0000-0000-000000000004', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'kitchen_demo', '${kitchenHash}', 'Jefe de Cocina', 'ENCARGADO_SUCURSAL', true),
  ('a0000000-0000-0000-0000-000000000005', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'support_demo', '${demoHash}', 'Agente Soporte', 'AGENTE_SOPORTE', true),
  ('a0000000-0000-0000-0000-000000000006', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'rider_demo', '${riderHash}', 'Carlos Rider Demo', 'REPARTIDOR', true)
ON CONFLICT (inquilino_id, lower(nombre_usuario)) 
DO UPDATE SET 
  hash_contrasena = EXCLUDED.hash_contrasena,
  esta_activo = true,
  intentos_fallidos = 0,
  bloqueado_hasta = NULL;

-- Restaurante y Sucursal
INSERT INTO restaurantes (id, inquilino_id, nombre, razon_social, ruc, esta_activo)
VALUES ('b0000000-0000-0000-0000-000000000001', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'Burger Zero Live', 'Burger Zero SAC', '20123456789', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO sucursales (id, inquilino_id, restaurante_id, slug, nombre, direccion, telefono, apertura_manual, esta_activo)
VALUES ('c0000000-0000-0000-0000-000000000001', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'b0000000-0000-0000-0000-000000000001', 'sucursal-central-live', 'Sucursal Central', 'Av. La Marina 1234, San Miguel, Lima', '+51999888777', true, true)
ON CONFLICT (inquilino_id, slug) DO UPDATE SET apertura_manual = true, esta_activo = true;

-- Acceso a Sucursal para Encargados y Admin
INSERT INTO acceso_usuario_sucursal (usuario_id, sucursal_id)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001'),
  ('a0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001')
ON CONFLICT (usuario_id, sucursal_id) DO NOTHING;

-- Repartidor asociado a usuario rider_demo
INSERT INTO repartidores (id, inquilino_id, usuario_id, nombre_completo, telefono, fecha_nacimiento, tipo_flota, tipo_vehiculo, estado, alta_confianza, esta_activo)
VALUES ('d0000000-0000-0000-0000-000000000001', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'a0000000-0000-0000-0000-000000000006', 'Carlos Rider Demo', '+51987654321', '1995-05-10', 'PROPIO', 'MOTO', 'DISPONIBLE', true, true)
ON CONFLICT (usuario_id) DO UPDATE SET estado = 'DISPONIBLE', esta_activo = true;

-- Categorías y Productos
INSERT INTO categorias (id, inquilino_id, restaurante_id, nombre, orden)
VALUES 
  ('e0000000-0000-0000-0000-000000000001', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'b0000000-0000-0000-0000-000000000001', 'Hamburguesas Clásicas', 1),
  ('e0000000-0000-0000-0000-000000000002', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'b0000000-0000-0000-0000-000000000001', 'Bebidas Heladas', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO productos (id, inquilino_id, restaurante_id, categoria_id, nombre, precio_base_centavos, empaque_centavos, es_fragil, esta_activo)
VALUES 
  ('f0000000-0000-0000-0000-000000000001', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Burger Doble Carne', 2500, 150, false, true),
  ('f0000000-0000-0000-0000-000000000002', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'Burger Royal Artesanal', 2200, 150, false, true),
  ('f0000000-0000-0000-0000-000000000003', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'b0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 'Chicha Morada 500ml', 700, 50, false, true)
ON CONFLICT (id) DO NOTHING;

-- Cliente demo
INSERT INTO clientes (id, inquilino_id, nombre, telefono_e164, segmento, marca_riesgo)
VALUES ('10000000-0000-0000-0000-000000000001', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'Juan Pérez Cliente', '+51999111222', 'NUEVO', 'NINGUNO')
ON CONFLICT (inquilino_id, telefono_e164) DO NOTHING;

-- Pedidos demo en estados NUEVO, CONFIRMADO, EN_PREPARACION, LISTO
INSERT INTO pedidos (
  id, inquilino_id, sucursal_id, cliente_id, direccion_snapshot,
  canal, estado_operativo, metodo_pago, estado_pago, estado_pago_restaurante,
  subtotal_items_centavos, descuento_centavos, tarifa_entrega_centavos, impuesto_centavos, total_centavos, efectivo_por_cobrar_centavos
)
VALUES
  (
    '20000000-0000-0000-0000-000000000001', '01bea9f8-a7db-44a6-b066-a0cee610300c',
    'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '{"direccion": "Av. Brasil 1450, Jesús María", "referencia": "Piso 4"}'::jsonb,
    'WEB', 'NUEVO', 'YAPE', 'PENDIENTE', 'PENDIENTE',
    2650, 0, 550, 0, 3200, 0
  ),
  (
    '20000000-0000-0000-0000-000000000002', '01bea9f8-a7db-44a6-b066-a0cee610300c',
    'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '{"direccion": "Calle Las Flores 230, Lince", "referencia": "Timbre 2"}'::jsonb,
    'WHATSAPP', 'CONFIRMADO', 'EFECTIVO', 'PENDIENTE', 'PENDIENTE',
    2350, 0, 550, 0, 2900, 2900
  ),
  (
    '20000000-0000-0000-0000-000000000003', '01bea9f8-a7db-44a6-b066-a0cee610300c',
    'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '{"direccion": "Av. Sucre 890, Pueblo Libre", "referencia": "Frente a parque"}'::jsonb,
    'WEB', 'EN_PREPARACION', 'YAPE', 'PAGADO', 'PENDIENTE',
    5300, 0, 550, 0, 5850, 0
  ),
  (
    '20000000-0000-0000-0000-000000000004', '01bea9f8-a7db-44a6-b066-a0cee610300c',
    'c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
    '{"direccion": "Av. San Felipe 412, Jesús María", "referencia": "Dpto 302"}'::jsonb,
    'MANUAL', 'LISTO', 'EFECTIVO', 'PENDIENTE', 'CONFIRMADO',
    2650, 0, 550, 0, 3200, 3200
  )
ON CONFLICT (id) DO NOTHING;

-- Detalle de productos de los pedidos
INSERT INTO detalle_pedido (
  id, pedido_id, producto_id, nombre_snapshot, cantidad,
  precio_base_centavos, empaque_centavos, margen_centavos, precio_unitario_centavos, total_linea_centavos, estado
)
VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Burger Doble Carne', 1, 2500, 150, 0, 2650, 2650, 'ACTIVO'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000002', 'Burger Royal Artesanal', 1, 2200, 150, 0, 2350, 2350, 'ACTIVO'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000001', 'Burger Doble Carne', 2, 2500, 150, 0, 2650, 5300, 'ACTIVO'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000001', 'Burger Doble Carne', 1, 2500, 150, 0, 2650, 2650, 'ACTIVO')
ON CONFLICT (id) DO NOTHING;
`;

  fs.writeFileSync("zero-delivery/scripts/seed.sql", sql, "utf8");
  console.log("Archivo seed.sql escrito exitosamente.");
}

main().catch(console.error);
