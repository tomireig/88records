// Motor de render: arma cada pieza con FFmpeg a partir de RenderParams.
// Los parámetros se guardan con el video para poder rehacerlo o sacar una variante.
import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FFMPEG } from "./bin";

export type RenderFormat = "hook" | "visualizer" | "lyric" | "bts";
export type Aspect = "9:16" | "1:1";

export interface RenderWord {
  word: string;
  start: number;
  end: number;
}

export interface RenderSegment {
  /** índice en inputs.clips */
  clip: number;
  /** segundo del clip crudo donde arranca */
  start: number;
  /** duración en el video final */
  duration: number;
  /** centro del encuadre al principio y al final del tramo (0..1) */
  cx0: number;
  cx1: number;
}

export interface RenderParams {
  version: 1;
  format: RenderFormat;
  aspect: Aspect;
  /** tramo del tema: segundo de inicio y duración en el tema original */
  audio: { start: number; duration: number; speed: number };
  /** pulso al beat: BPM y primer beat relativo al inicio del tramo */
  beat: { bpm: number; offset: number };
  /** segundo (del video final) en que entra el drop / el reveal */
  revealAt: number;
  cover?: { zoomFrom: number; zoomTo: number; pulse: number };
  segments?: RenderSegment[];
  text: { overlay: string; artist: string; title: string };
  /** palabras relativas al inicio del tramo, para el karaoke */
  words?: RenderWord[];
  accent: string;
  seed: number;
  variant: string;
}

export interface RenderInputs {
  audio: string;
  cover?: string | null;
  clips?: string[];
}

export const SIZES: Record<Aspect, { w: number; h: number }> = {
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
};

const FONTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../assets/fonts");

/** Duración final del video en segundos. */
export function outputDuration(p: RenderParams): number {
  return Math.round((p.audio.duration / p.audio.speed) * 1000) / 1000;
}

const n = (v: number) => (Math.round(v * 10000) / 10000).toString();

function hexToFfmpeg(hex: string): string {
  return `0x${hex.replace("#", "").toUpperCase()}`;
}

/** BGR para ASS: #FF4D00 → &H00004DFF */
function hexToAss(hex: string): string {
  const h = hex.replace("#", "");
  return `&H00${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`.toUpperCase();
}

function audioChain(p: RenderParams, label: string, extra = ""): string {
  const T = outputDuration(p);
  return (
    `[0:a]atrim=start=${n(p.audio.start)}:duration=${n(p.audio.duration)},asetpts=PTS-STARTPTS,` +
    `atempo=${n(p.audio.speed)},afade=t=in:d=0.04,afade=t=out:st=${n(Math.max(0, T - 0.6))}:d=0.6${extra}${label}`
  );
}

function coverBackground(input: string, w: number, h: number, out: string): string {
  return `[${input}]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=40:2,eq=brightness=-0.28:saturation=1.25,setsar=1${out}`;
}

function text(file: string, font: string, size: number, x: string, y: string, extra = ""): string {
  return `drawtext=textfile=${file}:fontfile=fonts/${font}:fontsize=${size}:fontcolor=white:x=${x}:y=${y}:shadowcolor=black@0.45:shadowy=4${extra}`;
}

/** Arma el ASS del karaoke: líneas de hasta 4 palabras, se pintan con el acento mientras suenan. */
export function buildAss(words: RenderWord[], speed: number, w: number, h: number, accent: string): string {
  const lines: RenderWord[][] = [];
  let cur: RenderWord[] = [];
  for (const word of words) {
    const prev = cur[cur.length - 1];
    if (cur.length >= 4 || (prev && word.start - prev.end > 0.6)) {
      lines.push(cur);
      cur = [];
    }
    cur.push(word);
  }
  if (cur.length) lines.push(cur);
  const ts = (sec: number) => {
    const s = Math.max(0, sec / speed);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = Math.floor(s % 60);
    const cs = Math.floor((s % 1) * 100);
    return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  };
  const clean = (t: string) => t.replace(/[{}\\]/g, "");
  const events = lines.map((line) => {
    const start = line[0]!.start - 0.15;
    const end = line[line.length - 1]!.end + 0.4;
    let cursor = start;
    const body = line
      .map((word) => {
        const lead = Math.max(0, Math.round(((word.start - cursor) / speed) * 100));
        const dur = Math.max(1, Math.round(((word.end - word.start) / speed) * 100));
        cursor = word.end;
        return `${lead ? `{\\k${lead}}` : ""}{\\kf${dur}}${clean(word.word)} `;
      })
      .join("")
      .trim();
    return `Dialogue: 0,${ts(start)},${ts(end)},Letra,,0,0,0,,${body}`;
  });
  const size = Math.round(h * (w === h ? 0.07 : 0.052));
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Letra,Geist,${size},${hexToAss(accent)},&H00FFFFFF,&H64000000,&H96000000,-1,0,0,0,100,100,0,0,1,3,2,5,${Math.round(w * 0.08)},${Math.round(w * 0.08)},0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}

interface Plan {
  args: string[];
  files: Record<string, string>;
}

/** Argumentos de FFmpeg para la pieza. Las rutas de fuentes y textos son relativas al directorio de trabajo. */
export function planRender(p: RenderParams, inputs: RenderInputs, out: string): Plan {
  const { w, h } = SIZES[p.aspect];
  const T = outputDuration(p);
  const files: Record<string, string> = {
    "overlay.txt": p.text.overlay,
    "artist.txt": p.text.artist,
    "title.txt": p.text.title,
  };
  const args = ["-y", "-v", "error", "-i", inputs.audio];
  const filters: string[] = [];
  const reveal = Math.min(Math.max(0.3, p.revealAt), T - 0.5);
  const fade = (from: number) => `:alpha='min(1,max(0,(t-${n(from)})*5))'`;
  const per = 60 / p.beat.bpm / p.audio.speed;
  const off = p.beat.offset / p.audio.speed;
  const pulse = `exp(-mod(t-${n(off)}+${n(per * 1000)},${n(per)})*9)`;

  if (p.format === "bts") {
    const segs = p.segments ?? [];
    if (!segs.length || !inputs.clips?.length) throw new Error("El formato BTS necesita material crudo.");
    segs.forEach((s) => {
      args.push("-ss", n(s.start), "-t", n(s.duration + 0.1), "-i", inputs.clips![s.clip]!);
    });
    segs.forEach((s, i) => {
      const x = `max(0,min(iw-ow,iw*(${n(s.cx0)}+(${n(s.cx1 - s.cx0)})*t/${n(s.duration)})-ow/2))`;
      filters.push(
        `[${i + 1}:v]trim=duration=${n(s.duration)},setpts=PTS-STARTPTS,scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:x='${x}':y='(ih-oh)/2',fps=30,setsar=1,format=yuv420p[s${i}]`,
      );
    });
    filters.push(`${segs.map((_, i) => `[s${i}]`).join("")}concat=n=${segs.length}:v=1:a=0[vc]`);
    filters.push(
      `[vc]${text("overlay.txt", "Geist-Black.ttf", Math.round(h * 0.04), "(w-text_w)/2", `${n(h * 0.11)}`, `:enable='lt(t,${n(Math.min(3.5, T))})'`)},` +
        `${text("artist.txt", "Geist-Medium.ttf", Math.round(h * 0.022), "(w-text_w)/2", `${n(h * 0.86)}`, `:fontcolor=${hexToFfmpeg(p.accent)}`)},` +
        `${text("title.txt", "Geist-Bold.ttf", Math.round(h * 0.03), "(w-text_w)/2", `${n(h * 0.89)}`)}[v]`,
    );
    filters.push(audioChain(p, "[aout]"));
  } else {
    if (!inputs.cover) throw new Error("Este formato necesita la portada.");
    args.push("-loop", "1", "-t", n(T), "-i", inputs.cover);
    filters.push(`[1:v]split=2[c1][c2]`);
    filters.push(coverBackground("c1", w, h, "[bg]"));

    if (p.format === "hook") {
      const S = Math.round(w * 0.78);
      const z = p.cover ?? { zoomFrom: 1, zoomTo: 1.08, pulse: 0.035 };
      const scaleExpr = `trunc(${S}*(${n(z.zoomFrom)}+${n(z.zoomTo - z.zoomFrom)}*t/${n(T)}+${n(z.pulse)}*${pulse}*gte(t,${n(reveal)}))/2)*2`;
      filters.push(`[c2]scale=${S}:${S}:force_original_aspect_ratio=increase,crop=${S}:${S},setsar=1[fgb]`);
      filters.push(`[fgb]scale=w='${scaleExpr}':h='${scaleExpr}':eval=frame[fg]`);
      filters.push(
        `[bg][fg]overlay=x='(W-w)/2':y='(H-h)/2-${n(h * 0.03)}':eval=frame,` +
          `drawbox=x=0:y=0:w=iw:h=ih:color=white@0.85:t=fill:enable='between(t,${n(reveal)},${n(reveal + 0.07)})',` +
          `${text("overlay.txt", "Geist-Black.ttf", Math.round(h * 0.042), "(w-text_w)/2", `${n(h * 0.1)}`, `:enable='lt(t,${n(reveal)})'`)},` +
          `${text("artist.txt", "Geist-Medium.ttf", Math.round(h * 0.024), "(w-text_w)/2", `${n(h * 0.8)}`, `:fontcolor=${hexToFfmpeg(p.accent)}:enable='gte(t,${n(reveal)})'${fade(reveal)}`)},` +
          `${text("title.txt", "Geist-Black.ttf", Math.round(h * 0.045), "(w-text_w)/2", `${n(h * 0.835)}`, `:enable='gte(t,${n(reveal)})'${fade(reveal)}`)}[v]`,
      );
      filters.push(audioChain(p, "[aout]"));
    } else if (p.format === "visualizer") {
      const S = Math.round(w * (p.aspect === "1:1" ? 0.5 : 0.62));
      const waveH = Math.round(h * (p.aspect === "1:1" ? 0.16 : 0.13));
      const z = p.cover ?? { zoomFrom: 1, zoomTo: 1.04, pulse: 0.02 };
      const scaleExpr = `trunc(${S}*(${n(z.zoomFrom)}+${n(z.zoomTo - z.zoomFrom)}*t/${n(T)}+${n(z.pulse)}*${pulse})/2)*2`;
      filters.push(`[c2]scale=${S}:${S}:force_original_aspect_ratio=increase,crop=${S}:${S},setsar=1[fgb]`);
      filters.push(`[fgb]scale=w='${scaleExpr}':h='${scaleExpr}':eval=frame[fg]`);
      filters.push(audioChain(p, "[aw0]", ",asplit=2[aout][aw]").replace("[aw0]", ""));
      filters.push(`[aw]showwaves=s=${w}x${waveH}:mode=cline:rate=30:colors=${hexToFfmpeg(p.accent)}:scale=sqrt:draw=full,format=rgba,colorchannelmixer=aa=1[wave]`);
      const coverY = p.aspect === "1:1" ? h * 0.12 : h * 0.2;
      filters.push(
        `[bg][fg]overlay=x='(W-w)/2':y='${n(coverY)}+(${S}-h)/2':eval=frame[b1];` +
          `[b1][wave]overlay=x=0:y=${n(coverY + S + h * 0.04)}:shortest=1,` +
          `${text("title.txt", "Geist-Black.ttf", Math.round(h * (p.aspect === "1:1" ? 0.055 : 0.04)), "(w-text_w)/2", `${n(coverY + S + h * 0.06 + waveH)}`)},` +
          `${text("artist.txt", "Geist-Medium.ttf", Math.round(h * (p.aspect === "1:1" ? 0.032 : 0.024)), "(w-text_w)/2", `${n(coverY + S + h * 0.06 + waveH + h * 0.055)}`, `:fontcolor=${hexToFfmpeg(p.accent)}`)}[v]`,
      );
    } else {
      // lyric: portada de fondo y karaoke ASS en el centro
      if (!p.words?.length) throw new Error("El lyric video necesita la letra transcripta.");
      files["subs.ass"] = buildAss(p.words, p.audio.speed, w, h, p.accent);
      filters.push(`[c2]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,eq=brightness=-0.35:saturation=0.9[dim]`);
      filters.push(
        `[bg][dim]blend=all_mode=normal:all_opacity=0.35,subtitles=subs.ass:fontsdir=fonts,` +
          `${text("artist.txt", "Geist-Medium.ttf", Math.round(h * 0.022), "(w-text_w)/2", `${n(h * 0.86)}`, `:fontcolor=${hexToFfmpeg(p.accent)}`)},` +
          `${text("title.txt", "Geist-Bold.ttf", Math.round(h * 0.03), "(w-text_w)/2", `${n(h * 0.89)}`)}[v]`,
      );
      filters.push(audioChain(p, "[aout]"));
    }
  }

  args.push(
    "-filter_complex",
    filters.join(";"),
    "-map",
    "[v]",
    "-map",
    "[aout]",
    "-t",
    n(T),
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "21",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-movflags",
    "+faststart",
    out,
  );
  return { args, files };
}

/** Renderiza la pieza en `out` (ruta absoluta). */
export async function render(p: RenderParams, inputs: RenderInputs, out: string): Promise<void> {
  const work = await mkdtemp(join(tmpdir(), "88render-"));
  try {
    await mkdir(join(work, "fonts"));
    for (const f of ["Geist-Bold.ttf", "Geist-Black.ttf", "Geist-Medium.ttf"]) await copyFile(join(FONTS_DIR, f), join(work, "fonts", f));
    const plan = planRender(p, inputs, resolve(out));
    for (const [name, content] of Object.entries(plan.files)) await writeFile(join(work, name), content, "utf8");
    await new Promise<void>((ok, fail) => {
      const child = spawn(FFMPEG(), plan.args, { cwd: work, windowsHide: true });
      let err = "";
      child.stderr.on("data", (d) => (err += d));
      child.on("error", fail);
      child.on("close", (code) => (code === 0 ? ok() : fail(new Error(`El render falló: ${err.slice(-1200)}`))));
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
