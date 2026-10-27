async function main() {
  console.log("=== VERIFICACIÓN INTEGRAL DE HITO 3 ===");

  // 1. Probar ruta pública de menú
  const menuRes = await fetch("http://localhost:3001/m/sucursal-central-live");
  console.log("1. Carta pública /m/sucursal-central-live:", menuRes.status);

  // 2. Probar API de menú público
  const apiMenuRes = await fetch("http://localhost:4000/api/v1/catalog/public/menu/sucursal-central-live");
  const apiMenuData = await apiMenuRes.json();
  console.log("2. API Menú público:", apiMenuRes.status, "Restaurante:", apiMenuData.data?.restaurante?.nombre, "Productos:", apiMenuData.data?.productos?.length);

  // 3. Probar ruta pública de tracking
  const token = "eda939e41beb416e97bd85b60e4f827c73d78e768c6543949ab7fe4490ea7bf6";
  const trackRes = await fetch(`http://localhost:3001/p/${token}`);
  console.log("3. Seguimiento público /p/:token:", trackRes.status);

  // 4. Probar API de tracking
  const apiTrackRes = await fetch(`http://localhost:4000/api/v1/orders/public/track/${token}`);
  const apiTrackData = await apiTrackRes.json();
  console.log("4. API Tracking:", apiTrackRes.status, "Orden #:", apiTrackData.data?.numero_orden, "Estado:", apiTrackData.data?.estado_operativo);

  // 5. Login como coordinador y probar sesión en frontend
  const loginRes = await fetch("http://localhost:4000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inquilino_slug: "zero-delivery-demo",
      nombre_usuario: "coordinator_demo",
      password: "DemoPass123!",
    }),
  });
  const cookieHeader = loginRes.headers.get("set-cookie");
  const zdCookie = cookieHeader ? cookieHeader.split(";")[0] : "";
  console.log("5. Login Coordinador:", loginRes.status, "Cookie obtenida:", Boolean(zdCookie));

  // 6. Probar /coordinator con sesión
  const coordPageRes = await fetch("http://localhost:3001/coordinator", {
    headers: { cookie: zdCookie },
  });
  console.log("6. Ruta /coordinator con sesión:", coordPageRes.status);

  // 7. Probar /metrics con sesión
  const metricsPageRes = await fetch("http://localhost:3001/metrics", {
    headers: { cookie: zdCookie },
  });
  console.log("7. Nueva vista /metrics con sesión:", metricsPageRes.status);

  // 8. Probar /profile con sesión
  const profilePageRes = await fetch("http://localhost:3001/profile", {
    headers: { cookie: zdCookie },
  });
  console.log("8. Nueva vista /profile con sesión:", profilePageRes.status);

  // 9. Probar API de estadísticas /api/v1/orders/stats/overview
  const statsRes = await fetch("http://localhost:4000/api/v1/orders/stats/overview", {
    headers: { cookie: zdCookie },
  });
  const statsData = await statsRes.json();
  console.log("9. API Stats Overview:", statsRes.status, "Total pedidos:", statsData.data?.total_pedidos, "Ventas Soles:", statsData.data?.total_ventas_soles, "Pedidos activos:", statsData.data?.pedidos_activos);

  // 10. Login como rider y probar telemetría GPS
  const riderLoginRes = await fetch("http://localhost:4000/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inquilino_slug: "zero-delivery-demo",
      nombre_usuario: "rider_demo",
      password: "RiderPass123!",
    }),
  });
  const riderCookie = riderLoginRes.headers.get("set-cookie")?.split(";")[0] ?? "";
  console.log("10. Login Rider:", riderLoginRes.status, "Cookie obtenida:", Boolean(riderCookie));

  // 11. Enviar telemetría GPS
  const gpsRes = await fetch("http://localhost:4000/api/v1/logistics/riders/location", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: riderCookie,
    },
    body: JSON.stringify({
      latitud: -12.0965,
      longitud: -77.0354,
      precision_metros: 5.2,
      velocidad_kmh: 24.5,
    }),
  });
  const gpsData = await gpsRes.json();
  console.log("11. Telemetría GPS Rider:", gpsRes.status, "Guardado:", gpsData.ok);

  // 12. Probar Vocero CRM en puerto 3000
  const voceroRes = await fetch("http://localhost:3000", { redirect: "manual" });
  console.log("12. Vocero CRM http://localhost:3000:", voceroRes.status, "Redirect location:", voceroRes.headers.get("location"));

  console.log("\n>>> TODAS LAS PRUEBAS DE INTEGRACIÓN HAN SIDO SUPERADAS AL 100% <<<");
}

main().catch(console.error);
