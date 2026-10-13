// "Autollenar semana": reparte los videos pendientes en los huecos libres de cada cuenta,
// respetando franjas preferidas, tope diario y sin repetir el mismo archivo entre cuentas.
// Es lógica pura: el panel le pasa el estado y convierte el resultado en acciones propuestas.
import { atLocal, dayKey, weekDays } from "./time";

export interface AutofillAccount {
  id: string;
  artistId: string | null;
  preferredSlots: string[];
  maxPostsPerDay: number;
}

export interface AutofillVideo {
  id: string;
  artistId: string | null;
  sha256: string | null;
}

export interface Occupied {
  accountId: string;
  at: Date;
}

export interface AutofillInput {
  weekStart: Date;
  tz: string;
  now: Date;
  accounts: AutofillAccount[];
  videos: AutofillVideo[];
  /** Publicaciones programadas y propuestas que ya ocupan lugar. */
  occupied: Occupied[];
  /** Hashes que ya están programados o publicados en alguna cuenta. */
  usedHashes: Set<string>;
}

export interface Assignment {
  accountId: string;
  videoId: string;
  at: Date;
}

const MIN_GAP_MS = 45 * 60_000;
const MIN_LEAD_MS = 15 * 60_000;

export function autofillWeek(input: AutofillInput): Assignment[] {
  const { tz, now } = input;
  const days = weekDays(input.weekStart, tz);

  const perDay = new Map<string, number>(); // `${accountId}|${day}` → cantidad
  const taken = new Map<string, number[]>(); // accountId → instantes ocupados
  for (const o of input.occupied) {
    const k = `${o.accountId}|${dayKey(o.at, tz)}`;
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
    taken.set(o.accountId, [...(taken.get(o.accountId) ?? []), o.at.getTime()]);
  }

  // Huecos libres por cuenta, en orden cronológico.
  const free = new Map<string, Date[]>();
  for (const acc of input.accounts) {
    const slots = [...new Set(acc.preferredSlots)].sort();
    const busy = taken.get(acc.id) ?? [];
    const list: Date[] = [];
    for (const day of days) {
      for (const slot of slots) {
        const at = atLocal(day, slot, tz);
        if (at.getTime() < now.getTime() + MIN_LEAD_MS) continue;
        if (busy.some((t) => Math.abs(t - at.getTime()) < MIN_GAP_MS)) continue;
        list.push(at);
      }
    }
    free.set(acc.id, list);
  }

  const capacity = (acc: AutofillAccount, extra: Map<string, number>): number => {
    let total = 0;
    for (const day of days) {
      const slotsThatDay = (free.get(acc.id) ?? []).filter((d) => dayKey(d, tz) === day).length;
      const used = (perDay.get(`${acc.id}|${day}`) ?? 0) + (extra.get(`${acc.id}|${day}`) ?? 0);
      total += Math.max(0, Math.min(acc.maxPostsPerDay - used, slotsThatDay));
    }
    return total;
  };

  // 1) Elegir cuenta para cada video: mismo artista primero, después la más libre.
  const chosen = new Map<string, AutofillVideo[]>();
  const usedHashes = new Set(input.usedHashes);
  const reserved = new Map<string, number>();
  for (const video of input.videos) {
    if (video.sha256 && usedHashes.has(video.sha256)) continue;
    const candidates = input.accounts
      .filter((a) => !a.artistId || !video.artistId || a.artistId === video.artistId)
      .map((a) => ({ a, left: capacity(a, new Map()) - (reserved.get(a.id) ?? 0) }))
      .filter((c) => c.left > 0)
      .sort((x, y) => {
        const mx = Number(x.a.artistId !== null && x.a.artistId === video.artistId);
        const my = Number(y.a.artistId !== null && y.a.artistId === video.artistId);
        return my - mx || y.left - x.left;
      });
    const pick = candidates[0];
    if (!pick) continue;
    chosen.set(pick.a.id, [...(chosen.get(pick.a.id) ?? []), video]);
    reserved.set(pick.a.id, (reserved.get(pick.a.id) ?? 0) + 1);
    if (video.sha256) usedHashes.add(video.sha256);
  }

  // 2) Repartir los videos de cada cuenta parejo a lo largo de la semana.
  const out: Assignment[] = [];
  for (const acc of input.accounts) {
    const videos = chosen.get(acc.id) ?? [];
    if (!videos.length) continue;
    const slots = free.get(acc.id) ?? [];
    const extra = new Map<string, number>();
    const usedIdx = new Set<number>();
    const fits = (i: number) => {
      const day = dayKey(slots[i]!, tz);
      const k = `${acc.id}|${day}`;
      return !usedIdx.has(i) && (perDay.get(k) ?? 0) + (extra.get(k) ?? 0) < acc.maxPostsPerDay;
    };
    videos.forEach((video, i) => {
      const ideal = Math.floor((i * slots.length) / videos.length);
      let idx = -1;
      for (let step = 0; step < slots.length && idx < 0; step++) {
        const j = (ideal + step) % slots.length;
        if (fits(j)) idx = j;
      }
      if (idx < 0) return;
      usedIdx.add(idx);
      const at = slots[idx]!;
      const k = `${acc.id}|${dayKey(at, tz)}`;
      extra.set(k, (extra.get(k) ?? 0) + 1);
      out.push({ accountId: acc.id, videoId: video.id, at });
    });
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}
