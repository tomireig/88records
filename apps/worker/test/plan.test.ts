import type { TrackAnalysis } from "@88/audio";
import { describe, expect, it } from "vitest";
import { CAMPAIGN_DAYS, planPieces } from "../src/engine/plan";

const beats = Array.from({ length: 300 }, (_, i) => Math.round(i * (60 / 128) * 1000) / 1000);
const analysis: TrackAnalysis = {
  version: 1,
  durationSec: 140,
  bpm: 128,
  tempoConfidence: 0.9,
  beats,
  barStarts: beats.filter((_, i) => i % 4 === 0),
  key: { tonic: 9, mode: "minor", name: "La menor", short: "Am", camelot: "8A", confidence: 0.8 },
  energy: Array.from({ length: 280 }, (_, i) => (i > 60 ? 0.8 : 0.3)),
  energyStep: 0.5,
  drops: [{ at: 30, strength: 0.6 }],
  chorus: { start: 60, end: 75, repetition: 0.9, energy: 0.8 },
  fragments: [
    { length: 7, start: 28, end: 35, score: 0.9, reason: "Arranca 2 s antes del drop de 0:30." },
    { length: 15, start: 26, end: 41, score: 0.9, reason: "Arranca 4 s antes del drop de 0:30." },
    { length: 15, start: 60, end: 75, score: 0.8, reason: "Es la parte que más se repite del tema (1:00)." },
    { length: 30, start: 24, end: 54, score: 0.8, reason: "Arranca 6 s antes del drop de 0:30." },
  ],
  profile: { energyLevel: "alta", mood: "oscuro y enérgico", tempoFeel: "bailable" },
  words: [
    { word: "esta", start: 26.5, end: 26.8 },
    { word: "noche", start: 26.8, end: 27.2 },
    { word: "bailo", start: 27.3, end: 27.7 },
    { word: "sola", start: 27.7, end: 28.3 },
  ],
};

const clip = { durationSec: 20, centerAt: () => 0.5 };

describe("planPieces", () => {
  it("arma una pieza por día de campaña con portada y material crudo", () => {
    const pieces = planPieces({ analysis, artist: "Lumbre", title: "Bailo Sola", hasCover: true, clips: [clip] });
    expect(pieces.length).toBeGreaterThanOrEqual(CAMPAIGN_DAYS.length - 2);
    expect(new Set(pieces.map((p) => p.format))).toEqual(new Set(["hook", "visualizer", "bts", "lyric"]));
    // El lyric solo después del lanzamiento y con palabras dentro del tramo.
    for (const p of pieces.filter((p) => p.format === "lyric")) {
      expect(p.day).toBeGreaterThan(0);
      expect(p.params.words!.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("sin material crudo no hay BTS, y sin portada solo BTS", () => {
    expect(planPieces({ analysis, artist: "L", title: "T", hasCover: true, clips: [] }).some((p) => p.format === "bts")).toBe(false);
    const onlyRaw = planPieces({ analysis, artist: "L", title: "T", hasCover: false, clips: [clip] });
    expect(onlyRaw.length).toBeGreaterThan(0);
    expect(onlyRaw.every((p) => p.format === "bts")).toBe(true);
  });

  it("los BTS cortan cada 2 compases y cubren todo el tramo", () => {
    const bts = planPieces({ analysis, artist: "L", title: "T", hasCover: false, clips: [clip, clip] })[0]!;
    const total = bts.params.segments!.reduce((a, s) => a + s.duration, 0);
    expect(total).toBeCloseTo(bts.params.audio.duration / bts.params.audio.speed, 1);
    expect(bts.params.segments![0]!.duration).toBeCloseTo((60 / 128) * 8 / bts.params.audio.speed, 2);
  });

  it("el reveal cae en el drop y las variantes cambian la velocidad", () => {
    const pieces = planPieces({ analysis, artist: "L", title: "T", hasCover: true, clips: [] });
    const hook = pieces.find((p) => p.format === "hook" && p.params.audio.start === 28)!;
    expect(hook.params.revealAt).toBeCloseTo((30 - 28) / hook.params.audio.speed, 3);
    expect(new Set(pieces.map((p) => p.params.audio.speed)).size).toBeGreaterThan(1);
    expect(pieces.every((p) => !p.why.includes("con es"))).toBe(true);
  });
});
