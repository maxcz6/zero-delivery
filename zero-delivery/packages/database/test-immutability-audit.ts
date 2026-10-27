import { runImmutabilityAudit } from "./src/test-immutability-audit";

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
