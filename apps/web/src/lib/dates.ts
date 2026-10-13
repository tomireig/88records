// Todas las fechas de calendario se guardan a medianoche UTC y se muestran en UTC,
// así un "15/11" es 15/11 en cualquier máquina.

const DAY = 86_400_000;

/** Hoy según la hora de Argentina, como fecha UTC a medianoche. */
export function today(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return new Date(`${parts}T00:00:00.000Z`);
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY);
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / DAY);
}

/** "2026-11-20" del input type=date a Date UTC. */
export function parseDateInput(v: FormDataEntryValue | null): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T00:00:00.000Z`);
}

export function toDateInput(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

const fmtShort = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const fmtLong = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
const fmtWeekdayOnly = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", weekday: "short" });
const fmtMonth = new Intl.DateTimeFormat("es-AR", { timeZone: "UTC", month: "long", year: "numeric" });

export const fmt = {
  short: (d: Date) => fmtShort.format(d),
  long: (d: Date) => fmtLong.format(d),
  weekday: (d: Date) => `${fmtWeekdayOnly.format(d).replace(".", "")} ${fmtShort.format(d)}`,
  month: (d: Date) => fmtMonth.format(d),
};

/** "D−21", "D0", "D+14" */
export function dLabel(offset: number): string {
  if (offset === 0) return "D0";
  return offset < 0 ? `D−${Math.abs(offset)}` : `D+${offset}`;
}

/** "vence hoy", "hace 3 días", "en 2 días" */
export function relative(d: Date, ref = today()): string {
  const n = diffDays(d, ref);
  if (n === 0) return "hoy";
  if (n === 1) return "mañana";
  if (n === -1) return "ayer";
  return n < 0 ? `hace ${-n} días` : `en ${n} días`;
}
