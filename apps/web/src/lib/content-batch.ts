import type { ContentFormat, Platform } from "@88/db";
import { addDays } from "./dates";

const IDEAS: Record<ContentFormat, string> = {
  HOOK_REVEAL: "El momento más fuerte del tema en los primeros 3 segundos",
  STORYTELLING: "La historia detrás del tema, contada a cámara",
  BTS: "Estudio, sesión de voz o armado del beat",
  LYRIC: "La frase más fuerte en pantalla, tipografía de la marca",
  CHALLENGE: "Paso o gesto simple para el coro, fácil de copiar",
  DUET: "Dejar una parte abierta para que respondan con dueto",
  VISUALIZER: "Loop visual con la tapa y la paleta del sello",
};

// Rotación pensada para que no se repita el mismo formato dos días seguidos.
const FORMAT_CYCLE: ContentFormat[] = [
  "HOOK_REVEAL", "BTS", "LYRIC", "STORYTELLING", "CHALLENGE",
  "HOOK_REVEAL", "VISUALIZER", "DUET", "BTS", "LYRIC",
  "HOOK_REVEAL", "STORYTELLING", "CHALLENGE", "VISUALIZER", "BTS",
  "HOOK_REVEAL", "DUET", "LYRIC", "STORYTELLING", "CHALLENGE",
];
const PLATFORM_CYCLE: Platform[] = ["TIKTOK", "INSTAGRAM", "TIKTOK", "YOUTUBE", "INSTAGRAM"];
// 5 piezas por semana: días 1, 2, 4, 5 y 7 contando desde el inicio.
const WEEK_DAYS = [0, 1, 3, 4, 6];

export function buildBatch(start: Date, label: string) {
  return FORMAT_CYCLE.map((format, i) => {
    const week = Math.floor(i / 5);
    return {
      title: `${label} · pieza ${i + 1}`,
      format,
      platform: PLATFORM_CYCLE[i % PLATFORM_CYCLE.length]!,
      hook: IDEAS[format],
      scheduledFor: addDays(start, week * 7 + WEEK_DAYS[i % 5]!),
    };
  });
}
