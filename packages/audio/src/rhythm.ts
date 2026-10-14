// Tempo por autocorrelación del envelope de ataques y beats por programación dinámica (Ellis, 2007).
import { FPS, smooth } from "./dsp";

function normalizedEnvelope(onset: Float32Array): Float32Array {
  const local = smooth(onset, Math.round(FPS * 0.5));
  const env = new Float32Array(onset.length);
  let max = 0;
  for (let i = 0; i < onset.length; i++) {
    env[i] = Math.max(0, onset[i]! - local[i]!);
    if (env[i]! > max) max = env[i]!;
  }
  if (max > 0) for (let i = 0; i < env.length; i++) env[i] = env[i]! / max;
  return env;
}

export function estimateTempo(onset: Float32Array): { bpm: number; confidence: number } {
  const env = normalizedEnvelope(onset);
  const n = env.length;
  const minLag = Math.floor((60 * FPS) / 200);
  const maxLag = Math.ceil((60 * FPS) / 60);
  const ac = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += env[i]! * env[i - lag]!;
    ac[lag] = s / (n - lag);
  }
  // Prior log-gaussiano centrado en 120 BPM (una octava de desvío), como librosa.
  let best = minLag;
  let bestScore = -Infinity;
  let total = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * FPS) / lag;
    const w = Math.exp(-0.5 * Math.log2(bpm / 120) ** 2);
    // Sumar la periodicidad del doble refuerza el pulso real frente a subdivisiones.
    const harmonic = lag * 2 <= maxLag + 1 ? 0.5 * ac[lag * 2]! : 0;
    const score = (ac[lag]! + harmonic) * w;
    total += Math.max(0, score);
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  // Interpolación parabólica para afinar el lag.
  const y0 = ac[best - 1]!;
  const y1 = ac[best]!;
  const y2 = ac[best + 1]!;
  const denom = y0 - 2 * y1 + y2;
  const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
  const lag = best + Math.max(-0.5, Math.min(0.5, shift));
  const bpm = (60 * FPS) / lag;
  return { bpm: Math.round(bpm * 10) / 10, confidence: total > 0 ? Math.min(1, (bestScore / total) * 20) : 0 };
}

/** Tiempos de beat en segundos. */
export function trackBeats(onset: Float32Array, bpm: number, tightness = 100): number[] {
  const env = normalizedEnvelope(onset);
  const n = env.length;
  const period = (60 * FPS) / bpm;
  const score = new Float64Array(n);
  const back = new Int32Array(n).fill(-1);
  const lo = Math.round(period / 2);
  const hi = Math.round(period * 2);
  for (let t = 0; t < n; t++) {
    let bestPrev = 0;
    let bestIdx = -1;
    for (let tau = t - hi; tau <= t - lo; tau++) {
      if (tau < 0) continue;
      const pen = -tightness * Math.log((t - tau) / period) ** 2;
      const s = score[tau]! + pen;
      if (bestIdx < 0 || s > bestPrev) {
        bestPrev = s;
        bestIdx = tau;
      }
    }
    score[t] = env[t]! + (bestIdx >= 0 ? Math.max(0, bestPrev) : 0);
    back[t] = bestPrev > 0 ? bestIdx : -1;
  }
  // Arranca del mejor puntaje en el último período y vuelve para atrás.
  let t = n - 1;
  let bestEnd = -Infinity;
  for (let i = Math.max(0, n - Math.round(period)); i < n; i++) {
    if (score[i]! > bestEnd) {
      bestEnd = score[i]!;
      t = i;
    }
  }
  const beats: number[] = [];
  while (t >= 0) {
    beats.push(t / FPS);
    t = back[t]!;
  }
  beats.reverse();
  // Completa beats faltantes al principio con el período estimado.
  const step = 60 / bpm;
  while (beats.length && beats[0]! - step > 0.05) beats.unshift(beats[0]! - step);
  return beats.map((b) => Math.round(b * 1000) / 1000);
}

/** Elige en qué beat arranca cada compás de 4: el que más bajo/bombo acumula. */
export function downbeatPhase(beats: number[], low: Float32Array): number {
  const at = (sec: number) => low[Math.min(low.length - 1, Math.round(sec * FPS))] ?? 0;
  let best = 0;
  let bestSum = -1;
  for (let phase = 0; phase < 4; phase++) {
    let s = 0;
    for (let i = phase; i < beats.length; i += 4) s += at(beats[i]!);
    if (s > bestSum) {
      bestSum = s;
      best = phase;
    }
  }
  return best;
}
