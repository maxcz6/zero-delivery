/**
 * Normalización y validación de teléfonos E.164 (Perú +519XXXXXXXX), DNI y RUC.
 */

const PE_MOBILE_DIGITS_REGEX = /^9\d{8}$/;
const E164_REGEX = /^\+[1-9]\d{7,14}$/;
const DNI_REGEX = /^\d{8}$/;
const RUC_REGEX = /^(10|15|17|20)\d{9}$/;

/**
 * Normaliza un número de celular peruano a formato E.164 (+519XXXXXXXX).
 * Acepta entradas como "987 654 321", "+51 987-654-321", "51987654321".
 */
export function normalizePePhoneE164(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9 && PE_MOBILE_DIGITS_REGEX.test(digits)) {
    return `+51${digits}`;
  }
  if (digits.length === 11 && digits.startsWith("51")) {
    const localPart = digits.slice(2);
    if (PE_MOBILE_DIGITS_REGEX.test(localPart)) {
      return `+51${localPart}`;
    }
  }
  throw new Error(`Número móvil peruano inválido (debe tener 9 dígitos e iniciar en 9): ${raw}`);
}

export function isValidPeMobile(raw: string): boolean {
  try {
    normalizePePhoneE164(raw);
    return true;
  } catch {
    return false;
  }
}

export function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone);
}

export function isValidDni(dni: string): boolean {
  return DNI_REGEX.test(dni.trim());
}

export function isValidRuc(ruc: string): boolean {
  return RUC_REGEX.test(ruc.trim());
}
