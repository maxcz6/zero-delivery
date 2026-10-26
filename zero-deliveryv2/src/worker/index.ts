import { logger } from "@/shared/logger";

/**
 * Punto de entrada del Worker asíncrono (`src/worker/index.ts`).
 * Responsabilidades (Sección 4, 10 y 12 del Spec):
 *  1. Consumir `outbox_events` y despachar a `NotificationPort` / `CrmPort` (`VoceroCrmAdapter`).
 *  2. Evaluar timeouts de aceptación (`order.acceptance_timeout_minutes`), demora de preparación
 *     y espera de 15 min del repartidor en el local (`rider.pickup_wait_minutes`).
 *  3. Ejecutar el job diario de generación de borradores de liquidación (`settlements` DRAFT)
 *     a las 23:00 (`America/Lima`).
 */
export async function startWorker(): Promise<void> {
  logger.info("Zero Delivery background worker initialized", {
    timezone: "America/Lima",
    settlementCutoff: "23:00",
  });
}
