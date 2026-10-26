/**
 * Utilidades para manejo de fechas y horas en UTC y presentación en America/Lima.
 */

export const DEFAULT_TIMEZONE = "America/Lima";

/**
 * Formatea una fecha UTC al formato local estándar de Perú: "dd/MM/yyyy HH:mm:ss".
 */
export function formatLimaDateTime(date: Date | string, timeZone = DEFAULT_TIMEZONE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-PE", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Formatea solo la fecha: "dd/MM/yyyy".
 */
export function formatLimaDate(date: Date | string, timeZone = DEFAULT_TIMEZONE): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("es-PE", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

/**
 * Devuelve la fecha operativa actual en formato ISO "YYYY-MM-DD" para America/Lima.
 */
export function getOperationalDateLima(date = new Date(), timeZone = DEFAULT_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // Retorna "YYYY-MM-DD"
}
