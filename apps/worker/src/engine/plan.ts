// Plan de contenido de un lanzamiento: qué piezas renderizar y en qué día de la campaña va cada una.
// Es lógica pura: recibe el análisis del tema y devuelve RenderParams listos para el worker.
import type { TrackAnalysis } from "@88/audio";
import type { RenderFormat, RenderParams, RenderSegment } from "@88/video";

export interface PlanInput {
  analysis: TrackAnalysis;
  artist: string;
  title: string;
  hasCover: boolean;
  /** clips crudos con su duración y su recorrido de movimiento ya calculado */
  clips: { durationSec: number; centerAt: (start: number, end: number) => number }[];
  accent?: string;
}

export interface PlannedPiece {
  day: number;
  format: RenderFormat;
  params: RenderParams;
  /** por qué este formato ese día, para la bandeja */
  why: string;
}

/** Días de la campaña con contenido: más denso alrededor del lanzamiento. */
export const CAMPAIGN_DAYS = [-14, -12, -10, -8, -6, -4, -3, -2, -1, 0, 0, 1, 2, 3, 5, 7, 9, 11, 14, 17, 20, 24, 27, 30];

const SPEEDS = [1, 1.02, 0.98, 1.03, 0.97];

function phaseOf(day: number) {
  return day < 0 ? "pre" : day === 0 ? "release" : "post";
}

/** Qué formatos tienen sentido en cada fase, según lo que hay disponible. */
function formatsFor(day: number, input: PlanInput): RenderFormat[] {
  const words = (input.analysis.words?.length ?? 0) > 0;
  const bts = input.clips.length > 0;
  const cover = input.hasCover;
  const phase = phaseOf(day);
  const list: RenderFormat[] = [];
  if (phase === "pre") {
    if (cover) list.push("hook", "hook");
    if (bts) list.push("bts");
    if (cover) list.push("visualizer");
  } else if (phase === "release") {
    if (cover) list.push("hook", "visualizer");
    if (bts) list.push("bts");
  } else {
    if (words && cover) list.push("lyric");
    if (cover) list.push("hook", "visualizer");
    if (bts) list.push("bts");
    if (words && cover) list.push("lyric");
  }
  return list;
}

function mmss(sec: number) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function planPieces(input: PlanInput): PlannedPiece[] {
  const a = input.analysis;
  const accent = input.accent ?? "#FF4D00";
  const counters = new Map<string, number>();
  const out: PlannedPiece[] = [];

  CAMPAIGN_DAYS.forEach((day, i) => {
    const options = formatsFor(day, input);
    if (!options.length) return;
    const format = options[i % options.length]!;
    const n = counters.get(format) ?? 0;
    counters.set(format, n + 1);

    // Duraciones: los teasers cortos antes del lanzamiento; más largos después.
    const length = format === "lyric" ? 15 : phaseOf(day) === "pre" ? (n % 2 === 0 ? 7 : 15) : n % 3 === 2 ? 30 : 15;
    const frags = a.fragments.filter((f) => f.length === length);
    const frag = frags[n % Math.max(1, frags.length)] ?? a.fragments[0];
    if (!frag) return;
    const speed = SPEEDS[n % SPEEDS.length]!;
    const start = frag.start;
    const duration = Math.min(frag.end - frag.start, a.durationSec - start);

    // Drop o arranque del estribillo dentro del clip, en tiempo de salida.
    const drop = a.drops.find((d) => d.at > start + 0.5 && d.at < start + duration - 1);
    const revealAt = drop ? (drop.at - start) / speed : Math.min(2.5, duration * 0.3) / speed;
    const firstBeat = a.beats.find((b) => b >= start) ?? start;

    const params: RenderParams = {
      version: 1,
      format,
      aspect: "9:16",
      audio: { start, duration, speed },
      beat: { bpm: a.bpm, offset: firstBeat - start },
      revealAt,
      cover: { zoomFrom: n % 2 ? 1.08 : 1, zoomTo: n % 2 ? 1 : 1.08, pulse: format === "hook" ? 0.035 : 0.02 },
      text: { overlay: "", artist: input.artist, title: input.title },
      accent,
      seed: i + 1,
      variant: String.fromCharCode(65 + (n % 26)),
    };

    if (format === "lyric") {
      params.words = (a.words ?? [])
        .filter((w) => w.start >= start && w.end <= start + duration)
        .map((w) => ({ word: w.word, start: w.start - start, end: w.end - start }));
      if (params.words.length < 3) return;
    }

    if (format === "bts") {
      // Cortes cada 2 compases, rotando clips y arrancando en distintos momentos de cada uno.
      const barSec = (60 / a.bpm) * 4;
      const cut = (barSec * 2) / speed;
      const total = duration / speed;
      const segments: RenderSegment[] = [];
      let t = 0;
      let k = 0;
      while (t < total - 0.05) {
        const d = Math.min(cut, total - t);
        const clipIdx = (n + k) % input.clips.length;
        const clip = input.clips[clipIdx]!;
        const room = Math.max(0, clip.durationSec - d - 0.2);
        const offset = room > 0 ? ((i * 7.3 + k * 3.1) % room) : 0;
        segments.push({
          clip: clipIdx,
          start: Math.round(offset * 1000) / 1000,
          duration: Math.round(d * 1000) / 1000,
          cx0: clip.centerAt(offset, offset + Math.min(1, d)),
          cx1: clip.centerAt(Math.max(offset, offset + d - 1), offset + d),
        });
        t += d;
        k++;
      }
      params.segments = segments;
    }

    const why =
      format === "hook"
        ? drop
          ? `Hook con el drop de ${mmss(drop.at)}: la tensión se resuelve en el clip.`
          : `Hook desde ${mmss(start)}. ${frag.reason}`
        : format === "visualizer"
          ? `Visualizer de ${length} s sobre la portada, para que el sonido se reconozca.`
          : format === "lyric"
            ? `Lyric video con la letra transcripta, karaoke al ritmo de la voz.`
            : `Detrás de escena con cortes al beat (${Math.round(a.bpm)} BPM) y encuadre que sigue el movimiento.`;

    out.push({ day, format, params, why });
  });
  return out;
}
