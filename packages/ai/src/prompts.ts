import type { GenerationInput } from "./types";

export const SYSTEM_PROMPT = `Sos el equipo de marketing de 88RECORDS®, un sello independiente con artistas en Argentina, Chile y Puerto Rico (reggaetón, urbano, techengue: tech house + cumbia argentina).

Escribís en español rioplatense, con voseo, natural y directo. Nada de frases de manual de marketing, nada de "¡Descubrí!", nada que suene a IA. Pocas palabras, mucha intención. Sin emojis salvo que el formato lo pida.

Identidad visual del sello: naranja #FF4D00, azul ultramarino eléctrico #1E1EE6 y blanco. Helvetica. Estética editorial Off-White / Virgil Abloh: etiquetas entre comillas, mayúsculas, grilla industrial, mucho contraste.

Devolvé solo el contenido pedido, sin introducciones ni cierres.`;

function describe(i: GenerationInput) {
  return [
    i.artist && `Artista: ${i.artist}`,
    i.track && `Track: ${i.track}`,
    i.genre && `Género: ${i.genre}`,
    i.mood && `Mood: ${i.mood}`,
    i.platform && `Plataforma: ${i.platform}`,
    i.context && `Contexto extra: ${i.context}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildPrompt(i: GenerationInput): string {
  const base = describe(i);
  switch (i.kind) {
    case "hooks":
      return `${base}\n\nEscribí 10 hooks para los primeros 3 segundos de un video vertical. Cada uno tiene que frenar el scroll: una frase en pantalla o una línea dicha a cámara. Numerados, uno por línea.`;
    case "script":
      return `${base}\n\nEscribí un guion para un video vertical de 20 a 30 segundos. Separalo en HOOK (0-3s), DESARROLLO, REMATE y CTA. Indicá qué se ve y qué se escucha en cada parte.`;
    case "caption":
      return `${base}\n\nEscribí 3 opciones de caption. Cortas, con una sola idea cada una. Al final de cada una, entre 3 y 5 hashtags relevantes (mezcla de nicho y alcance).`;
    case "visual":
      return `${base}\n\nProponé 3 conceptos visuales para el release (tapa y piezas de redes) usando la paleta del sello. Para cada uno: nombre entre comillas, idea en dos líneas, composición, tipografía y uso del color.`;
    case "media_prompt":
      return `${base}\n\nEscribí 3 prompts en inglés para generar imagen o video con IA (Midjourney, Veo, Higgsfield). Concretos: sujeto, encuadre, luz, movimiento de cámara, paleta (#FF4D00, #1E1EE6, blanco), relación de aspecto 9:16.`;
    case "calendar":
      return `${base}\n\nArmá un calendario de contenido de 2 semanas, día por día. Para cada día: plataforma, formato (hook/reveal, storytelling, BTS, lyric, challenge, dueto o visualizer) y la idea en una línea. Mezclá formatos y no repitas el mismo dos días seguidos.`;
    case "bio":
      return `${base}\n\nEscribí 3 versiones de bio: una para Instagram (máximo 150 caracteres), una para Spotify (un párrafo corto) y una para prensa (tres párrafos).`;
    case "pitch":
      return `${base}\n\nEscribí el pitch editorial para Spotify for Artists. Máximo 500 caracteres en total. Qué tiene de distinto el track, para qué momento o playlist encaja y un dato concreto del artista. Sin adjetivos vacíos.`;
    case "dm_es":
      return `${base}\nCurador: ${i.curator ?? "-"}\nPlaylist: ${i.playlist ?? "-"}\n\nEscribí un DM corto para este curador, en español. Personal, que se note que conocés la playlist, sin rogar. Máximo 5 líneas, con lugar para el link.`;
    case "dm_en":
      return `${base}\nCurator: ${i.curator ?? "-"}\nPlaylist: ${i.playlist ?? "-"}\n\nWrite a short DM to this playlist curator, in English. Personal, shows you know the playlist, not begging. Max 5 lines, leave room for the link.`;
  }
}
