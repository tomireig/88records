// Formato de fechas en la zona del sello. Sirve en cliente y servidor.
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export { atLocal, dayKey, timeKey, weekDays, weekStart } from "@88/core/time";

export function fmt(iso: string | Date, tz: string, pattern: string): string {
  return format(new TZDate(new Date(iso), tz), pattern, { locale: es });
}

/** "mar 14 oct · 21:30" */
export function when(iso: string | Date, tz: string): string {
  return fmt(iso, tz, "EEE d MMM · HH:mm");
}

export function duration(sec: number | null): string {
  if (sec === null || Number.isNaN(sec)) return "—";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function bytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024 ** 2) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}
