import type { GenerationInput } from "./types";

const tag = (s: string) => "#" + s.toLowerCase().replace(/[^a-z0-9áéíóúñ]/g, "");

// Plantillas para cuando no hay API key o la IA falla.
// Son un punto de partida para editar, no reemplazan a la IA.
export function localTemplate(i: GenerationInput): string {
  const artist = i.artist || "el artista";
  const track = i.track || "el track";
  const genre = i.genre || "reggaetón";
  const platform = i.platform || "TikTok";

  switch (i.kind) {
    case "hooks":
      return [
        `1. "Esto lo grabamos a las 4 de la mañana y salió ${track}"`,
        `2. "Si te gusta el ${genre} de antes, esperá el drop"`,
        `3. "${artist} no quería sacar este tema"`,
        `4. "POV: suena ${track} y no te podés quedar quieto"`,
        `5. "La parte que nadie esperaba está en el segundo 12"`,
        `6. "Te muestro cómo se armó este beat en 30 segundos"`,
        `7. "Ponele un número del 1 al 10 a este drop"`,
        `8. "Este tema tiene una historia que no conté nunca"`,
        `9. "Mandáselo a quien te lo hizo"`,
        `10. "Si llegaste hasta acá, guardalo"`,
      ].join("\n");
    case "script":
      return [
        `HOOK (0-3s): primer plano de ${artist}, en pantalla la frase más fuerte de ${track}.`,
        `DESARROLLO: cortes al ritmo, BTS del estudio, la letra en pantalla.`,
        `REMATE: entra el drop y cambia a plano abierto.`,
        `CTA: "${track} ya está en todas las plataformas. Link en bio."`,
      ].join("\n");
    case "caption":
      return [
        `${track} ya salió. Subilo.\n${tag(genre)} #88records #nuevotema`,
        `Esto es lo que estábamos guardando.\n${tag(artist)} #musicaargentina #urbano`,
        `Guardalo para el finde.\n${tag(platform)} #88records #parati`,
      ].join("\n\n");
    case "visual":
      return [
        `"BLOQUE"\nTítulo en Helvetica Bold enorme, en mayúsculas, sobre fondo #FF4D00. Foto de ${artist} recortada en blanco y negro. Etiqueta "${track.toUpperCase()}" abajo a la izquierda.`,
        `"PLANO"\nFondo blanco con la grilla visible y un solo bloque #1E1EE6 con la tapa. Mucho aire.`,
        `"CINTA"\nCinta naranja con texto corrido cruzando la foto en diagonal, estilo señalética industrial.`,
      ].join("\n\n");
    case "media_prompt":
      return [
        `1. Vertical 9:16, ${artist} standing in an empty concrete parking lot at night, single orange (#FF4D00) light, slow push-in, 35mm, high contrast, editorial.`,
        `2. Vertical 9:16, close-up of hands on a drum machine, electric blue (#1E1EE6) rim light, white background, shallow depth of field, slow orbit.`,
        `3. Vertical 9:16, crowd silhouettes in a club, strobes in orange and electric blue, handheld, film grain, motion blur.`,
      ].join("\n");
    case "calendar":
      return [
        "Día 1 · TikTok · hook/reveal · el drop en 3 segundos",
        "Día 2 · Instagram · BTS · cómo se grabó la voz",
        "Día 3 · TikTok · lyric · la frase más fuerte en pantalla",
        "Día 4 · YouTube · visualizer · loop de la tapa",
        "Día 5 · TikTok · challenge · paso simple para el coro",
        "Día 6 · Instagram · storytelling · por qué existe el tema",
        "Día 7 · TikTok · dueto · invitar a cantar la segunda parte",
        "Día 8 · Instagram · hook/reveal · antes y después del beat",
        "Día 9 · TikTok · BTS · sesión en el estudio",
        "Día 10 · YouTube · lyric · versión completa con letra",
        "Día 11 · TikTok · storytelling · la anécdota detrás del tema",
        "Día 12 · Instagram · challenge · repost de los mejores videos",
        "Día 13 · TikTok · visualizer · loop con la paleta del sello",
        "Día 14 · Instagram · dueto · respuesta a un comentario",
      ].join("\n");
    case "bio":
      return [
        `IG: ${artist}. ${genre} desde Argentina. 88RECORDS®.`,
        `Spotify: ${artist} hace ${genre} desde Argentina. Parte de 88RECORDS®.`,
        `Prensa: completar con trayectoria, hitos y próximos lanzamientos.`,
      ].join("\n\n");
    case "pitch":
      return `${track} de ${artist} es ${genre} pensado para ${i.mood || "la previa"}. Completá con lo que lo hace distinto, un dato concreto del artista y la playlist editorial donde encaja.`.slice(0, 500);
    case "dm_es":
      return `Hola ${i.curator || ""}, sigo ${i.playlist || "tu playlist"} hace rato.\nTe paso ${track} de ${artist}, creo que le queda bien al mood que venís armando.\n[link]\nSi no encaja, todo bien. Gracias por escuchar.`;
    case "dm_en":
      return `Hi ${i.curator || ""}, I've been following ${i.playlist || "your playlist"} for a while.\nSharing ${track} by ${artist}, I think it fits the vibe you're building.\n[link]\nNo worries if it's not a match. Thanks for listening.`;
  }
}
