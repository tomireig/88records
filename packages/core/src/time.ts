// Fechas en la zona horaria de la organización. Todo se guarda en UTC y se muestra en la del sello.
import { TZDate } from "@date-fns/tz";
import { addDays, format, startOfWeek } from "date-fns";

export const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

/** "2026-10-13" en la zona dada. */
export function dayKey(date: Date, tz: string): string {
  return format(new TZDate(date, tz), "yyyy-MM-dd");
}

/** "21:30" en la zona dada. */
export function timeKey(date: Date, tz: string): string {
  return format(new TZDate(date, tz), "HH:mm");
}

/** Instante UTC para un día ("yyyy-MM-dd") y una hora ("HH:mm") locales. */
export function atLocal(day: string, time: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, tz).getTime());
}

/** Lunes 00:00 local de la semana que contiene `date`. */
export function weekStart(date: Date, tz: string): Date {
  return new Date(startOfWeek(new TZDate(date, tz), { weekStartsOn: 1 }).getTime());
}

/** Los 7 días ("yyyy-MM-dd") de la semana que arranca en `start`. */
export function weekDays(start: Date, tz: string): string[] {
  const base = new TZDate(start, tz);
  return Array.from({ length: 7 }, (_, i) => format(addDays(base, i), "yyyy-MM-dd"));
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
