"use server";

import { db, type ContentFormat, type ContentStage, type PitchStage } from "@88/db";
import { revalidatePath } from "next/cache";
import { CAMPAIGN_TEMPLATE } from "@/lib/campaign-template";
import { buildBatch } from "@/lib/content-batch";
import { addDays, diffDays, today } from "@/lib/dates";

// Datos de ejemplo para mostrar la app. Artistas, playlists y números inventados.
// Todo queda marcado con demo = true y se borra con un botón.

// Views promedio por formato: así Análisis muestra un ganador claro.
const FORMAT_VIEWS: Record<ContentFormat, number> = {
  HOOK_REVEAL: 48_000,
  CHALLENGE: 35_000,
  STORYTELLING: 22_000,
  LYRIC: 18_000,
  DUET: 15_000,
  BTS: 12_000,
  VISUALIZER: 6_000,
};

// Engagement relativo por formato: lo íntimo engancha más, lo masivo menos.
const FORMAT_ENGAGEMENT: Record<ContentFormat, number> = {
  HOOK_REVEAL: 0.9,
  CHALLENGE: 1.3,
  STORYTELLING: 1.4,
  LYRIC: 1.1,
  DUET: 1.2,
  BTS: 1.5,
  VISUALIZER: 0.7,
};

function metrics(format: ContentFormat, i: number) {
  const views = Math.round(FORMAT_VIEWS[format] * (0.7 + ((i * 37) % 60) / 100));
  const e = FORMAT_ENGAGEMENT[format] * (0.85 + ((i * 53) % 30) / 100);
  return {
    views,
    likes: Math.round(views * 0.08 * e),
    comments: Math.round(views * 0.009 * e),
    shares: Math.round(views * 0.02 * e),
    saves: Math.round(views * 0.03 * e),
  };
}

/** Etapa según qué tan cerca está la fecha: lo pasado ya salió, lo próximo está en producción. */
function stageFor(date: Date, now: Date): ContentStage {
  const d = diffDays(date, now);
  if (d < 0) return "PUBLISHED";
  if (d <= 2) return "EDITED";
  if (d <= 5) return "RECORDED";
  if (d <= 9) return "SCRIPT";
  return "IDEA";
}

export async function hasDemo() {
  return (await db.artist.count({ where: { demo: true } })) > 0;
}

export async function loadDemo() {
  if (await hasDemo()) return;
  const now = today();

  const [nova, kairo, sol] = await Promise.all([
    db.artist.create({ data: { name: "Nova Ríos", country: "AR", genre: "reggaetón", demo: true } }),
    db.artist.create({ data: { name: "Kairo Vega", country: "CL", genre: "urbano", demo: true } }),
    db.artist.create({ data: { name: "Sol Marea", country: "PR", genre: "reggaetón", demo: true } }),
  ]);

  const [fuego, madrugada, marea] = await Promise.all([
    db.track.create({
      data: { title: "Fuego Lento", artistId: nova.id, status: "RELEASED", genre: "reggaetón", mood: "perreo", bpm: 94, musicalKey: "Am", durationSec: 188, releaseDate: addDays(now, -20) },
    }),
    db.track.create({
      data: { title: "Madrugada", artistId: kairo.id, status: "READY", genre: "urbano", mood: "previa", bpm: 100, musicalKey: "F#m", durationSec: 171, releaseDate: addDays(now, 12) },
    }),
    db.track.create({
      data: { title: "Marea Alta", artistId: sol.id, status: "MASTER", genre: "reggaetón", mood: "playa", bpm: 92, musicalKey: "Gm", durationSec: 200, releaseDate: addDays(now, 40) },
    }),
    db.track.create({
      data: { title: "Calle 88", artistId: nova.id, status: "MIX", genre: "techengue", mood: "boliche", bpm: 124, musicalKey: "Dm", durationSec: 225 },
    }),
  ]);

  // Campañas: una que ya salió, una a punto de salir y una en planificación.
  // Lo vencido queda hecho, salvo una tarea por campaña para que se vea la alerta.
  const campaigns = [
    { track: fuego, artist: nova, release: addDays(now, -20), status: "ACTIVE" as const, pending: 7 },
    { track: madrugada, artist: kairo, release: addDays(now, 12), status: "ACTIVE" as const, pending: -14 },
    { track: marea, artist: sol, release: addDays(now, 40), status: "PLANNING" as const, pending: null },
  ];
  const created = [];
  for (const c of campaigns) {
    created.push(
      await db.campaign.create({
        data: {
          name: `${c.track.title} · ${c.artist.name}`,
          trackId: c.track.id,
          releaseDate: c.release,
          status: c.status,
          demo: true,
          tasks: {
            create: CAMPAIGN_TEMPLATE.map((t) => {
              const dueDate = addDays(c.release, t.offset);
              const done = dueDate < now && t.offset !== c.pending;
              return { offsetDays: t.offset, title: t.title, detail: t.detail, dueDate, doneAt: done ? dueDate : null };
            }),
          },
        },
      }),
    );
  }

  // Contenido de las dos campañas activas.
  const pieces = created.slice(0, 2).flatMap((campaign, ci) => {
    const track = ci === 0 ? fuego : madrugada;
    return buildBatch(addDays(campaign.releaseDate, -21), track.title).map((p, i) => {
      const stage = stageFor(p.scheduledFor, now);
      return {
        ...p,
        stage,
        campaignId: campaign.id,
        trackId: track.id,
        demo: true,
        publishedAt: stage === "PUBLISHED" ? p.scheduledFor : null,
        ...(stage === "PUBLISHED" ? metrics(p.format, i + ci * 20) : {}),
      };
    });
  });
  await db.contentPiece.createMany({ data: pieces });

  const curatorData = [
    { name: "Mati G.", playlist: "Perreo Intenso AR", genres: ["reggaetón", "perreo"], followers: 48_000, language: "es" },
    { name: "Caro L.", playlist: "Previa Urbana", genres: ["urbano", "trap", "reggaetón"], followers: 22_000, language: "es" },
    { name: "DJ Fede", playlist: "Techengue Club", genres: ["techengue", "cumbia", "tech house"], followers: 9_000, language: "es" },
    { name: "Sam R.", playlist: "Latin Heat", genres: ["reggaeton", "latin"], followers: 120_000, language: "en" },
    { name: "Javi M.", playlist: "Santiago Urbano", genres: ["urbano", "trap"], followers: 15_000, language: "es" },
    { name: "Ana T.", playlist: "Isla Caliente PR", genres: ["reggaetón"], followers: 30_000, language: "es" },
  ];
  const curators = await Promise.all(curatorData.map((data) => db.curator.create({ data: { ...data, demo: true } })));
  const byPlaylist = (p: string) => curators.find((c) => c.playlist === p)!.id;

  const pitch = (playlist: string, trackId: string, stage: PitchStage, sentDaysAgo: number | null, costUsd = 0, adds = 0) => ({
    curatorId: byPlaylist(playlist),
    trackId,
    stage,
    sentAt: sentDaysAgo == null ? null : addDays(now, -sentDaysAgo),
    followUpAt: stage === "SENT" || stage === "FOLLOW_UP" ? addDays(now, -sentDaysAgo! + 7) : null,
    costUsd,
    adds,
  });
  await db.pitch.createMany({
    data: [
      pitch("Perreo Intenso AR", fuego.id, "ACCEPTED", 35, 0, 1),
      pitch("Previa Urbana", fuego.id, "ACCEPTED", 35, 25, 1),
      pitch("Isla Caliente PR", fuego.id, "ACCEPTED", 30, 30, 1),
      pitch("Latin Heat", fuego.id, "REJECTED", 30, 40),
      pitch("Santiago Urbano", madrugada.id, "SENT", 8),
      pitch("Previa Urbana", madrugada.id, "FOLLOW_UP", 4),
      pitch("Perreo Intenso AR", madrugada.id, "TO_SEND", null),
      pitch("Latin Heat", madrugada.id, "TO_SEND", null),
    ],
  });

  // Seis meses de crecimiento. Si ya hay un snapshot real ese mes, no se pisa.
  const listeners = [31_200, 33_900, 36_400, 40_800, 46_100, 52_300];
  const ref = new Date(now);
  await db.fanSnapshot.createMany({
    skipDuplicates: true,
    data: listeners.map((l, i) => ({
      month: new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - (5 - i), 1)),
      monthlyListeners: l,
      followers: Math.round(l * 0.21),
      emailSubs: 180 + i * 64,
      superfans: Math.round(l * 0.013),
      demo: true,
    })),
  });

  revalidatePath("/", "layout");
}

export async function clearDemo() {
  await db.$transaction([
    db.contentPiece.deleteMany({ where: { demo: true } }),
    db.campaign.deleteMany({ where: { demo: true } }),
    db.curator.deleteMany({ where: { demo: true } }),
    db.artist.deleteMany({ where: { demo: true } }),
    db.fanSnapshot.deleteMany({ where: { demo: true } }),
  ]);
  revalidatePath("/", "layout");
}
