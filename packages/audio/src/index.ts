// Análisis de un tema: todo lo que el motor de contenido necesita para cortar videos.
import { analyzeFrames, decode, SR } from "./dsp";
import { detectKey, type KeyResult } from "./key";
import { downbeatPhase, estimateTempo, trackBeats } from "./rhythm";
import { CURVE_STEP, detectChorus, detectDrops, energyCurve, pickFragments, type Drop, type Fragment, type Section } from "./structure";

export type { Drop, Fragment, KeyResult, Section };
export { CURVE_STEP };

export interface Word {
  word: string;
  start: number;
  end: number;
}

export interface TrackAnalysis {
  version: 1;
  durationSec: number;
  bpm: number;
  tempoConfidence: number;
  beats: number[];
  barStarts: number[];
  key: KeyResult;
  /** 0..1 cada CURVE_STEP segundos */
  energy: number[];
  energyStep: number;
  drops: Drop[];
  chorus: Section | null;
  fragments: Fragment[];
  profile: { energyLevel: "baja" | "media" | "alta"; mood: string; tempoFeel: string };
  words: Word[] | null;
}

function profile(bpm: number, key: KeyResult, energy: number[]): TrackAnalysis["profile"] {
  const avg = energy.reduce((a, b) => a + b, 0) / Math.max(1, energy.length);
  const energyLevel = avg > 0.62 ? "alta" : avg > 0.4 ? "media" : "baja";
  const tempoFeel = bpm < 90 ? "lento" : bpm < 110 ? "medio" : bpm < 135 ? "bailable" : "rápido";
  const minor = key.mode === "minor";
  const mood =
    energyLevel === "alta" ? (minor ? "oscuro y enérgico" : "eufórico") : energyLevel === "media" ? (minor ? "nocturno, con tensión" : "luminoso") : minor ? "melancólico" : "tranquilo";
  return { energyLevel, mood, tempoFeel };
}

export async function analyzeTrack(path: string, opts: { words?: Word[] | null; hookWords?: { start: number; end: number } | null } = {}): Promise<TrackAnalysis> {
  const x = await decode(path);
  const durationSec = x.length / SR;
  if (durationSec < 5) throw new Error("El audio dura menos de 5 segundos.");
  const frames = analyzeFrames(x);

  const { bpm, confidence } = estimateTempo(frames.onset);
  const beats = trackBeats(frames.onset, bpm);
  const phase = downbeatPhase(beats, frames.low);
  const barStarts = beats.filter((_, i) => i >= phase && (i - phase) % 4 === 0);

  const key = detectKey(frames.chroma, frames.rms);
  const energy = energyCurve(frames.rms);
  const drops = detectDrops(energy, frames, barStarts);
  const chorus = detectChorus(frames, barStarts, energy, durationSec);
  const fragments = pickFragments({ duration: durationSec, curve: energy, barStarts, drops, chorus, hookWords: opts.hookWords });

  return {
    version: 1,
    durationSec: Math.round(durationSec * 100) / 100,
    bpm,
    tempoConfidence: Math.round(confidence * 100) / 100,
    beats,
    barStarts,
    key,
    energy,
    energyStep: CURVE_STEP,
    drops,
    chorus,
    fragments,
    profile: profile(bpm, key, energy),
    words: opts.words ?? null,
  };
}

/** Recalcula los fragmentos cuando llega la transcripción (el hook de la letra suma puntos). */
export function withWords(a: TrackAnalysis, words: Word[], hookWords: { start: number; end: number } | null): TrackAnalysis {
  return {
    ...a,
    words,
    fragments: pickFragments({ duration: a.durationSec, curve: a.energy, barStarts: a.barStarts, drops: a.drops, chorus: a.chorus, hookWords }),
  };
}

/** La frase que más se repite en la letra: candidata a hook. */
export function findHook(words: Word[]): { start: number; end: number; text: string } | null {
  if (words.length < 8) return null;
  const norm = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");
  const counts = new Map<string, { n: number; first: number }>();
  for (let size = 4; size >= 3; size--) {
    for (let i = 0; i + size <= words.length; i++) {
      const key = words.slice(i, i + size).map((w) => norm(w.word)).join(" ");
      if (key.split(" ").some((k) => !k)) continue;
      const c = counts.get(key);
      if (c) c.n++;
      else counts.set(key, { n: 1, first: i });
    }
  }
  const best = [...counts.entries()].filter(([, v]) => v.n >= 2).sort((a, b) => b[1].n * b[0].length - a[1].n * a[0].length)[0];
  if (!best) return null;
  const size = best[0].split(" ").length;
  const slice = words.slice(best[1].first, best[1].first + size);
  return { start: slice[0]!.start, end: slice[slice.length - 1]!.end, text: slice.map((w) => w.word).join(" ") };
}
