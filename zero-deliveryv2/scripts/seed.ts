import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";
import { hashPassword } from "../src/modules/identity";
import { DEFAULT_TENANT_SETTINGS, PLACEHOLDER_SETTING_KEYS } from "../src/modules/settings";
import { logger } from "../src/shared/logger";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5433/zero_delivery";

export async function runDatabaseSeed() {
  const sql = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(sql, { schema });

  const tenantId = "00000000-0000-4000-8000-000000000001";
  const restaurantId = "00000000-0000-4000-8000-000000000201";
  const branchId = "00000000-0000-4000-8000-000000000301";
  const riderId = "00000000-0000-4000-8000-000000000401";

  const defaultPasswordHash = hashPassword("ZeroDelivery2026!");

  logger.info("Iniciando seed en base de datos...", { databaseUrl: DATABASE_URL });

  // 1. Tenant
  await db
    .insert(schema.tenants)
    .values({
      id: tenantId,
      name: "Zero Delivery",
      slug: "zero-delivery",
      status: "ACTIVE",
    })
    .onConflictDoNothing({ target: schema.tenants.id });

  // 2. Users (5 roles)
  const seedUsers = [
    {
      id: "00000000-0000-4000-8000-000000000101",
      tenantId,
      username: "admin",
      passwordHash: defaultPasswordHash,
      displayName: "Administrador General",
      role: "ADMIN" as const,
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      tenantId,
      username: "coord.lima",
      passwordHash: defaultPasswordHash,
      displayName: "Coordinador Operativo Lima",
      role: "COORDINATOR" as const,
    },
    {
      id: "00000000-0000-4000-8000-000000000103",
      tenantId,
      username: "encargado.miraflores",
      passwordHash: defaultPasswordHash,
      displayName: "Encargado Sucursal Miraflores",
      role: "BRANCH_MANAGER" as const,
    },
    {
      id: "00000000-0000-4000-8000-000000000104",
      tenantId,
      username: "soporte.1",
      passwordHash: defaultPasswordHash,
      displayName: "Atención al Cliente 1",
      role: "SUPPORT_AGENT" as const,
    },
    {
      id: "00000000-0000-4000-8000-000000000105",
      tenantId,
      username: "rider.carlos",
      passwordHash: defaultPasswordHash,
      displayName: "Carlos Motorizado",
      role: "RIDER" as const,
    },
  ];

  for (const user of seedUsers) {
    await db
      .insert(schema.users)
      .values(user)
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          passwordHash: user.passwordHash,
          displayName: user.displayName,
          role: user.role,
        },
      });
  }

  // 3. Restaurante & Sucursal
  await db
    .insert(schema.restaurants)
    .values({
      id: restaurantId,
      tenantId,
      name: "Pollería El Rey Delivery",
      legalName: "Inversiones Gastronómicas El Rey S.A.C.",
      ruc: "20601234567",
      isActive: true,
    })
    .onConflictDoNothing({ target: schema.restaurants.id });

  await db
    .insert(schema.branches)
    .values({
      id: branchId,
      tenantId,
      restaurantId,
      name: "Sucursal Miraflores",
      slug: "miraflores",
      address: "Av. José Larco 1234, Miraflores, Lima",
      lat: "-12.121500",
      lng: "-77.029800",
      phone: "+51987654321",
      isOpenManual: true,
      isActive: true,
    })
    .onConflictDoNothing({ target: schema.branches.id });

  // 4. Acceso de usuario a sucursal (Encargado)
  await db
    .insert(schema.userBranchAccess)
    .values({
      userId: "00000000-0000-4000-8000-000000000103",
      branchId,
    })
    .onConflictDoNothing();

  // 5. Perfil de Rider & Billetera de Garantía
  await db
    .insert(schema.riders)
    .values({
      id: riderId,
      tenantId,
      userId: "00000000-0000-4000-8000-000000000105",
      fullName: "Carlos Motorizado",
      phone: "+51999888777",
      birthDate: "1995-05-15",
      fleetType: "OWN",
      vehicleType: "MOTO",
      status: "AVAILABLE",
      highTrust: true,
      trustScore: "4.95",
      isActive: true,
    })
    .onConflictDoNothing({ target: schema.riders.id });

  // Depósito inicial de garantía en el ledger (S/ 150.00 = 15000 céntimos)
  const existingWallet = await db
    .select()
    .from(schema.walletEntries)
    .where(eq(schema.walletEntries.riderId, riderId));

  if (existingWallet.length === 0) {
    await db.insert(schema.walletEntries).values({
      tenantId,
      riderId,
      type: "GUARANTEE_DEPOSIT",
      amountCents: 15000,
      reason: "Depósito inicial de garantía para pedidos en efectivo y prepago",
      actorId: "00000000-0000-4000-8000-000000000101",
    });
  }

  // 6. Settings
  for (const [key, value] of Object.entries(DEFAULT_TENANT_SETTINGS)) {
    await db
      .insert(schema.settings)
      .values({
        tenantId,
        key,
        value,
        isPlaceholder: PLACEHOLDER_SETTING_KEYS.has(key as keyof typeof DEFAULT_TENANT_SETTINGS),
      })
      .onConflictDoNothing();
  }

  logger.info("Seed data insertado exitosamente en base de datos", {
    tenantSlug: "zero-delivery",
    usersCount: seedUsers.length,
    restaurant: "Pollería El Rey Delivery",
    branch: "miraflores",
    rider: "rider.carlos",
  });

  await sql.end();
}

if (process.argv[1]?.endsWith("seed.ts")) {
  runDatabaseSeed().catch((err) => {
    logger.error("Error al ejecutar seed", { error: String(err) });
    process.exit(1);
  });
}
