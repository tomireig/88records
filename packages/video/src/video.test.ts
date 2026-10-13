import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FFMPEG, probe, run, sha256File, thumbnail } from "./index";

let dir: string;
let clip: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "88video-"));
  clip = join(dir, "clip.mp4");
  await run(FFMPEG(), [
    "-v", "error", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30", "-f", "lavfi", "-i", "sine=frequency=440",
    "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", clip,
  ]);
}, 60_000);

afterAll(() => rm(dir, { recursive: true, force: true }));

describe("video", () => {
  it("lee duración, tamaño y audio", async () => {
    const p = await probe(clip);
    expect(p.width).toBe(720);
    expect(p.height).toBe(1280);
    expect(p.durationSec).toBeGreaterThan(2.9);
    expect(p.hasAudio).toBe(true);
    expect(Math.round(p.fps)).toBe(30);
  });

  it("genera la miniatura", async () => {
    const out = join(dir, "thumb.jpg");
    await thumbnail(clip, out);
    expect((await stat(out)).size).toBeGreaterThan(1000);
  });

  it("calcula el hash", async () => {
    expect(await sha256File(clip)).toMatch(/^[a-f0-9]{64}$/);
  });
});
