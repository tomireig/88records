// Textos de cada pieza de contenido: caption, hashtags y la frase que va en pantalla.
// Con Ollama se generan; sin IA disponible, salen de plantillas escritas a mano (nunca vacío).
import { aiProvider } from "./index";

export type Phase = "pre" | "release" | "post";
export type Format = "hook" | "visualizer" | "lyric" | "bts";

export interface CopyContext {
  artist: string;
  title: string;
  format: Format;
  phase: Phase;
  /** días respecto del lanzamiento (negativo = antes) */
  day: number;
  mood?: string;
  bpm?: number;
  hookLyric?: string | null;
  /** para variar plantillas de forma estable */
  seed: number;
}

export interface PieceCopy {
  caption: string;
  hashtags: string[];
  overlay: string;
  source: "ai" | "template";
}

const pick = <T>(list: T[], seed: number): T => list[Math.abs(seed) % list.length]!;

const OVERLAYS: Record<Phase, Record<Format, string[]>> = {
  pre: {
    hook: ["esperá el drop", "esto sale pronto", "guardalo para el viernes", "subí el volumen"],
    visualizer: ["muy pronto", "en camino", "falta poco"],
    lyric: ["leé hasta el final", "esta parte…", "decime si no"],
    bts: ["así nació", "en el estudio", "antes de que salga"],
  },
  release: {
    hook: ["ya salió", "fuera ahora", "disponible en todos lados"],
    visualizer: ["ya disponible", "salió hoy"],
    lyric: ["ya salió", "cantala conmigo"],
    bts: ["hoy sale", "lo que no se vio"],
  },
  post: {
    hook: ["¿ya la escuchaste?", "la que no para de sonar", "esta parte pega"],
    visualizer: ["en todas las plataformas", "dale play"],
    lyric: ["esta línea", "¿te la sabés?"],
    bts: ["cómo se hizo", "detrás del tema"],
  },
};

const CAPTIONS: Record<Phase, string[]> = {
  pre: [
    "{title} sale en {days}. Guardalo y volvé cuando esté afuera.",
    "Faltan {days} para {title}. ¿Lo esperabas así?",
    "{artist} · {title}. Muy pronto.",
  ],
  release: ["{title} ya está en todas las plataformas.", "Salió {title}. Link en la bio.", "{artist} · {title}, fuera ahora."],
  post: ["{title} en todas las plataformas. ¿Cuál es tu parte?", "Si todavía no escuchaste {title}, este es el momento.", "{artist} · {title}. Link en la bio."],
};

function daysLabel(day: number): string {
  const d = Math.abs(day);
  return d === 1 ? "1 día" : `${d} días`;
}

function tag(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ]/g, "");
}

export function templateCopy(c: CopyContext): PieceCopy {
  const caption = pick(CAPTIONS[c.phase], c.seed)
    .replaceAll("{title}", c.title)
    .replaceAll("{artist}", c.artist)
    .replaceAll("{days}", daysLabel(c.day));
  const overlay = c.format === "lyric" && c.hookLyric ? c.hookLyric : pick(OVERLAYS[c.phase][c.format], c.seed);
  const hashtags = [tag(c.artist), tag(c.title), c.phase === "pre" ? "nuevamusica" : "musicanueva", "88records"].filter(Boolean);
  return { caption, hashtags: [...new Set(hashtags)], overlay, source: "template" };
}

const SYSTEM = `Escribís textos para TikTok de un sello independiente argentino (88RECORDS).
Español rioplatense con voseo, natural, corto, sin sonar a publicidad ni a IA.
Nada de emojis en exceso (máximo uno), nada de signos de exclamación dobles, nada de "¡Increíble!".
No inventes datos: no prometas fechas, premios, colaboraciones ni números.`;

/** Caption, hashtags y overlay. Si la IA falla o tarda, devuelve la plantilla. */
export async function pieceCopy(c: CopyContext): Promise<PieceCopy> {
  const fallback = templateCopy(c);
  const ai = await aiProvider();
  if (!ai) return fallback;
  const when = c.phase === "pre" ? `faltan ${daysLabel(c.day)} para el lanzamiento` : c.phase === "release" ? "sale hoy" : `salió hace ${daysLabel(c.day)}`;
  const prompt = `Tema: "${c.title}" de ${c.artist}. Formato del video: ${c.format}. Momento: ${when}.
${c.mood ? `Clima del tema: ${c.mood}.` : ""}${c.bpm ? ` Tempo: ${Math.round(c.bpm)} BPM.` : ""}${c.hookLyric ? ` Frase de la letra: "${c.hookLyric}".` : ""}
Devolvé JSON con: "caption" (máximo 150 caracteres), "hashtags" (3 a 5, sin #), "overlay" (texto en pantalla, máximo 5 palabras, minúsculas).`;
  try {
    const raw = await ai.complete(prompt, { system: SYSTEM, json: true, timeoutMs: 45_000 });
    const parsed = JSON.parse(raw) as { caption?: string; hashtags?: string[]; overlay?: string };
    const caption = (parsed.caption ?? "").trim().slice(0, 300);
    const overlay = (parsed.overlay ?? "").trim().slice(0, 40);
    const hashtags = (parsed.hashtags ?? []).map(tag).filter(Boolean).slice(0, 5);
    if (!caption || !overlay) return fallback;
    return { caption, hashtags: hashtags.length ? [...new Set([...hashtags, "88records"])] : fallback.hashtags, overlay, source: "ai" };
  } catch {
    return fallback;
  }
}
