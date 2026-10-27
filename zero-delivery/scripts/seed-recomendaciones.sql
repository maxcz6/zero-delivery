-- Datos demo para el motor de recomendación de repartidores. Idempotente.
-- Aplicar: docker exec -i <postgres> psql -U postgres -d zero_delivery < scripts/seed-recomendaciones.sql

-- Ubicación GPS de la sucursal demo (Miraflores, Lima)
UPDATE sucursales SET latitud = -12.121900, longitud = -77.029700
 WHERE slug = 'sucursal-central-live' AND latitud IS NULL;

-- Dos repartidores adicionales (sin usuario de login)
INSERT INTO repartidores (id, inquilino_id, nombre_completo, telefono, fecha_nacimiento, tipo_flota, tipo_vehiculo, estado, alta_confianza, puntaje_confianza, esta_activo)
VALUES
 ('d0000000-0000-0000-0000-000000000002', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'Ana Torres (Auto)', '+51911111111', '1992-03-02', 'PROPIO', 'AUTO', 'DISPONIBLE', true, 90, true),
 ('d0000000-0000-0000-0000-000000000003', '01bea9f8-a7db-44a6-b066-a0cee610300c', 'Luis Quispe (Moto)', '+51922222222', '1998-11-20', 'AGENCIA', 'MOTO', 'DISPONIBLE', false, 60, true)
ON CONFLICT (id) DO NOTHING;

UPDATE repartidores SET puntaje_confianza = 80 WHERE id = 'd0000000-0000-0000-0000-000000000001' AND puntaje_confianza IS NULL;

-- Garantía en billetera: Carlos y Ana con garantía; Luis sin saldo (no elegible para contra entrega)
INSERT INTO movimientos_billetera (inquilino_id, repartidor_id, tipo, monto_centavos, motivo)
SELECT '01bea9f8-a7db-44a6-b066-a0cee610300c', r.id, 'DEPOSITO_GARANTIA', 10000, 'Garantía demo'
  FROM repartidores r
 WHERE r.id IN ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002')
   AND NOT EXISTS (SELECT 1 FROM movimientos_billetera m WHERE m.repartidor_id = r.id);

-- Últimas posiciones GPS
INSERT INTO ubicaciones_repartidor (repartidor_id, latitud, longitud)
SELECT v.id::uuid, v.lat, v.lng FROM (VALUES
  ('d0000000-0000-0000-0000-000000000001', -12.130000, -77.030000),
  ('d0000000-0000-0000-0000-000000000002', -12.150000, -77.010000)
) AS v(id, lat, lng)
WHERE NOT EXISTS (SELECT 1 FROM ubicaciones_repartidor u WHERE u.repartidor_id = v.id::uuid);

-- Calificaciones (estrellas) sobre pedidos existentes
WITH ped AS (
  SELECT id, row_number() OVER (ORDER BY numero) AS n FROM pedidos
  WHERE inquilino_id = '01bea9f8-a7db-44a6-b066-a0cee610300c'
)
INSERT INTO calificaciones (inquilino_id, pedido_id, tipo_sujeto, sujeto_id, tipo_calificador, estrellas)
SELECT '01bea9f8-a7db-44a6-b066-a0cee610300c', ped.id, 'REPARTIDOR', v.rid::uuid, v.cal, v.est
  FROM ped JOIN (VALUES
    (1, 'd0000000-0000-0000-0000-000000000001', 'CLIENTE', 4),
    (1, 'd0000000-0000-0000-0000-000000000001', 'PERSONAL', 4),
    (2, 'd0000000-0000-0000-0000-000000000002', 'CLIENTE', 5),
    (2, 'd0000000-0000-0000-0000-000000000002', 'PERSONAL', 5),
    (3, 'd0000000-0000-0000-0000-000000000003', 'CLIENTE', 3),
    (3, 'd0000000-0000-0000-0000-000000000003', 'PERSONAL', 4)
  ) AS v(n, rid, cal, est) ON v.n = ped.n
ON CONFLICT DO NOTHING;
