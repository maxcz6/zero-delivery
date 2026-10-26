export type BranchShift = {
  dayOfWeek: number; // 0 (Dom) a 6 (Sáb)
  shiftNo: number;
  opensAt: string; // "HH:MM" o "HH:MM:SS"
  closesAt: string; // "HH:MM" o "HH:MM:SS" (puede cruzar medianoche si closesAt < opensAt)
};

function timeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(":");
  const h = Number(hStr ?? 0);
  const m = Number(mStr ?? 0);
  return h * 60 + m;
}

/**
 * Evalúa si una sucursal está abierta en el día y hora local de Lima indicados.
 * Respeta tanto `isActive` e `isOpenManual` como los turnos configurados en `branch_schedules`.
 */
export function isBranchOpenNow(params: {
  isActive: boolean;
  isOpenManual: boolean;
  schedules: BranchShift[];
  currentDayOfWeek: number; // 0..6 en America/Lima
  currentTimeHHMM: string; // "HH:MM" en America/Lima
}): boolean {
  if (!params.isActive || !params.isOpenManual) {
    return false;
  }
  if (params.schedules.length === 0) {
    return true; // Si aún no se definieron turnos restrictivos, se rige por isOpenManual
  }

  const nowMin = timeToMinutes(params.currentTimeHHMM);
  const prevDay = (params.currentDayOfWeek + 6) % 7;

  for (const shift of params.schedules) {
    const openMin = timeToMinutes(shift.opensAt);
    const closeMin = timeToMinutes(shift.closesAt);

    if (closeMin >= openMin) {
      // Turno dentro del mismo día
      if (shift.dayOfWeek === params.currentDayOfWeek && nowMin >= openMin && nowMin < closeMin) {
        return true;
      }
    } else {
      // Turno que cruza medianoche (ej. 18:00 a 02:00)
      if (shift.dayOfWeek === params.currentDayOfWeek && nowMin >= openMin) {
        return true;
      }
      if (shift.dayOfWeek === prevDay && nowMin < closeMin) {
        return true;
      }
    }
  }

  return false;
}
