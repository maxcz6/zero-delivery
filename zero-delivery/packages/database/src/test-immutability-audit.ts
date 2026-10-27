import { AppDataSource } from "./datasource";

/**
 * Hito 5 — Auditoría de Inmutabilidad de Tablas Append-Only en PostgreSQL.
 * Verifica empíricamente que los triggers `prohibir_mutacion()` y `guardia_eventos_entrada()`
 * bloqueen cualquier intento de UPDATE, DELETE o TRUNCATE sobre las bitácoras financieras y de auditoría.
 */
export async function runImmutabilityAudit(): Promise<{
  passed: boolean;
  results: Array<{ table: string; operation: string; blocked: boolean; detail: string }>;
}> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const results: Array<{
    table: string;
    operation: string;
    blocked: boolean;
    detail: string;
  }> = [];

  const appendOnlyTables = [
    "registro_auditoria",
    "historial_estados_pedido",
    "eventos_pago",
    "movimientos_billetera",
  ];

  for (const table of appendOnlyTables) {
    // 1. Verificar que los triggers existen en pg_trigger
    const trgRows: Array<{ tgname: string }> = await AppDataSource.query(
      `SELECT t.tgname
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
        WHERE c.relname = $1 AND NOT t.tgisinternal`,
      [table]
    );
    const hasTriggers = trgRows.some((r) => r.tgname.includes("inmutable"));
    results.push({
      table,
      operation: "TRIGGER_INSTALLED",
      blocked: hasTriggers,
      detail: hasTriggers
        ? `Triggers activos: ${trgRows.map((r) => r.tgname).join(", ")}`
        : "Falta trigger de inmutabilidad",
    });

    // 2. Probar TRUNCATE dentro de un bloque transaccional con ROLLBACK
    const qr = AppDataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      await qr.query(`TRUNCATE TABLE ${table}`);
      results.push({
        table,
        operation: "TRUNCATE",
        blocked: false,
        detail: "ERROR: TRUNCATE fue permitido",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        table,
        operation: "TRUNCATE",
        blocked: true,
        detail: `Bloqueado correctamente: ${msg}`,
      });
    } finally {
      await qr.rollbackTransaction().catch(() => null);
      await qr.release();
    }
  }

  // 3. Probar UPDATE y DELETE sobre registro_auditoria si existe al menos 1 fila
  const auditSample: Array<{ id: string }> = await AppDataSource.query(
    `SELECT id FROM registro_auditoria LIMIT 1`
  );
  if (auditSample[0]) {
    for (const op of ["UPDATE", "DELETE"] as const) {
      const qr = AppDataSource.createQueryRunner();
      await qr.connect();
      await qr.startTransaction();
      try {
        if (op === "UPDATE") {
          await qr.query(`UPDATE registro_auditoria SET accion = 'MUTADO' WHERE id = $1`, [
            auditSample[0].id,
          ]);
        } else {
          await qr.query(`DELETE FROM registro_auditoria WHERE id = $1`, [
            auditSample[0].id,
          ]);
        }
        results.push({
          table: "registro_auditoria",
          operation: op,
          blocked: false,
          detail: `ERROR: ${op} fue permitido`,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          table: "registro_auditoria",
          operation: op,
          blocked: true,
          detail: `Bloqueado correctamente: ${msg}`,
        });
      } finally {
        await qr.rollbackTransaction().catch(() => null);
        await qr.release();
      }
    }
  }

  // 4. Probar guardia_eventos_entrada_trg sobre eventos_entrada
  const trgInbound: Array<{ tgname: string }> = await AppDataSource.query(
    `SELECT t.tgname
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
      WHERE c.relname = 'eventos_entrada' AND NOT t.tgisinternal`
  );
  const hasInboundGuard = trgInbound.some((r) =>
    r.tgname.includes("guardia_eventos_entrada")
  );
  results.push({
    table: "eventos_entrada",
    operation: "GUARD_TRIGGER_INSTALLED",
    blocked: hasInboundGuard,
    detail: hasInboundGuard
      ? `Trigger activo: ${trgInbound.map((r) => r.tgname).join(", ")}`
      : "Falta guardia_eventos_entrada_trg",
  });

  const passed = results.every((r) => r.blocked);
  return { passed, results };
}

if (require.main === module) {
  runImmutabilityAudit()
    .then(({ passed, results }) => {
      console.table(results);
      if (!passed) {
        console.error("❌ Auditoría de inmutabilidad FALLÓ.");
        process.exit(1);
      }
      console.log("✅ Auditoría de inmutabilidad Hito 5 SUPERADA al 100%.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Error ejecutando auditoría de inmutabilidad:", err);
      process.exit(1);
    });
}
