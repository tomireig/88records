// Binarios de FFmpeg y ejecución.
import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import ffprobeStatic from "ffprobe-static";

// Por defecto, los binarios completos de ffmpeg-static (el ffmpeg del sistema puede venir recortado).
export const FFMPEG = () => process.env.FFMPEG_PATH || (ffmpegStatic as unknown as string | null) || "ffmpeg";
export const FFPROBE = () => process.env.FFPROBE_PATH || ffprobeStatic.path || "ffprobe";

export function run(bin: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) =>
      reject(new Error(`No se pudo ejecutar ${bin}: ${err.message}. Instalá FFmpeg o configurá FFMPEG_PATH/FFPROBE_PATH.`)),
    );
    child.on("close", (code) =>
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${bin} terminó con código ${code}: ${stderr.slice(-800)}`)),
    );
  });
}

