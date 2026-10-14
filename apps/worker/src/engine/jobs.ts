// Motor de contenido en el worker: analizar el tema, renderizar las piezas y proponer la campaña.
import { pieceCopy, type PieceCopy } from "@88/ai";
import { analyzeTrack, findHook, withWords, type TrackAnalysis } from "@88/audio";
import { enqueue, JOBS } from "@88/core/queue";
import { storage, videoKey } from "@88/core/storage";
import { atLocal, dayKey, timeKey } from "@88/core/time";
import { db, type Prisma } from "@88/db";
import { ACTIVE_STATUSES, TIKTOK_PUBLISH, type TikTokPublishPayload, type TikTokPublishPreview } from "@88/services/tiktok";
import { centerBetween, motionTrack, render, type RenderParams } from "@88/video";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { processVideo } from "../process-video";
import { planPieces } from "./plan";

/** Lo que se guarda en Video.renderParams: los parámetros más lo necesario para rehacer y publicar. */
export interface StoredRender extends RenderParams {
  clipIds: string[];
  copy: PieceCopy;
  why: string;
}

const FORMAT_LABEL: Record<string, string> = { hook: "Hook", visualizer: "Visualizer", lyric: "Lyric", bts: "BTS" };

async function transcribe(path: string, durationSec: number) {
  if ((process.env.TRANSCRIBE ?? "on").toLowerCase() === "off") return null;
  try {
    const { WhisperProvider, looksLikeVocals } = await import("@88/ai/transcribe");
    const words = await new WhisperProvider().transcribe(path);
    return looksLikeVocals(words, durationSec) ? words : null;
  } catch (err) {
    console.error("[transcripción] no se pudo transcribir, sigo sin letra:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function analyzeRelease(releaseId: string): Promise<void> {
  const release = await db.release.findUnique({ where: { id: releaseId }, include: { artist: true } });
  if (!release?.audioKey) return;
  const s = storage();
  const audio = await s.toLocalFile(release.audioKey);
  try {
    let analysis: TrackAnalysis = await analyzeTrack(audio.path);
    const words = await transcribe(audio.path, analysis.durationSec);
    if (words) analysis = withWords(analysis, words, findHook(words));
    await db.release.update({ where: { id: releaseId }, data: { analysis: analysis as unknown as Prisma.InputJsonValue, status: "rendering" } });

    // Material crudo listo, con su recorrido de movimiento para el reencuadre.
    const raw = await db.video.findMany({ where: { releaseId, source: "raw", status: "ready" }, orderBy: { createdAt: "asc" } });
    const clips = [];
    for (const v of raw) {
      const local = await s.toLocalFile(v.storageKey);
      try {
        const track = await motionTrack(local.path);
        clips.push({ id: v.id, durationSec: v.durationSec ?? 0, centerAt: (a: number, b: number) => centerBetween(track, a, b) });
      } finally {
        await local.cleanup();
      }
    }

    const pieces = planPieces({
      analysis,
      artist: release.artist.name,
      title: release.title,
      hasCover: Boolean(release.coverKey),
      clips,
    });
    if (!pieces.length) throw new Error("No hay con qué armar piezas: subí la portada o material crudo.");

    // Un análisis nuevo reemplaza las piezas que todavía no se programaron.
    const old = await db.video.findMany({ where: { releaseId, source: "engine" }, include: { tiktokPosts: true } });
    for (const v of old.filter((v) => !v.tiktokPosts.length)) {
      await db.action.updateMany({ where: { status: "proposed", payload: { path: ["videoId"], equals: v.id } }, data: { status: "discarded" } });
      await db.video.delete({ where: { id: v.id } });
      await Promise.all([s.remove(v.storageKey), v.thumbnailKey ? s.remove(v.thumbnailKey) : null]);
    }

    const hookLyric = words ? findHook(words)?.text ?? null : null;
    for (const [i, p] of pieces.entries()) {
      const copy = await pieceCopy({
        artist: release.artist.name,
        title: release.title,
        format: p.format,
        phase: p.day < 0 ? "pre" : p.day === 0 ? "release" : "post",
        day: p.day,
        mood: analysis.profile.mood,
        bpm: analysis.bpm,
        hookLyric,
        seed: i + 1,
      });
      const stored: StoredRender = { ...p.params, text: { ...p.params.text, overlay: copy.overlay }, clipIds: clips.map((c) => c.id), copy, why: p.why };
      const id = randomUUID();
      await db.video.create({
        data: {
          id,
          organizationId: release.organizationId,
          artistId: release.artistId,
          releaseId,
          title: `${release.title} · ${FORMAT_LABEL[p.format]} ${p.params.variant}`,
          storageKey: videoKey(release.organizationId, id, "mp4"),
          mimeType: "video/mp4",
          status: "processing",
          source: "engine",
          format: p.format,
          aspect: p.params.aspect,
          campaignDay: p.day,
          renderParams: stored as unknown as Prisma.InputJsonValue,
        },
      });
      await enqueue(JOBS.contentRender, { videoId: id });
    }
  } finally {
    await audio.cleanup();
  }
}

export async function failRelease(releaseId: string, message: string): Promise<void> {
  await db.release.update({ where: { id: releaseId }, data: { status: "failed", error: message.slice(0, 400) } });
}

export async function renderPiece(videoId: string, finalAttempt: boolean): Promise<void> {
  const video = await db.video.findUnique({ where: { id: videoId }, include: { release: true } });
  if (!video?.release || video.status === "ready" || !video.renderParams) return;
  const p = video.renderParams as unknown as StoredRender;
  const s = storage();
  const locals: { cleanup: () => Promise<void> }[] = [];
  const work = await mkdtemp(join(tmpdir(), "88piece-"));
  try {
    const audio = await s.toLocalFile(video.release.audioKey!);
    locals.push(audio);
    const cover = video.release.coverKey ? await s.toLocalFile(video.release.coverKey) : null;
    if (cover) locals.push(cover);
    const clips: string[] = [];
    for (const id of p.clipIds ?? []) {
      const raw = await db.video.findUniqueOrThrow({ where: { id } });
      const local = await s.toLocalFile(raw.storageKey);
      locals.push(local);
      clips.push(local.path);
    }
    const out = join(work, "pieza.mp4");
    await render(p, { audio: audio.path, cover: cover?.path, clips }, out);
    const { createReadStream } = await import("node:fs");
    await s.write(video.storageKey, createReadStream(out), "video/mp4");
    await processVideo(videoId, true);
  } catch (err) {
    if (!finalAttempt) throw err;
    await db.video.update({ where: { id: videoId }, data: { status: "failed", error: err instanceof Error ? err.message.slice(0, 300) : "El render falló" } });
  } finally {
    for (const l of locals) await l.cleanup();
    await rm(work, { recursive: true, force: true });
  }
  await settleRelease(video.release.id);
}

/** Cuando no queda nada renderizando, el lanzamiento queda listo y se propone la campaña (una vez). */
async function settleRelease(releaseId: string): Promise<void> {
  const pending = await db.video.count({ where: { releaseId, source: "engine", status: { in: ["processing", "uploading"] } } });
  if (pending) return;
  const release = await db.release.update({ where: { id: releaseId }, data: { status: "ready" } });
  if (!release.campaignProposedAt) await proposeCampaign(releaseId);
}

/** Propone la campaña: cada pieza lista, en su día, en una cuenta del artista, en una franja libre. */
export async function proposeCampaign(releaseId: string): Promise<number> {
  const release = await db.release.findUniqueOrThrow({ where: { id: releaseId }, include: { organization: true } });
  const tz = release.organization.timezone;
  const accounts = await db.tikTokAccount.findMany({
    where: { organizationId: release.organizationId, artistId: release.artistId, status: "active" },
    orderBy: { createdAt: "asc" },
  });
  await db.release.update({ where: { id: releaseId }, data: { campaignProposedAt: new Date() } });
  if (!accounts.length || !release.releaseDate) return 0;

  const pieces = await db.video.findMany({
    where: { releaseId, source: "engine", status: "ready", tiktokPosts: { none: { status: { in: ACTIVE_STATUSES } } } },
    orderBy: [{ campaignDay: "asc" }, { createdAt: "asc" }],
  });
  const already = await db.action.findMany({ where: { organizationId: release.organizationId, type: TIKTOK_PUBLISH, status: "proposed" } });
  const proposedVideos = new Set(already.map((a) => (a.payload as unknown as TikTokPublishPayload).videoId));
  const busy = [
    ...(await db.tikTokPost.findMany({ where: { accountId: { in: accounts.map((a) => a.id) }, status: { in: ACTIVE_STATUSES } }, select: { accountId: true, scheduledFor: true } })).map((p) => ({ accountId: p.accountId, at: p.scheduledFor })),
    ...already.map((a) => ({ accountId: (a.payload as unknown as TikTokPublishPayload).accountId, at: new Date((a.payload as unknown as TikTokPublishPayload).scheduledFor) })),
  ];

  const releaseDay = dayKey(release.releaseDate, tz);
  const base = atLocal(releaseDay, "12:00", tz).getTime();
  let created = 0;
  let turn = 0;
  for (const v of pieces) {
    if (proposedVideos.has(v.id) || v.campaignDay === null) continue;
    const day = dayKey(new Date(base + v.campaignDay * 86_400_000), tz);
    let chosen: { accountId: string; at: Date } | null = null;
    for (let k = 0; k < accounts.length && !chosen; k++) {
      const acc = accounts[(turn + k) % accounts.length]!;
      const sameDay = busy.filter((b) => b.accountId === acc.id && dayKey(b.at, tz) === day).length;
      if (sameDay >= acc.maxPostsPerDay) continue;
      for (const slot of [...acc.preferredSlots].sort()) {
        const at = atLocal(day, slot, tz);
        if (at.getTime() < Date.now() + 15 * 60_000) continue;
        if (busy.some((b) => b.accountId === acc.id && Math.abs(b.at.getTime() - at.getTime()) < 45 * 60_000)) continue;
        chosen = { accountId: acc.id, at };
        break;
      }
    }
    turn++;
    if (!chosen) continue;
    const acc = accounts.find((a) => a.id === chosen!.accountId)!;
    const stored = v.renderParams as unknown as StoredRender;
    const tags = stored.copy.hashtags.map((h) => `#${h}`).join(" ");
    const payload: TikTokPublishPayload = {
      accountId: acc.id,
      videoId: v.id,
      scheduledFor: chosen.at.toISOString(),
      caption: [stored.copy.caption, tags].filter(Boolean).join("\n\n"),
    };
    const preview: TikTokPublishPreview = {
      accountName: acc.displayName,
      accountColor: acc.color,
      avatarUrl: acc.avatarUrl,
      videoTitle: v.title,
      thumbnailKey: v.thumbnailKey,
      durationSec: v.durationSec,
    };
    const d = v.campaignDay;
    const label = d === 0 ? "Día del lanzamiento" : d < 0 ? `D−${Math.abs(d)}` : `D+${d}`;
    await db.action.create({
      data: {
        organizationId: release.organizationId,
        artistId: release.artistId,
        releaseId,
        type: TIKTOK_PUBLISH,
        payload: payload as never,
        preview: preview as never,
        scheduledFor: chosen.at,
        reason: `${label} de «${release.title}», ${timeKey(chosen.at, tz)} en ${acc.displayName}. ${stored.why}`,
      },
    });
    busy.push(chosen);
    created++;
  }
  return created;
}
