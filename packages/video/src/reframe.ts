// Reencuadre dinámico sin modelos: dónde hay movimiento en cada momento del clip.
// Se decodifica el video chico y en gris, se restan frames consecutivos y se busca el centro
// horizontal de la energía de movimiento. Alcanza para seguir a quien toca o canta en un plano.
import { spawn } from "node:child_process";
import { FFMPEG } from "./bin";

const W = 96;
const FPS = 4;

export interface MotionTrack {
  fps: number;
  /** centro horizontal del movimiento, 0..1, por frame analizado */
  centers: number[];
}

export function motionTrack(path: string, maxSeconds = 600): Promise<MotionTrack> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      FFMPEG(),
      ["-v", "error", "-t", String(maxSeconds), "-i", path, "-vf", `fps=${FPS},scale=${W}:-2,format=gray`, "-f", "rawvideo", "-"],
      { windowsHide: true },
    );
    const chunks: Buffer[] = [];
    let err = "";
    child.stdout.on("data", (c: Buffer) => chunks.push(c));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", async (code) => {
      if (code !== 0) return reject(new Error(`No se pudo analizar el movimiento: ${err.slice(-300)}`));
      const buf = Buffer.concat(chunks);
      // Alto real del frame: lo pedimos aparte para no adivinar el aspecto.
      const h = await frameHeight(path);
      const size = W * h;
      const frames = Math.floor(buf.length / size);
      const centers: number[] = [];
      let last = 0.5;
      for (let f = 1; f < frames; f++) {
        const col = new Float64Array(W);
        let total = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < W; x++) {
            const d = Math.abs(buf[f * size + y * W + x]! - buf[(f - 1) * size + y * W + x]!);
            if (d > 12) {
              col[x]! += d;
              total += d;
            }
          }
        }
        if (total < size * 0.5) {
          centers.push(last); // casi quieto: mantiene el encuadre anterior
          continue;
        }
        let acc = 0;
        for (let x = 0; x < W; x++) acc += col[x]! * x;
        last = acc / total / (W - 1);
        centers.push(last);
      }
      resolve({ fps: FPS, centers: smoothCenters(centers) });
    });
  });
}

function frameHeight(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG(), ["-v", "error", "-i", path, "-frames:v", "1", "-vf", `scale=${W}:-2,format=gray`, "-f", "rawvideo", "-"], { windowsHide: true });
    let n = 0;
    child.stdout.on("data", (c: Buffer) => (n += c.length));
    child.on("error", reject);
    child.on("close", () => resolve(Math.max(2, Math.round(n / W))));
  });
}

function smoothCenters(c: number[]): number[] {
  const r = 3;
  return c.map((_, i) => {
    let s = 0;
    let n = 0;
    for (let j = Math.max(0, i - r); j <= Math.min(c.length - 1, i + r); j++, n++) s += c[j]!;
    return n ? s / n : 0.5;
  });
}

/** Centro promedio del movimiento entre dos tiempos del clip. */
export function centerBetween(track: MotionTrack, start: number, end: number): number {
  const a = Math.max(0, Math.floor(start * track.fps));
  const b = Math.min(track.centers.length, Math.ceil(end * track.fps));
  if (b <= a) return track.centers[Math.min(track.centers.length - 1, a)] ?? 0.5;
  let s = 0;
  for (let i = a; i < b; i++) s += track.centers[i]!;
  return s / (b - a);
}
