// Helpers para leer FormData sin repetir chequeos en cada action.

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(fd: FormData, key: string): string | null {
  return str(fd, key) || null;
}

export function optInt(fd: FormData, key: string): number | null {
  const s = str(fd, key).replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Math.round(Number(s));
  return Number.isFinite(n) ? n : null;
}

export function int(fd: FormData, key: string, fallback = 0): number {
  return optInt(fd, key) ?? fallback;
}

export function float(fd: FormData, key: string, fallback = 0): number {
  const s = str(fd, key).replace(",", ".");
  const n = Number(s);
  return s && Number.isFinite(n) ? n : fallback;
}

/** "mm:ss" o segundos a segundos. */
export function duration(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (!s) return null;
  const m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function list(fd: FormData, key: string): string[] {
  return str(fd, key)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
