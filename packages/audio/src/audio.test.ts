import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyzeTrack, findHook, type TrackAnalysis } from "./index";

const SR = 44100;

/** Tema sintético: intro con hi-hats y pad en La menor; a los 30 s entra el bombo (el drop). */
function synth(seconds: number, bpm: number, dropAt: number): Float32Array {
  const x = new Float32Array(seconds * SR);
  const beat = 60 / bpm;
  const chord = [220, 261.63, 329.63];
  for (let i = 0; i < x.length; i++) {
    const t = i / SR;
    const after = t >= dropAt;
    let v = 0;
    for (const f of chord) v += Math.sin(2 * Math.PI * f * t) * (after ? 0.09 : 0.05);
    // hi-hat en cada corchea: ruido corto
    const eighth = t % (beat / 2);
    if (eighth < 0.02) v += (Math.random() * 2 - 1) * 0.12 * (1 - eighth / 0.02);
    if (after) {
      const tb = t % beat;
      // bombo: seno grave con caída de tono y amplitud
      v += Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-tb * 30)) * tb) * Math.exp(-tb * 9) * 0.7;
    }
    x[i] = Math.max(-1, Math.min(1, v));
  }
  return x;
}

function wav(x: Float32Array): Buffer {
  const buf = Buffer.alloc(44 + x.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + x.length * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(x.length * 2, 40);
  for (let i = 0; i < x.length; i++) buf.writeInt16LE(Math.round(x[i]! * 32767), 44 + i * 2);
  return buf;
}

let dir: string;
let a: TrackAnalysis;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "88audio-"));
  const path = join(dir, "tema.wav");
  await writeFile(path, wav(synth(75, 128, 30)));
  a = await analyzeTrack(path);
}, 120_000);

afterAll(() => rm(dir, { recursive: true, force: true }));

describe("analyzeTrack", () => {
  it("detecta el tempo", () => {
    expect(Math.abs(a.bpm - 128)).toBeLessThan(1.5);
  });

  it("encuentra beats regulares", () => {
    const gaps = a.beats.slice(1).map((b, i) => b - a.beats[i]!);
    const median = gaps.sort((x, y) => x - y)[Math.floor(gaps.length / 2)]!;
    expect(Math.abs(median - 60 / 128)).toBeLessThan(0.02);
    expect(a.barStarts.length).toBeGreaterThan(30);
  });

  it("detecta la tonalidad", () => {
    expect(a.key.name).toBe("La menor");
    expect(a.key.camelot).toBe("8A");
  });

  it("encuentra el drop donde entra el bombo", () => {
    expect(a.drops.length).toBeGreaterThan(0);
    expect(Math.abs(a.drops[0]!.at - 30)).toBeLessThan(2);
  });

  it("propone fragmentos de 7, 15 y 30 s que muestran el drop", () => {
    for (const len of [7, 15, 30]) {
      const f = a.fragments.filter((x) => x.length === len);
      expect(f.length).toBeGreaterThan(0);
      expect(f[0]!.end - f[0]!.start).toBeCloseTo(len, 3);
    }
    const best7 = a.fragments.find((f) => f.length === 7)!;
    expect(best7.start).toBeLessThan(30);
    expect(best7.end).toBeGreaterThan(30);
    expect(best7.reason).toContain("drop");
  });

  it("arma la curva de energía", () => {
    const step = a.energyStep;
    const before = a.energy.slice(Math.round(10 / step), Math.round(25 / step));
    const after = a.energy.slice(Math.round(35 / step), Math.round(60 / step));
    const avg = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
    expect(avg(after)).toBeGreaterThan(avg(before) + 0.2);
  });
});

describe("findHook", () => {
  it("encuentra la frase que se repite", () => {
    const text = "ya no quiero verte más esta noche bailo sola esta noche bailo sola hasta que salga el sol".split(" ");
    const words = text.map((w, i) => ({ word: w, start: i, end: i + 0.8 }));
    expect(findHook(words)?.text).toBe("esta noche bailo sola");
  });
});
