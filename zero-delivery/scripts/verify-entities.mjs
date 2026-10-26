#!/usr/bin/env node
/**
 * Verifica que el mapeo TypeORM cubra TODAS las tablas del esquema canónico
 * (Hito 1). Falla si hay tablas sin entidad o entidades apuntando a tablas
 * inexistentes.
 *
 * Uso: pnpm --filter @zero-delivery/database build && node scripts/verify-entities.mjs
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..");
const require = createRequire(import.meta.url);

const { AppDataSource } = require(join(repoRoot, "packages/database/dist/index.js"));

try {
  await AppDataSource.initialize();

  const mapped = AppDataSource.entityMetadatas.map((m) => m.tableName).sort();
  const rows = await AppDataSource.query(
    "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1"
  );
  const tablas = rows.map((r) => r.table_name);

  const sinEntidad = tablas.filter((t) => !mapped.includes(t));
  const sinTabla = mapped.filter((t) => !tablas.includes(t));

  console.log(`entidades mapeadas : ${mapped.length}`);
  console.log(`tablas en la base  : ${tablas.length}`);
  console.log(`sin entidad        : ${sinEntidad.length ? sinEntidad.join(", ") : "(ninguna)"}`);
  console.log(`entidad sin tabla  : ${sinTabla.length ? sinTabla.join(", ") : "(ninguna)"}`);

  await AppDataSource.destroy();

  if (sinEntidad.length > 0 || sinTabla.length > 0) process.exit(1);
  console.log("Mapeo completo: 100% de las tablas tienen entidad.");
} catch (error) {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exit(2);
}
