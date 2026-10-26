/**
 * Módulo de manejo monetario en céntimos enteros (PEN).
 * Regla de negocio: CERO uso de números flotantes para dinero.
 * S/ 12.50 = 1250 céntimos.
 */

export type Cents = number;

/**
 * Convierte un importe en Soles a céntimos enteros.
 */
export function solesToCents(soles: number): Cents {
  if (!Number.isFinite(soles)) {
    throw new TypeError(`El valor en soles debe ser un número finito: ${soles}`);
  }
  return Math.round(soles * 100);
}

/**
 * Convierte céntimos a soles decimales (solo para visualización o exportación).
 */
export function centsToSoles(cents: Cents | bigint): number {
  const numericCents = typeof cents === "bigint" ? Number(cents) : cents;
  return numericCents / 100;
}

/**
 * Formatea céntimos al estándar monetario de Perú: "S/ 12.50".
 */
export function formatPen(cents: Cents | bigint): string {
  const soles = centsToSoles(cents);
  return `S/ ${soles.toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Valida que un valor sea un número entero de céntimos no negativo.
 */
export function isValidCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Asegura que el valor sea un entero de céntimos válido.
 */
export function assertValidCents(value: unknown, fieldName = "Monto"): asserts value is Cents {
  if (!isValidCents(value)) {
    throw new TypeError(`${fieldName} debe ser un número entero no negativo de céntimos. Recibido: ${String(value)}`);
  }
}
