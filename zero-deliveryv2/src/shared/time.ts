/**
 * Utilidades de fecha y hora centradas en America/Lima (UTC-05:00, sin horario de verano).
 * En base de datos todo se persiste en UTC (timestamptz).
 */

export const LIMA_TIMEZONE = "America/Lima" as const;

/**
 * Formatea una fecha UTC a formato peruano dd/MM/yyyy HH:mm (24h) en America/Lima.
 */
export function formatLimaDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}`;
}

/**
 * Devuelve la fecha operativa YYYY-MM-DD en America/Lima para un instante dado.
 */
export function getLimaBusinessDate(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Calcula la edad cumplida en años a partir de birthDate (YYYY-MM-DD) respecto a una fecha de referencia.
 */
export function calculateAgeYears(birthDateIso: string, referenceDate: Date = new Date()): number {
  const [yStr, mStr, dStr] = birthDateIso.split("-");
  const birthYear = Number(yStr);
  const birthMonth = Number(mStr);
  const birthDay = Number(dStr);
  if (!birthYear || !birthMonth || !birthDay) {
    throw new Error(`Fecha de nacimiento inválida: ${birthDateIso}`);
  }

  const refLima = getLimaBusinessDate(referenceDate);
  const [refYStr, refMStr, refDStr] = refLima.split("-");
  const refYear = Number(refYStr);
  const refMonth = Number(refMStr);
  const refDay = Number(refDStr);

  let age = refYear - birthYear;
  if (refMonth < birthMonth || (refMonth === birthMonth && refDay < birthDay)) {
    age -= 1;
  }
  return age;
}
