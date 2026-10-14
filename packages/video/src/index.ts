// Wrappers de FFmpeg. Corren en el worker (PC de Tomi), nunca en Vercel.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { FFMPEG, FFPROBE, run } from "./bin";

export { FFMPEG, FFPROBE, run };
export * from "./render";
export { motionTrack, centerBetween, type MotionTrack } from "./reframe";

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  hasAudio: boolean;
  videoCodec: string;
  fps: number;
}

export async function probe(path: string): Promise<ProbeResult> {
  const { stdout } = await run(FFPROBE(), ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path]);
  const info = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; avg_frame_rate?: string; side_data_list?: { rotation?: number }[]; tags?: { rotate?: string } }[];
  };
  const video = info.streams?.find((s) => s.codec_type === "video");
  if (!video) throw new Error("El archivo no tiene pista de video");
  // Los celulares graban apaisado y marcan la rotación: la tenemos en cuenta para saber si es vertical.
  const rotation = Math.abs(Number(video.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? video.tags?.rotate ?? 0));
  const swap = rotation === 90 || rotation === 270;
  const [num, den] = (video.avg_frame_rate ?? "0/1").split("/").map(Number);
  return {
    durationSec: Number(info.format?.duration ?? 0),
    width: (swap ? video.height : video.width) ?? 0,
    height: (swap ? video.width : video.height) ?? 0,
    hasAudio: Boolean(info.streams?.some((s) => s.codec_type === "audio")),
    videoCodec: video.codec_name ?? "",
    fps: den ? (num ?? 0) / den : 0,
  };
}

/** JPG de 360 px de ancho tomado cerca del primer segundo. */
export async function thumbnail(input: string, output: string, atSec = 1): Promise<void> {
  await run(FFMPEG(), ["-y", "-v", "error", "-ss", String(atSec), "-i", input, "-frames:v", "1", "-vf", "scale=360:-2", "-q:v", "4", output]);
}

export function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(path)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
  });
}
