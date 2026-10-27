/**
 * Zero Delivery — prueba de carga realista con k6.
 *
 * Simula 6 perfiles trabajando a la vez sobre el mismo inquilino demo:
 *   - clientes: navegan la carta pública y (algunos) crean pedidos reales.
 *   - soporte: revisa pedidos, valida comprobantes Yape/Transferencia y consulta recomendaciones.
 *   - coordinador: acepta pedidos, asigna repartidor y confirma el pago a la sucursal.
 *   - cocina (encargado): pasa a preparación, marca listo, registra traspaso y despacha.
 *   - repartidor: envía GPS, recoge, entrega y registra el cobro en efectivo.
 *   - admin: consulta tablero, sucursales, catálogo y flota.
 *
 * Uso:
 *   k6 run realistic-flows.js
 *   k6 run -e DURATION=30s -e SCALE=0.5 realistic-flows.js   # humo
 *   k6 run -e BASE_URL=http://localhost:4000 realistic-flows.js
 *
 * OJO: escribe datos reales (pedidos, validaciones, transiciones) en el entorno
 * donde se ejecute. Pensado para el inquilino demo, no para producción.
 */
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate } from "k6/metrics";

const BASE = __ENV.BASE_URL || "http://localhost:4000";
const API = `${BASE}/api/v1`;
const DURATION = __ENV.DURATION || "2m";
const SCALE = Number(__ENV.SCALE || "1");

const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };
const TENANT = "zero-delivery-demo";

// 400/409/422 son respuestas de negocio esperables con varios usuarios en paralelo
// (carreras por el mismo pedido, comprobante ya validado, compuerta de liberación…).
http.setResponseCallback(http.expectedStatuses({ min: 200, max: 299 }, 400, 409, 422));

// ---------------------------------------------------------------------------
// Métricas de negocio
// ---------------------------------------------------------------------------
const ordersCreated = new Counter("orders_created");
const ordersConfirmed = new Counter("orders_confirmed");
const paymentsValidated = new Counter("payments_validated");
const ridersAssigned = new Counter("riders_assigned");
const restaurantPayouts = new Counter("restaurant_payouts_confirmed");
const kitsStarted = new Counter("kitchen_started");
const kitsReady = new Counter("kitchen_ready");
const handoffs = new Counter("handoffs_registered");
const dispatches = new Counter("orders_dispatched");
const gateBlocks = new Counter("release_gate_blocked");
const deliveries = new Counter("orders_delivered");
const cashCollections = new Counter("cash_collections");
const gpsPings = new Counter("gps_pings");
const authFailures = new Counter("auth_failures");
const serverErrors = new Counter("server_errors");
const businessOk = new Rate("business_ok");

// ---------------------------------------------------------------------------
// Opciones: un escenario por rol, todos en paralelo
// ---------------------------------------------------------------------------
const vus = (n) => Math.max(1, Math.round(n * SCALE));

export const options = {
  discardResponseBodies: false,
  scenarios: {
    clientes: {
      executor: "constant-vus",
      exec: "clienteFlow",
      vus: vus(4),
      duration: DURATION,
      startTime: "3s",
      gracefulStop: "10s",
    },
    soporte: {
      executor: "constant-vus",
      exec: "soporteFlow",
      vus: vus(1),
      duration: DURATION,
      startTime: "0s",
      gracefulStop: "10s",
    },
    coordinador: {
      executor: "constant-vus",
      exec: "coordinadorFlow",
      vus: vus(1),
      duration: DURATION,
      startTime: "2s",
      gracefulStop: "10s",
    },
    cocina: {
      executor: "constant-vus",
      exec: "cocinaFlow",
      vus: vus(1),
      duration: DURATION,
      startTime: "4s",
      gracefulStop: "10s",
    },
    repartidor: {
      executor: "constant-vus",
      exec: "repartidorFlow",
      vus: vus(1),
      duration: DURATION,
      startTime: "6s",
      gracefulStop: "10s",
    },
    admin: {
      executor: "constant-vus",
      exec: "adminFlow",
      vus: vus(1),
      duration: DURATION,
      startTime: "8s",
      gracefulStop: "10s",
    },
  },
  thresholds: {
    checks: ["rate>0.92"],
    http_req_failed: ["rate<0.06"],
    "http_req_duration{endpoint:auth/login}": ["p(95)<1500"],
    "http_req_duration{endpoint:orders.public_create}": ["p(95)<2500"],
    "http_req_duration{endpoint:catalog.public_menu}": ["p(95)<1500"],
    http_req_duration: ["p(95)<2500", "p(99)<6000"],
  },
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function parse(res) {
  try {
    return res.json();
  } catch (_) {
    return null;
  }
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleepThink(min, max) {
  sleep(min + Math.random() * (max - min));
}

let CREDS = null;
let TOKEN = null;

function authHeaders() {
  const h = { ...JSON_HEADERS };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  return h;
}

/** Reintenta una vez tras re-loguear si la sesión caducó o el backend se reinició. */
function withAuth(fn) {
  let res = fn();
  if (res.status === 401 && CREDS) {
    login(CREDS.usuario, CREDS.password);
    res = fn();
  }
  return res;
}

function get(path, endpoint) {
  return withAuth(() => http.get(`${API}${path}`, { headers: authHeaders(), tags: { endpoint } }));
}

function post(path, body, endpoint) {
  return withAuth(() =>
    http.post(`${API}${path}`, JSON.stringify(body || {}), {
      headers: authHeaders(),
      tags: { endpoint },
    })
  );
}

function patch(path, body, endpoint) {
  return withAuth(() =>
    http.patch(`${API}${path}`, JSON.stringify(body || {}), {
      headers: authHeaders(),
      tags: { endpoint },
    })
  );
}

function record(res, name, allowed = [200, 201]) {
  // 201 Created es éxito en toda la API; se admite siempre que se admita 200.
  const list = allowed.indexOf(200) !== -1 ? allowed.concat(201) : allowed;
  const ok = list.indexOf(res.status) !== -1;
  businessOk.add(ok);
  if (!ok) {
    if (res.status >= 500) serverErrors.add(1);
    if (res.status === 401 || res.status === 403) authFailures.add(1);
    console.warn(`${name} -> ${res.status} ${String(res.body).slice(0, 180)}`);
  }
  return ok;
}

function login(usuario, password) {
  const res = http.post(
    `${API}/auth/login`,
    JSON.stringify({ inquilino_slug: TENANT, nombre_usuario: usuario, password }),
    { headers: JSON_HEADERS, tags: { endpoint: "auth/login" } }
  );
  const ok = record(res, `login ${usuario}`);
  if (ok) {
    CREDS = { usuario, password };
    const match = /zd_session=([a-f0-9]+)/i.exec(String(res.headers["Set-Cookie"] || ""));
    if (match) TOKEN = match[1];
  }
  return ok;
}

function activeOrders() {
  const res = get("/orders/active", "orders.active");
  if (res.status !== 200) {
    record(res, "orders/active");
    return [];
  }
  return parse(res)?.data || [];
}

// ---------------------------------------------------------------------------
// Setup: deja el escenario listo (abre la sucursal y recoge catálogo/flota)
// ---------------------------------------------------------------------------
export function setup() {
  if (!login("admin_demo", "AdminPass123!")) {
    throw new Error("No se pudo iniciar sesión como admin_demo");
  }

  const branchesRes = get("/catalog/branches", "setup.branches");
  const branches = parse(branchesRes)?.data || [];
  const branch = branches.find((b) => b.slug) || branches[0];
  if (!branch) throw new Error("El inquilino no tiene sucursales");

  const wasOpen = Boolean(branch.apertura_manual);
  if (!wasOpen) {
    const res = patch(
      `/catalog/branches/${branch.id}/toggle`,
      { apertura_manual: true },
      "setup.open_branch"
    );
    if (res.status !== 200) throw new Error("No se pudo abrir la sucursal para la prueba");
  }

  const menuRes = get(`/catalog/public/menu/${branch.slug}`, "setup.menu");
  const menu = parse(menuRes)?.data;
  const products = (menu?.productos || []).map((p) => ({ id: p.id, nombre: p.nombre }));
  if (products.length === 0) {
    throw new Error("La sucursal no tiene platos activos para poder pedir");
  }

  const ridersRes = get("/logistics/riders", "setup.riders");
  const riders = (parse(ridersRes)?.data || []).map((r) => r.id);

  return {
    branchSlug: branch.slug,
    products,
    riders,
    wasOpen,
    ridersCount: riders.length,
  };
}

export function teardown(data) {
  if (!data || data.wasOpen) return;
  login("admin_demo", "AdminPass123!");
  const branchesRes = get("/catalog/branches", "teardown.branches");
  const branch = (parse(branchesRes)?.data || []).find((b) => b.slug === data.branchSlug);
  if (branch) {
    patch(`/catalog/branches/${branch.id}/toggle`, { apertura_manual: false }, "teardown.close_branch");
  }
}

// ---------------------------------------------------------------------------
// Cliente: navega la carta y a veces compra
// ---------------------------------------------------------------------------
export function clienteFlow(data) {
  const branchesRes = get("/catalog/public/branches", "catalog.public_branches");
  check(branchesRes, { "cliente: sucursales 200": (r) => r.status === 200 });

  const abiertas = (parse(branchesRes)?.data || []).filter((b) => b.abierta);
  const branch = abiertas.length ? pick(abiertas) : { slug: data.branchSlug };
  const slug = branch.slug || data.branchSlug;

  const menuRes = get(`/catalog/public/menu/${slug}`, "catalog.public_menu");
  check(menuRes, { "cliente: carta 200": (r) => r.status === 200 });
  const menu = parse(menuRes)?.data;
  const productos = menu?.productos || [];

  // ~25% de las visitas terminan en pedido (el resto solo mira, como en la vida real).
  if (productos.length > 0 && Math.random() < 0.25) {
    const elegidos = [];
    const n = randInt(1, Math.min(3, productos.length));
    while (elegidos.length < n) {
      const p = pick(productos);
      if (!elegidos.some((e) => e.id === p.id)) elegidos.push(p);
    }

    const metodos = ["EFECTIVO", "EFECTIVO", "EFECTIVO", "YAPE", "YAPE", "TRANSFERENCIA_BANCARIA"];
    const body = {
      sucursal_slug: slug,
      cliente: {
        nombre: pick(["Ana", "Luis", "María", "Jorge", "Carla", "Diego", "Rosa", "Miguel"]) + " k6",
        telefono: `9${randInt(10000000, 99999999)}`,
      },
      direccion: {
        texto: pick([
          "Av. Larco 123, Miraflores",
          "Calle Las Flores 230, Lince",
          "Av. Brasil 1450, Jesús María",
          "Jr. Puno 456, Cercado de Lima",
          "Av. Universitaria 1801, San Miguel",
        ]),
        referencia: pick(["Frente al parque", "Piso 3", "Timbre 2", "Puerta negra", ""]),
        latitud: -12.1219 + (Math.random() - 0.5) * 0.02,
        longitud: -77.0297 + (Math.random() - 0.5) * 0.02,
      },
      metodo_pago: pick(metodos),
      notas: Math.random() < 0.3 ? "Prueba de carga k6 — sin cebolla" : null,
      items: elegidos.map((p) => ({ producto_id: p.id, cantidad: randInt(1, 2) })),
    };

    const created = post("/orders/public", body, "orders.public_create");
    if (created.status === 200 || created.status === 201) {
      ordersCreated.add(1);
      const token = parse(created)?.data?.token_publico;
      if (token) {
        const track = get(`/orders/public/track/${token}`, "orders.public_track");
        check(track, { "cliente: seguimiento 200": (r) => r.status === 200 });
      }
    } else {
      record(created, "orders/public", [200, 201, 400]);
    }
  }

  sleepThink(3, 7);
}

// ---------------------------------------------------------------------------
// Soporte: valida comprobantes y consulta recomendaciones
// ---------------------------------------------------------------------------
let soporteLogged = false;

export function soporteFlow(_data) {
  if (!soporteLogged) soporteLogged = login("support_demo", "DemoPass123!");
  if (!soporteLogged) return sleepThink(2, 4);

  const orders = activeOrders();

  const porValidar = orders.filter(
    (o) => o.metodo_pago !== "EFECTIVO" && o.estado_pago === "PENDIENTE"
  );

  if (porValidar.length > 0) {
    const order = pick(porValidar);
    const pagosRes = get(`/payments/order/${order.id}`, "payments.by_order");
    const pagos = parse(pagosRes)?.data || [];
    const pago = pagos.find((p) => p.estado === "PENDIENTE");
    if (pago) {
      const res = post(`/payments/${pago.id}/validate`, {}, "payments.validate");
      if (record(res, "payments/validate", [200, 400, 409])) paymentsValidated.add(1);
    }
  }

  // El coordinador/soporte consulta el ranking antes de asignar.
  if (orders.length > 0 && Math.random() < 0.5) {
    const order = pick(orders);
    const res = get(`/logistics/orders/${order.id}/recommendations`, "logistics.recommendations");
    check(res, { "soporte: recomendaciones 200": (r) => r.status === 200 });
  }

  sleepThink(2, 5);
}

// ---------------------------------------------------------------------------
// Coordinador: acepta pedidos, asigna repartidor y confirma pago a sucursal
// ---------------------------------------------------------------------------
let coordinadorLogged = false;

export function coordinadorFlow(data) {
  if (!coordinadorLogged) coordinadorLogged = login("coordinator_demo", "DemoPass123!");
  if (!coordinadorLogged) return sleepThink(2, 4);

  const orders = activeOrders();

  const nuevos = orders.filter((o) => o.estado_operativo === "NUEVO");
  if (nuevos.length > 0) {
    const order = pick(nuevos);
    const res = post(
      `/orders/${order.id}/transition`,
      { nuevo_estado: "CONFIRMADO" },
      "orders.transition.confirm"
    );
    if (record(res, "orders/transition CONFIRMADO", [200, 400, 409])) ordersConfirmed.add(1);
  }

  const porAsignar = orders.filter(
    (o) => ["CONFIRMADO", "LISTO"].includes(o.estado_operativo) && !o.repartidor_id
  );
  if (porAsignar.length > 0) {
    const order = pick(porAsignar);
    let riderId = null;

    const recRes = get(
      `/logistics/orders/${order.id}/recommendations`,
      "logistics.recommendations"
    );
    if (recRes.status === 200) {
      const evaluados = parse(recRes)?.data?.repartidores || [];
      const mejor = evaluados.find((r) => r.elegible) || evaluados[0];
      riderId = mejor ? mejor.id : null;
    }
    if (!riderId && data.riders.length > 0) riderId = pick(data.riders);

    if (riderId) {
      const res = post(
        `/logistics/orders/${order.id}/assign-rider`,
        { repartidor_id: riderId },
        "logistics.assign_rider"
      );
      if (record(res, "logistics/assign-rider", [200, 400, 409])) ridersAssigned.add(1);
    }
  }

  // Pago/liquidación a la sucursal, si existe el registro.
  const porConfirmar = orders.find((o) => o.estado_pago_restaurante === "PENDIENTE");
  if (porConfirmar && Math.random() < 0.3) {
    const rpRes = get(
      `/payments/restaurant/order/${porConfirmar.id}`,
      "payments.restaurant_by_order"
    );
    const pagoRest = parse(rpRes)?.data;
    if (pagoRest && pagoRest.estado === "PENDIENTE") {
      const res = post(
        `/payments/restaurant/${pagoRest.id}/confirm`,
        { metodo: "TRANSFERENCIA" },
        "payments.restaurant_confirm"
      );
      if (record(res, "payments/restaurant confirm", [200, 400, 409])) restaurantPayouts.add(1);
    }
  }

  sleepThink(2, 5);
}

// ---------------------------------------------------------------------------
// Cocina / encargado de sucursal: preparación, listo, traspaso y despacho
// ---------------------------------------------------------------------------
let cocinaLogged = false;

export function cocinaFlow(_data) {
  if (!cocinaLogged) cocinaLogged = login("branch_demo", "DemoPass123!");
  if (!cocinaLogged) return sleepThink(2, 4);

  const orders = activeOrders();
  if (orders.length === 0) return sleepThink(2, 5);

  const estado = (o) => o.estado_operativo;

  const confirmado = orders.find((o) => estado(o) === "CONFIRMADO");
  if (confirmado) {
    const res = post(
      `/orders/${confirmado.id}/transition`,
      { nuevo_estado: "EN_PREPARACION" },
      "orders.transition.prepare"
    );
    if (record(res, "orders/transition EN_PREPARACION", [200, 400, 409])) kitsStarted.add(1);
    return sleepThink(2, 5);
  }

  const preparando = orders.find((o) => estado(o) === "EN_PREPARACION");
  if (preparando) {
    const res = post(
      `/orders/${preparando.id}/transition`,
      { nuevo_estado: "LISTO" },
      "orders.transition.ready"
    );
    if (record(res, "orders/transition LISTO", [200, 400, 409])) kitsReady.add(1);
    return sleepThink(2, 5);
  }

  const listo = orders.find(
    (o) =>
      ["LISTO", "REPARTIDOR_ASIGNADO", "REPARTIDOR_EN_RECOJO"].includes(estado(o)) &&
      // El traspaso exige el pago a la sucursal confirmado (constraint pedidos_traspaso_requiere_pago_chk).
      o.estado_pago_restaurante === "CONFIRMADO" &&
      !o.traspaso_en
  );
  if (listo) {
    // 1) traspaso físico del paquete al repartidor
    const handoff = post(`/orders/${listo.id}/handoff`, {}, "orders.handoff");
    if (handoff.status === 200) handoffs.add(1);
    else record(handoff, "orders/handoff", [200, 400, 409]);

    // 2) despacho (la compuerta de liberación puede denegarlo: se mide aparte)
    if (!listo.repartidor_id) return sleepThink(2, 4);
    const res = post(
      `/orders/${listo.id}/transition`,
      { nuevo_estado: "EN_CAMINO" },
      "orders.transition.dispatch"
    );
    if (res.status === 200) {
      dispatches.add(1);
      businessOk.add(true);
    } else if (res.status === 400 && String(res.body).includes("RELEASE_GATE")) {
      gateBlocks.add(1); // esperado mientras la sucursal no tenga el pago confirmado
    } else {
      record(res, "orders/transition EN_CAMINO", [200, 400, 409]);
    }
  }

  sleepThink(2, 5);
}

// ---------------------------------------------------------------------------
// Repartidor: GPS, recojo, entrega y cobro
// ---------------------------------------------------------------------------
let riderState = null;

export function repartidorFlow(_data) {
  if (!riderState) {
    if (!login("rider_demo", "RiderPass123!")) return sleepThink(3, 5);
    const meRes = get("/auth/me", "auth.me");
    riderState = { riderId: parse(meRes)?.actor?.riderId || null };
  }

  const ping = post(
    "/logistics/riders/location",
    {
      latitud: -12.1219 + (Math.random() - 0.5) * 0.01,
      longitud: -77.0297 + (Math.random() - 0.5) * 0.01,
      precision_m: randInt(5, 25),
    },
    "logistics.location"
  );
  if (ping.status === 200) gpsPings.add(1);

  const orders = activeOrders();
  const asignado = orders.find((o) => o.estado_operativo === "REPARTIDOR_ASIGNADO");
  if (asignado) {
    const res = post(
      `/orders/${asignado.id}/transition`,
      { nuevo_estado: "REPARTIDOR_EN_RECOJO" },
      "orders.transition.pickup"
    );
    record(res, "orders/transition REPARTIDOR_EN_RECOJO", [200, 400, 409]);
    return sleepThink(2, 5);
  }

  const enCamino = orders.find((o) => o.estado_operativo === "EN_CAMINO");
  if (enCamino) {
    const res = post(
      `/orders/${enCamino.id}/transition`,
      { nuevo_estado: "ENTREGADO" },
      "orders.transition.deliver"
    );
    if (res.status === 200) deliveries.add(1);
    else record(res, "orders/transition ENTREGADO", [200, 400, 409]);

    if (res.status === 200 && enCamino.metodo_pago === "EFECTIVO") {
      const cobro = post(
        `/logistics/orders/${enCamino.id}/collect-cash`,
        {},
        "logistics.collect_cash"
      );
      if (cobro.status === 200) cashCollections.add(1);
      else record(cobro, "logistics/collect-cash", [200, 400, 409]);
    }
  }

  sleepThink(3, 6);
}

// ---------------------------------------------------------------------------
// Administrador: tablero y catálogo
// ---------------------------------------------------------------------------
let adminLogged = false;

export function adminFlow(_data) {
  if (!adminLogged) adminLogged = login("admin_demo", "AdminPass123!");
  if (!adminLogged) return sleepThink(3, 5);

  const stats = get("/orders/stats/overview", "orders.stats");
  check(stats, { "admin: métricas 200": (r) => r.status === 200 });

  const branches = get("/catalog/branches", "catalog.branches");
  check(branches, { "admin: sucursales 200": (r) => r.status === 200 });

  const products = get("/catalog/products?incluirInactivos=true", "catalog.products");
  check(products, { "admin: catálogo 200": (r) => r.status === 200 });

  const riders = get("/logistics/riders", "logistics.riders");
  check(riders, { "admin: flota 200": (r) => r.status === 200 });

  sleepThink(4, 8);
}
