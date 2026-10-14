// Señal: decodificación, FFT y features por frame. Sin dependencias: FFmpeg decodifica y el resto es TS.
import { spawn } from "node:child_process";
import { FFMPEG } from "@88/video";

export const SR = 22050;
export const FRAME = 2048;
export const HOP = 512;
export const FPS = SR / HOP;

/** Audio mono en float32 (22.05 kHz por defecto; Whisper usa 16 kHz). */
export function decode(path: string, maxSeconds = 900, sampleRate = SR): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG(), ["-v", "error", "-i", path, "-t", String(maxSeconds), "-ac", "1", "-ar", String(sampleRate), "-f", "f32le", "-"], {
      windowsHide: true,
    });
    const chunks: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`No se pudo decodificar el audio: ${err.slice(-300)}`));
      const buf = Buffer.concat(chunks);
      const out = new Float32Array(buf.length / 4);
      for (let i = 0; i < out.length; i++) out[i] = buf.readFloatLE(i * 4);
      resolve(out);
    });
  });
}

/** FFT radix-2 in place. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export interface Frames {
  count: number;
  /** RMS por frame */
  rms: Float32Array;
  /** Energía por debajo de 150 Hz (bombo y bajo) */
  low: Float32Array;
  /** Flujo espectral: fuerza de ataque por frame */
  onset: Float32Array;
  /** Croma: 12 valores por frame */
  chroma: Float32Array;
}

export function analyzeFrames(x: Float32Array): Frames {
  const count = Math.max(1, Math.floor((x.length - FRAME) / HOP) + 1);
  const rms = new Float32Array(count);
  const low = new Float32Array(count);
  const onset = new Float32Array(count);
  const chroma = new Float32Array(count * 12);

  const win = new Float64Array(FRAME);
  for (let i = 0; i < FRAME; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1));

  const bins = FRAME / 2 + 1;
  const binHz = SR / FRAME;
  const lowMax = Math.floor(150 / binHz);
  // Clase de altura de cada bin entre ~65 Hz y ~2 kHz.
  const pc = new Int8Array(bins).fill(-1);
  for (let k = Math.ceil(65 / binHz); k < Math.min(bins, Math.floor(2000 / binHz)); k++) {
    const midi = 69 + 12 * Math.log2((k * binHz) / 440);
    pc[k] = ((Math.round(midi) % 12) + 12) % 12;
  }

  const re = new Float64Array(FRAME);
  const im = new Float64Array(FRAME);
  let prev = new Float64Array(bins);
  let cur = new Float64Array(bins);

  for (let f = 0; f < count; f++) {
    const off = f * HOP;
    let sum = 0;
    for (let i = 0; i < FRAME; i++) {
      const v = x[off + i] ?? 0;
      sum += v * v;
      re[i] = v * win[i]!;
      im[i] = 0;
    }
    rms[f] = Math.sqrt(sum / FRAME);
    fft(re, im);

    let flux = 0;
    let lowE = 0;
    for (let k = 0; k < bins; k++) {
      const mag = Math.hypot(re[k]!, im[k]!);
      const lm = Math.log1p(100 * mag);
      cur[k] = lm;
      const d = lm - prev[k]!;
      if (d > 0) flux += d;
      if (k <= lowMax) lowE += mag * mag;
      const p = pc[k]!;
      if (p >= 0) chroma[f * 12 + p]! += mag;
    }
    onset[f] = f === 0 ? 0 : flux;
    low[f] = Math.sqrt(lowE);
    [prev, cur] = [cur, prev];
  }
  return { count, rms, low, onset, chroma };
}

/** Media móvil centrada. */
export function smooth(a: ArrayLike<number>, radius: number): Float32Array {
  const out = new Float32Array(a.length);
  let acc = 0;
  const q: number[] = [];
  for (let i = 0; i < a.length + radius; i++) {
    if (i < a.length) {
      acc += a[i]!;
      q.push(a[i]!);
    }
    if (q.length > 2 * radius + 1) acc -= q.shift()!;
    const c = i - radius;
    if (c >= 0 && c < a.length) out[c] = acc / q.length;
  }
  return out;
}

export function percentile(a: ArrayLike<number>, p: number): number {
  const s = Array.from(a).sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] ?? 0;
}
