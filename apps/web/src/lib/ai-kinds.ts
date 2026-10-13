import type { GenerationKind } from "@88/ai";

export const KIND_LABELS: Record<GenerationKind, string> = {
  hooks: "Hooks de 3 segundos",
  script: "Guion de video",
  caption: "Captions con hashtags",
  visual: "Concepto visual",
  media_prompt: "Prompts de imagen / video",
  calendar: "Calendario de 2 semanas",
  bio: "Bios",
  pitch: "Pitch editorial (500 caracteres)",
  dm_es: "DM a curador (español)",
  dm_en: "DM a curador (inglés)",
};
