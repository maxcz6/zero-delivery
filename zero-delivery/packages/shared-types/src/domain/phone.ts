/**
 * Normalización y validación de números celulares para Perú (E.164).
 * Formato: +519XXXXXXXX (9 dígitos móviles que inician en 9).
 */

const PERU_MOBILE_REGEX = /^\+519\d{8}$/;

/**
 * Normaliza una cadena de teléfono al formato estándar E.164 peruano.
 * Admite entradas como:
 * - "987654321" -> "+51987654321"
 * - "+51 987 654 321" -> "+51987654321"
 * - "51987654321" -> "+51987654321"
 */
export function normalizePeruPhone(raw: string): string {
  if (!raw) return "";
  // Quitar espacios, guiones y paréntesis
  let cleaned = raw.replace(/[\s\-\(\)]/g, "");

  // Si ya tiene el +, remover temporalmente para evaluar
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  }

  // Si empieza con código de país 51 y tiene 11 dígitos
  if (cleaned.startsWith("51") && cleaned.length === 11) {
    cleaned = cleaned.slice(2);
  }

  // Ahora debemos tener 9 dígitos empezando en 9
  if (cleaned.length === 9 && cleaned.startsWith("9")) {
    return `+51${cleaned}`;
  }

  // Si no calza con el formato estándar peruano, devolver con + si originalmente era internacional
  return raw.startsWith("+") ? raw : `+${cleaned}`;
}

/**
 * Valida si un teléfono cumple estrictamente con el estándar E.164 móvil de Perú.
 */
export function isValidPeruPhone(phone: string): boolean {
  return PERU_MOBILE_REGEX.test(phone);
}
