import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FFMPEG, run } from "./bin";
import { probe, thumbnail } from "./index";
import { centerBetween, motionTrack } from "./reframe";
import { buildAss, outputDuration, render, type RenderParams } from "./render";

let dir: string;
const inputs = { audio: "", cover: "", clip: "" };
// Con FRAMES_DIR se guardan frames de cada render para mirarlos.
const framesDir = process.env.FRAMES_DIR;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "88render-test-"));
  inputs.audio = join(dir, "tema.wav");
  inputs.cover = join(dir, "portada.png");
  inputs.clip = join(dir, "estudio.mp4");
  await run(FFMPEG(), ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=110:beep_factor=4:duration=40", "-ac", "2", inputs.audio]);
  await run(FFMPEG(), [
    "-v", "error", "-f", "lavfi", "-i", "color=c=0x1E1EE6:s=1000x1000",
    "-vf", "drawbox=x=150:y=150:w=700:h=700:color=0xFF4D00:t=fill,drawbox=x=350:y=350:w=300:h=300:color=white:t=fill",
    "-frames:v", "1", inputs.cover,
  ]);
  // Plano apaisado con un cuadro que se mueve de izquierda a derecha (overlay sí evalúa t por cuadro).
  await run(FFMPEG(), [
    "-v", "error", "-f", "lavfi", "-i", "color=c=0x101010:s=1280x720:r=30:d=12", "-f", "lavfi", "-i", "color=c=0xFF4D00:s=200x200:r=30:d=12",
    "-filter_complex", "[0][1]overlay=x='40+t*90':y=260:shortest=1",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", inputs.clip,
  ]);
}, 120_000);

afterAll(() => rm(dir, { recursive: true, force: true }));

const base: Omit<RenderParams, "format" | "aspect"> = {
  version: 1,
  audio: { start: 4, duration: 7, speed: 1.03 },
  beat: { bpm: 128, offset: 0.2 },
  revealAt: 2.4,
  text: { overlay: "esperá el drop", artist: "Lumbre", title: "Bailo Sola" },
  accent: "#FF4D00",
  seed: 1,
  variant: "A",
};

async function check(p: RenderParams, name: string, clips?: string[]) {
  const out = join(dir, `${name}.mp4`);
  await render(p, { audio: inputs.audio, cover: inputs.cover, clips }, out);
  const info = await probe(out);
  if (framesDir) await thumbnail(out, join(framesDir, `${name}.jpg`), Math.min(outputDuration(p) - 0.5, p.revealAt + 0.6));
  return info;
}

describe("render", () => {
  it("hook 9:16 con cambio de velocidad", async () => {
    const info = await check({ ...base, format: "hook", aspect: "9:16", cover: { zoomFrom: 1, zoomTo: 1.08, pulse: 0.04 } }, "hook");
    expect([info.width, info.height]).toEqual([1080, 1920]);
    expect(Math.abs(info.durationSec - 7 / 1.03)).toBeLessThan(0.15);
    expect(info.hasAudio).toBe(true);
  }, 180_000);

  it("visualizer 1:1", async () => {
    const info = await check({ ...base, format: "visualizer", aspect: "1:1", audio: { start: 0, duration: 6, speed: 1 } }, "visualizer");
    expect([info.width, info.height]).toEqual([1080, 1080]);
    expect(Math.abs(info.durationSec - 6)).toBeLessThan(0.15);
  }, 180_000);

  it("lyric 9:16 con karaoke", async () => {
    const words = "esta noche bailo sola hasta que salga el sol".split(" ").map((w, i) => ({ word: w, start: 0.3 + i * 0.55, end: 0.75 + i * 0.55 }));
    const info = await check({ ...base, format: "lyric", aspect: "9:16", words, audio: { start: 0, duration: 6, speed: 1 } }, "lyric");
    expect([info.width, info.height]).toEqual([1080, 1920]);
  }, 180_000);

  it("bts: cortes al beat sobre material apaisado reencuadrado", async () => {
    const track = await motionTrack(inputs.clip);
    // El cuadro arranca a la izquierda y termina a la derecha: el encuadre lo sigue.
    expect(centerBetween(track, 0.5, 2)).toBeLessThan(0.35);
    expect(centerBetween(track, 9, 11)).toBeGreaterThan(0.6);
    const beat = 60 / 128;
    const segments = [0, 1, 2].map((i) => {
      const start = i * 4;
      return { clip: 0, start, duration: beat * 4, cx0: centerBetween(track, start, start + 0.5), cx1: centerBetween(track, start + 1.4, start + 1.9) };
    });
    const info = await check(
      { ...base, format: "bts", aspect: "9:16", segments, audio: { start: 2, duration: beat * 12, speed: 1 }, text: { ...base.text, overlay: "así nació" } },
      "bts",
      [inputs.clip],
    );
    expect([info.width, info.height]).toEqual([1080, 1920]);
    expect(Math.abs(info.durationSec - beat * 12)).toBeLessThan(0.2);
  }, 180_000);
});

describe("buildAss", () => {
  it("agrupa en líneas y usa \\kf con el acento", () => {
    const ass = buildAss(
      [
        { word: "uno", start: 0, end: 0.4 },
        { word: "dos", start: 0.5, end: 0.9 },
        { word: "tres", start: 2.5, end: 3 },
      ],
      1,
      1080,
      1920,
      "#FF4D00",
    );
    expect(ass.match(/^Dialogue:/gm)).toHaveLength(2);
    expect(ass).toContain("{\\kf40}uno");
    expect(ass).toContain("&H00004DFF");
  });
});
