import { expect, test } from "@playwright/test";

const DEMO_PASSWORD = "ZeroDelivery2026!";

test.describe("API: salud y seguridad", () => {
  test("GET /api/v1/health responde el contrato esperado", async ({ request }) => {
    const response = await request.get("/api/v1/health");

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      service: "zero-delivery",
      version: "0.1.0",
      locale: "America/Lima",
      currency: "PEN",
    });
  });

  test("el webhook de Vocero está protegido con el feature flag apagado", async ({ request }) => {
    const health = await request.get("/api/webhooks/vocero/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true, service: "zero-delivery" });

    const response = await request.post("/api/webhooks/vocero", {
      data: { dispatchId: "dsp_e2e_fake", messages: [] },
    });

    expect(response.status()).toBe(404);
  });
});

test.describe("Portada pública", () => {
  test("muestra los tres accesos principales", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/Zero Delivery/i);
    await expect(
      page.getByRole("heading", { name: "Zero Delivery", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /Iniciar sesión/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Abrir vista Rider/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ir al panel/i })).toBeVisible();
  });

  test("la carta digital de una sucursal carga como invitado", async ({ page }) => {
    await page.goto("/m/miraflores");

    await expect(
      page.getByRole("heading", { name: /Carta Digital.*miraflores/i }),
    ).toBeVisible();
  });
});

test.describe("Login y redirección por rol", () => {
  test("el administrador entra al panel operativo", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Usuario / Identificador").fill("admin");
    await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /Ingresar al Sistema/i }).click();

    await page.waitForURL("**/dashboard");
    await expect(
      page.getByRole("heading", { name: /Tablero Operativo y Control de Despacho/i }),
    ).toBeVisible();
  });

  test("el repartidor entra a la app móvil de entregas", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Usuario / Identificador").fill("rider.carlos");
    await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /Ingresar al Sistema/i }).click();

    await page.waitForURL("**/deliveries");
    await expect(
      page.getByRole("heading", { name: /App Repartidor \(PWA\)/i }),
    ).toBeVisible();
  });

  test("credenciales inválidas muestran un mensaje de error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Usuario / Identificador").fill("usuario.inexistente.e2e");
    await page.getByLabel("Contraseña").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: /Ingresar al Sistema/i }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: /Credenciales incorrectas/i }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
