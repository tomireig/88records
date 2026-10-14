// Tonalidad por correlación del croma promedio con los perfiles de Krumhansl-Kessler.
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NAMES = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
const SHORT = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
// Rueda Camelot: número por tónica para mayor (B) y menor (A).
const CAMELOT_MAJOR = [8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1];
const CAMELOT_MINOR = [5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10];

export interface KeyResult {
  tonic: number;
  mode: "major" | "minor";
  /** "La menor" */
  name: string;
  /** "Am" */
  short: string;
  /** "8A" */
  camelot: string;
  confidence: number;
}

function corr(a: number[], b: number[]): number {
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i]! - ma) * (b[i]! - mb);
    da += (a[i]! - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export function detectKey(chroma: Float32Array, weights: Float32Array): KeyResult {
  const frames = chroma.length / 12;
  const avg = new Array(12).fill(0);
  for (let f = 0; f < frames; f++) {
    let total = 0;
    for (let p = 0; p < 12; p++) total += chroma[f * 12 + p]!;
    if (!total) continue;
    const w = weights[f] ?? 1;
    for (let p = 0; p < 12; p++) avg[p] += (chroma[f * 12 + p]! / total) * w;
  }
  const scores: { tonic: number; mode: "major" | "minor"; r: number }[] = [];
  for (let t = 0; t < 12; t++) {
    const rot = (prof: number[]) => prof.map((_, i) => prof[(i - t + 12) % 12]!);
    scores.push({ tonic: t, mode: "major", r: corr(avg, rot(MAJOR)) });
    scores.push({ tonic: t, mode: "minor", r: corr(avg, rot(MINOR)) });
  }
  scores.sort((a, b) => b.r - a.r);
  const top = scores[0]!;
  const second = scores[1]!;
  return {
    tonic: top.tonic,
    mode: top.mode,
    name: `${NAMES[top.tonic]} ${top.mode === "major" ? "mayor" : "menor"}`,
    short: `${SHORT[top.tonic]}${top.mode === "minor" ? "m" : ""}`,
    camelot: `${(top.mode === "major" ? CAMELOT_MAJOR : CAMELOT_MINOR)[top.tonic]}${top.mode === "major" ? "B" : "A"}`,
    confidence: Math.max(0, Math.min(1, (top.r - second.r) * 5 + top.r * 0.5)),
  };
}
