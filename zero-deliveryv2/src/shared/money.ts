/**
 * Dinero en céntimos enteros (PEN - Soles peruanos).
 * Prohibido el uso de coma flotante para almacenamiento o sumas contables.
 */

export type Cents = number;

export function assertIntegerCents(value: number, label = "amountCents"): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} debe ser un entero seguro en céntimos, recibido: ${value}`);
  }
}

export function assertNonNegativeCents(value: number, label = "amountCents"): void {
  assertIntegerCents(value, label);
  if (value < 0) {
    throw new Error(`${label} no puede ser negativo: ${value}`);
  }
}

/**
 * Convierte un monto en Soles (ej. 15.5 o "15.50") a céntimos enteros (1550).
 * Usar solo en bordes de entrada de formularios.
 */
export function solesToCents(soles: number | string): Cents {
  const num = typeof soles === "string" ? Number(soles.trim()) : soles;
  if (!Number.isFinite(num)) {
    throw new Error(`Monto en soles inválido: ${soles}`);
  }
  return Math.round(num * 100);
}

/**
 * Formatea céntimos enteros como moneda peruana: "S/ 1,234.50" o "-S/ 45.00".
 */
export function formatPenCents(cents: number): string {
  assertIntegerCents(cents, "cents");
  const isNegative = cents < 0;
  const absCents = Math.abs(cents);
  const whole = Math.floor(absCents / 100);
  const fraction = String(absCents % 100).padStart(2, "0");
  const formattedWhole = whole.toLocaleString("en-US");
  return `${isNegative ? "-" : ""}S/ ${formattedWhole}.${fraction}`;
}
