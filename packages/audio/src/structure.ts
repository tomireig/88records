// Energía, drops, estribillo y mejores fragmentos para video corto.
import { FPS, percentile, smooth, type Frames } from "./dsp";

export const CURVE_STEP = 0.5; // segundos por punto de la curva de energía

export interface Drop {
  at: number;
  /** cuánto sube la energía (0..1) */
  strength: number;
}

export interface Section {
  start: number;
  end: number;
  /** 0..1: cuánto se repite este tramo en el tema */
  repetition: number;
  energy: number;
}

export interface Fragment {
  length: 7 | 15 | 30;
  start: number;
  end: number;
  score: number;
  reason: string;
}

/** Curva de energía 0..1 cada CURVE_STEP segundos (escala en dB, normalizada al percentil 98). */
export function energyCurve(rms: Float32Array): number[] {
  const per = Math.round(FPS * CURVE_STEP);
  const out: number[] = [];
  for (let i = 0; i < rms.length; i += per) {
    let s = 0;
    let c = 0;
    for (let j = i; j < Math.min(rms.length, i + per); j++) {
      s += rms[j]! ** 2;
      c++;
    }
    out.push(10 * Math.log10(s / Math.max(1, c) + 1e-10));
  }
  const hi = percentile(out, 0.98);
  const lo = Math.max(percentile(out, 0.02), hi - 40);
  return out.map((v) => Math.round(Math.max(0, Math.min(1, (v - lo) / Math.max(1e-6, hi - lo))) * 1000) / 1000);
}

function lowCurve(low: Float32Array): number[] {
  const per = Math.round(FPS * CURVE_STEP);
  const out: number[] = [];
  for (let i = 0; i < low.length; i += per) {
    let s = 0;
    let c = 0;
    for (let j = i; j < Math.min(low.length, i + per); j++, c++) s += low[j]!;
    out.push(s / Math.max(1, c));
  }
  const hi = percentile(out, 0.98) || 1;
  return out.map((v) => Math.min(1, v / hi));
}

const mean = (a: number[], from: number, to: number) => {
  let s = 0;
  let c = 0;
  for (let i = Math.max(0, from); i < Math.min(a.length, to); i++, c++) s += a[i]!;
  return c ? s / c : 0;
};

/** Momentos donde la energía y el bajo suben de golpe después de un tramo más bajo. */
export function detectDrops(curve: number[], frames: Frames, barStarts: number[]): Drop[] {
  const low = lowCurve(frames.low);
  const idx = (sec: number) => Math.round(sec / CURVE_STEP);
  const candidates = (barStarts.length ? barStarts : curve.map((_, i) => i * CURVE_STEP)).map((t) => {
    const i = idx(t);
    const before = 0.5 * mean(curve, i - 16, i - 2) + 0.5 * mean(low, i - 16, i - 2);
    const after = 0.5 * mean(curve, i, i + 8) + 0.5 * mean(low, i, i + 8);
    return { at: t, strength: after - before, after };
  });
  const out: Drop[] = [];
  for (const c of candidates.sort((a, b) => b.strength - a.strength)) {
    if (c.strength < 0.18 || c.after < 0.55) break;
    if (out.some((d) => Math.abs(d.at - c.at) < 20)) continue;
    out.push({ at: Math.round(c.at * 100) / 100, strength: Math.round(Math.min(1, c.strength) * 100) / 100 });
    if (out.length >= 4) break;
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Tramo de 8 compases que más se repite con energía alta: el estribillo (o el hook en temas instrumentales). */
export function detectChorus(frames: Frames, barStarts: number[], curve: number[], duration: number): Section | null {
  if (barStarts.length < 16) return null;
  const barFeat = barStarts.map((t, i) => {
    const a = Math.round(t * FPS);
    const b = Math.round((barStarts[i + 1] ?? duration) * FPS);
    const v = new Array(12).fill(0);
    for (let f = a; f < Math.min(b, frames.count); f++) for (let p = 0; p < 12; p++) v[p] += frames.chroma[f * 12 + p]!;
    const norm = Math.hypot(...v) || 1;
    return v.map((x) => x / norm);
  });
  const W = 8;
  const windows: Section[] = [];
  for (let i = 0; i + W <= barFeat.length; i += 2) {
    let best: number[] = [];
    for (let j = 0; j + W <= barFeat.length; j++) {
      if (Math.abs(j - i) < W) continue;
      let s = 0;
      for (let k = 0; k < W; k++) s += barFeat[i + k]!.reduce((acc, x, p) => acc + x * barFeat[j + k]![p]!, 0);
      best.push(s / W);
    }
    best = best.sort((a, b) => b - a).slice(0, 2);
    const start = barStarts[i]!;
    const end = barStarts[i + W] ?? duration;
    windows.push({
      start,
      end,
      repetition: best.length ? best.reduce((a, b) => a + b, 0) / best.length : 0,
      energy: mean(curve, Math.round(start / CURVE_STEP), Math.round(end / CURVE_STEP)),
    });
  }
  const scored = windows.map((w) => ({ w, s: w.repetition * 0.6 + w.energy * 0.4 })).sort((a, b) => b.s - a.s);
  const top = scored[0]?.w;
  return top ? { ...top, repetition: Math.round(top.repetition * 100) / 100, energy: Math.round(top.energy * 100) / 100 } : null;
}

function mmss(sec: number): string {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Los mejores arranques para 7, 15 y 30 segundos, alineados a compás. */
export function pickFragments(params: {
  duration: number;
  curve: number[];
  barStarts: number[];
  drops: Drop[];
  chorus: Section | null;
  hookWords?: { start: number; end: number } | null;
}): Fragment[] {
  const { duration, curve, barStarts, drops, chorus } = params;
  const starts = barStarts.length ? barStarts : Array.from({ length: Math.floor(duration / 2) }, (_, i) => i * 2);
  const out: Fragment[] = [];
  for (const length of [7, 15, 30] as const) {
    if (duration < length + 1) continue;
    const scored = starts
      .filter((s) => s + length <= duration - 0.5)
      .map((start) => {
        const end = start + length;
        const energy = mean(curve, Math.round(start / CURVE_STEP), Math.round(end / CURVE_STEP));
        // Lo ideal para un reveal: el drop entra entre el 15% y el 45% del clip.
        const drop = drops.find((d) => d.at >= start + length * 0.15 && d.at <= start + length * 0.45);
        const anyDrop = drops.find((d) => d.at > start && d.at < end);
        const chorusOverlap = chorus ? Math.max(0, Math.min(end, chorus.end) - Math.max(start, chorus.start)) / length : 0;
        const hook = params.hookWords && params.hookWords.start >= start && params.hookWords.end <= end;
        const score = 0.4 * energy + (drop ? 0.35 * (0.5 + drop.strength / 2) : anyDrop ? 0.12 : 0) + 0.2 * chorusOverlap + (hook ? 0.15 : 0);
        let reason: string;
        if (drop) reason = `Arranca ${Math.round(drop.at - start)} s antes del drop de ${mmss(drop.at)}: la tensión se resuelve dentro del clip.`;
        else if (hook) reason = `Contiene el hook de la letra completo.`;
        else if (chorusOverlap > 0.6) reason = `Es la parte que más se repite del tema (${mmss(chorus!.start)}).`;
        else if (anyDrop) reason = `Incluye el drop de ${mmss(anyDrop.at)}.`;
        else reason = `Uno de los tramos con más energía (${Math.round(energy * 100)}%).`;
        return { length, start, end, score, reason };
      })
      .sort((a, b) => b.score - a.score);
    const picked: Fragment[] = [];
    for (const c of scored) {
      if (picked.some((p) => Math.min(p.end, c.end) - Math.max(p.start, c.start) > length * 0.5)) continue;
      picked.push({ ...c, start: Math.round(c.start * 1000) / 1000, end: Math.round(c.end * 1000) / 1000, score: Math.round(c.score * 1000) / 1000 });
      if (picked.length === 3) break;
    }
    out.push(...picked);
  }
  return out;
}

export { smooth };
