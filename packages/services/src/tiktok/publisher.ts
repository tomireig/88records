// Lo que corre en el worker: publicar y seguir el estado hasta que termine.
import { PlatformError, type VideoSource } from "@88/connectors";
import { describeFailReason, type PrivacyLevel } from "@88/connectors/tiktok";
import { enqueue, JOBS, schedulePublish } from "@88/core/queue";
import { storage } from "@88/core/storage";
import { db, type PostStatus } from "@88/db";
import { tiktok, withAccessToken } from "./accounts";

const STATUS_POLL_SECONDS = 15;
const STATUS_MAX_POLLS = 80; // ~20 minutos

async function setStatus(postId: string, status: PostStatus, message: string, data: Record<string, unknown> = {}) {
  await db.tikTokPost.update({ where: { id: postId }, data: { status, ...data, events: { create: { status, message } } } });
}

async function settleAction(postId: string, ok: boolean, detail: Record<string, unknown>) {
  const post = await db.tikTokPost.findUnique({ where: { id: postId }, select: { actionId: true } });
  if (!post?.actionId) return;
  await db.action.update({ where: { id: post.actionId }, data: { status: ok ? "done" : "failed", result: { postId, ...detail } } });
}

async function videoSource(storageKey: string, mimeType: string): Promise<VideoSource> {
  const s = storage();
  const size = await s.size(storageKey);
  if (!size) throw new PlatformError("No se encontró el archivo del video en el storage.", "permanent", "file_missing");
  return {
    size,
    mimeType,
    async readRange(start, end) {
      const chunks: Buffer[] = [];
      for await (const c of await s.read(storageKey, { start, end })) chunks.push(c as Buffer);
      return Buffer.concat(chunks);
    },
  };
}

export type PublishOutcome = "skipped" | "rescheduled" | "submitted" | "retrying" | "failed";

/**
 * Publica un post programado. Es idempotente: si el post ya no está programado (lo cancelaron,
 * ya salió) no hace nada; si lo movieron más adelante, reprograma el job.
 */
export async function publishPost(postId: string, attempt: { retryCount: number; retryLimit: number }): Promise<PublishOutcome> {
  const post = await db.tikTokPost.findUnique({ where: { id: postId }, include: { video: true } });
  if (!post || post.status !== "scheduled") return "skipped";
  if (post.scheduledFor.getTime() > Date.now() + 60_000) {
    await schedulePublish(post.id, post.scheduledFor);
    return "rescheduled";
  }

  const claimed = await db.tikTokPost.updateMany({
    where: { id: postId, status: "scheduled" },
    data: { status: "publishing", attempts: { increment: 1 } },
  });
  if (!claimed.count) return "skipped";
  await db.tikTokPostEvent.create({ data: { postId, status: "publishing", message: "Subiendo a TikTok" } });

  try {
    const { publishId } = await withAccessToken(post.accountId, async (token) => {
      // Se vuelve a consultar creator_info justo antes de publicar, como pide TikTok.
      const info = await tiktok().creatorInfo(token);
      if (post.mode === "direct") {
        if (!post.privacyLevel || !info.privacyLevelOptions.includes(post.privacyLevel as PrivacyLevel)) {
          throw new PlatformError("La privacidad elegida ya no está disponible para esta cuenta. Volvé a programarlo.", "permanent", "privacy_level_option_mismatch");
        }
      }
      if (post.video.durationSec && post.video.durationSec > info.maxVideoPostDurationSec) {
        throw new PlatformError(`El video supera los ${info.maxVideoPostDurationSec} s que permite la cuenta.`, "permanent", "duration");
      }
      return tiktok().publishVideo(
        token,
        {
          mode: post.mode,
          caption: post.caption,
          privacyLevel: (post.privacyLevel ?? "SELF_ONLY") as PrivacyLevel,
          disableComment: post.disableComment,
          disableDuet: post.disableDuet,
          disableStitch: post.disableStitch,
          brandOrganic: post.brandOrganic,
          brandContent: post.brandContent,
        },
        await videoSource(post.video.storageKey, post.video.mimeType),
      );
    });

    await setStatus(postId, "processing", "TikTok está procesando el video", { publishId });
    await enqueue(JOBS.tiktokStatus, { postId, poll: 0 }, { startAfter: STATUS_POLL_SECONDS });
    return "submitted";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retriable = err instanceof PlatformError ? err.retriable : true;
    if (retriable && attempt.retryCount < attempt.retryLimit) {
      // Vuelve a "programado" para que el próximo intento de pg-boss lo tome.
      await setStatus(postId, "scheduled", `Falló, se reintenta: ${message}`);
      throw err;
    }
    await setStatus(postId, "failed", message, { failReason: message });
    await settleAction(postId, false, { error: message });
    return "failed";
  }
}

export async function pollStatus(postId: string, poll: number): Promise<PostStatus | "pending"> {
  const post = await db.tikTokPost.findUnique({ where: { id: postId } });
  if (!post?.publishId || post.status !== "processing") return "pending";

  const status = await withAccessToken(post.accountId, (t) => tiktok().fetchStatus(t, post.publishId!));
  switch (status.state) {
    case "published":
      await setStatus(postId, "published", "Publicado", { publicPostId: status.publicPostId ?? null, publishedAt: new Date() });
      await settleAction(postId, true, { state: "published", publicPostId: status.publicPostId });
      return "published";
    case "in_drafts":
      await setStatus(postId, "in_drafts", "En borradores de TikTok: terminá de publicarlo desde la app", { publishedAt: new Date() });
      await settleAction(postId, true, { state: "in_drafts" });
      return "in_drafts";
    case "failed": {
      const reason = describeFailReason(status.failReason ?? "unknown");
      await setStatus(postId, "failed", reason, { failReason: reason });
      await settleAction(postId, false, { error: reason });
      return "failed";
    }
    default:
      if (poll >= STATUS_MAX_POLLS) {
        const reason = "TikTok no terminó de procesar el video. Revisá la cuenta en la app y reintentá si no aparece.";
        await setStatus(postId, "failed", reason, { failReason: reason });
        await settleAction(postId, false, { error: reason });
        return "failed";
      }
      await enqueue(JOBS.tiktokStatus, { postId, poll: poll + 1 }, { startAfter: STATUS_POLL_SECONDS });
      return "pending";
  }
}
