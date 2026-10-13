import { CAPTION_MAX, type CreatorInfo } from "@88/connectors/tiktok";
import { schedulePublish } from "@88/core/queue";
import { atLocal, dayKey } from "@88/core/time";
import { db, type PostStatus, type TikTokAccount, type TikTokPost, type Video } from "@88/db";
import { connectionHealth } from "./accounts";
import { allowedPrivacy, tiktokMode, type TikTokMode } from "./mode";

/** Lo que el usuario eligió en la pantalla de publicación. Nada viene precargado. */
export interface PublishChoices {
  caption: string;
  privacyLevel: string | null;
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  /** "Tu marca": promociona al propio artista o sello. */
  brandOrganic: boolean;
  /** "Contenido de marca": colaboración paga con un tercero. */
  brandContent: boolean;
  /** Aceptó la Music Usage Confirmation (y la Branded Content Policy si aplica). */
  consent: boolean;
}

export class ValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(problems.join(" "));
    this.name = "ValidationError";
  }
}

/** Estados que ocupan lugar en el día (cuentan para el tope). */
export const ACTIVE_STATUSES: PostStatus[] = ["scheduled", "publishing", "processing", "in_drafts", "published"];

export async function postsOnDay(accountId: string, at: Date, tz: string, excludePostId?: string): Promise<number> {
  const day = dayKey(at, tz);
  const from = atLocal(day, "00:00", tz);
  const to = new Date(from.getTime() + 24 * 3600_000);
  return db.tikTokPost.count({
    where: { accountId, scheduledFor: { gte: from, lt: to }, status: { in: ACTIVE_STATUSES }, id: excludePostId ? { not: excludePostId } : undefined },
  });
}

/** Valida las elecciones contra lo que devolvió creator_info y las reglas de la cuenta. */
export function validateChoices(params: {
  account: TikTokAccount;
  video: Video;
  info: CreatorInfo;
  choices: PublishChoices;
  mode: TikTokMode;
}): string[] {
  const { account, video, info, choices, mode } = params;
  const p: string[] = [];
  if (connectionHealth(account) === "broken") p.push("La conexión de la cuenta está caída: reconectala antes de publicar.");
  if (video.status !== "ready") p.push("El video todavía no terminó de procesarse.");
  if (video.durationSec && video.durationSec > info.maxVideoPostDurationSec) {
    p.push(`El video dura ${Math.round(video.durationSec)} s y esta cuenta permite hasta ${info.maxVideoPostDurationSec} s.`);
  }
  if ([...choices.caption].length > CAPTION_MAX) p.push(`El texto supera los ${CAPTION_MAX} caracteres.`);
  if (!choices.consent) p.push("Falta aceptar la confirmación de uso de música de TikTok.");

  if (mode.directPost) {
    const allowed = allowedPrivacy(info, mode);
    if (!choices.privacyLevel) p.push("Elegí quién puede ver el video.");
    else if (!allowed.includes(choices.privacyLevel as never)) p.push("Esa privacidad no está disponible para esta cuenta.");
    if (choices.allowComment && info.commentDisabled) p.push("La cuenta tiene los comentarios desactivados.");
    if (choices.allowDuet && info.duetDisabled) p.push("La cuenta tiene el dúo desactivado.");
    if (choices.allowStitch && info.stitchDisabled) p.push("La cuenta tiene el stitch desactivado.");
    if (choices.brandContent && choices.privacyLevel === "SELF_ONLY") {
      p.push("El contenido de marca no puede publicarse como privado.");
    }
  }
  return p;
}

export async function schedulePost(params: {
  organizationId: string;
  userId: string;
  accountId: string;
  videoId: string;
  at: Date;
  choices: PublishChoices;
  info: CreatorInfo;
  actionId?: string;
}): Promise<TikTokPost> {
  const { organizationId, accountId, videoId, at, choices, info } = params;
  const [org, account, video] = await Promise.all([
    db.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    db.tikTokAccount.findFirstOrThrow({ where: { id: accountId, organizationId } }),
    db.video.findFirstOrThrow({ where: { id: videoId, organizationId } }),
  ]);
  const mode = tiktokMode();
  const problems = validateChoices({ account, video, info, choices, mode });
  if (at.getTime() < Date.now() - 60_000) problems.push("Ese horario ya pasó.");
  const sameDay = await postsOnDay(accountId, at, org.timezone);
  if (sameDay >= account.maxPostsPerDay) {
    problems.push(`${account.displayName} ya tiene ${sameDay} publicaciones ese día (tope: ${account.maxPostsPerDay}).`);
  }
  if (problems.length) throw new ValidationError(problems);

  const post = await db.tikTokPost.create({
    data: {
      organizationId,
      accountId,
      videoId,
      actionId: params.actionId,
      caption: choices.caption,
      privacyLevel: mode.directPost ? choices.privacyLevel : null,
      disableComment: mode.directPost ? !choices.allowComment : true,
      disableDuet: mode.directPost ? !choices.allowDuet : true,
      disableStitch: mode.directPost ? !choices.allowStitch : true,
      brandOrganic: choices.brandOrganic,
      brandContent: choices.brandContent,
      mode: mode.directPost ? "direct" : "draft",
      creatorNickname: info.nickname,
      scheduledFor: at,
      createdById: params.userId,
      events: { create: { status: "scheduled", message: "Programado" } },
    },
  });
  await schedulePublish(post.id, at);
  return post;
}

export async function reschedulePost(organizationId: string, postId: string, at: Date): Promise<TikTokPost> {
  const post = await db.tikTokPost.findFirstOrThrow({ where: { id: postId, organizationId }, include: { account: true, organization: true } });
  if (post.status !== "scheduled") throw new ValidationError(["Solo se pueden mover publicaciones que todavía no salieron."]);
  if (at.getTime() < Date.now()) throw new ValidationError(["Ese horario ya pasó."]);
  const sameDay = await postsOnDay(post.accountId, at, post.organization.timezone, post.id);
  if (sameDay >= post.account.maxPostsPerDay) {
    throw new ValidationError([`${post.account.displayName} ya llegó al tope de ${post.account.maxPostsPerDay} publicaciones ese día.`]);
  }
  const updated = await db.tikTokPost.update({
    where: { id: postId },
    data: { scheduledFor: at, events: { create: { status: "scheduled", message: "Reprogramado" } } },
  });
  await schedulePublish(postId, at);
  return updated;
}

export async function cancelPost(organizationId: string, postId: string): Promise<void> {
  const res = await db.tikTokPost.updateMany({
    where: { id: postId, organizationId, status: "scheduled" },
    data: { status: "canceled" },
  });
  if (!res.count) throw new ValidationError(["Esta publicación ya no se puede cancelar."]);
  await db.tikTokPostEvent.create({ data: { postId, status: "canceled", message: "Cancelado" } });
}

/** Vuelve a programar una publicación fallida, en un minuto o en el horario indicado. */
export async function retryPost(organizationId: string, postId: string, at = new Date(Date.now() + 60_000)): Promise<void> {
  const res = await db.tikTokPost.updateMany({
    where: { id: postId, organizationId, status: "failed" },
    data: { status: "scheduled", scheduledFor: at, failReason: null, publishId: null, attempts: 0 },
  });
  if (!res.count) throw new ValidationError(["Solo se pueden reintentar publicaciones con error."]);
  await db.tikTokPostEvent.create({ data: { postId, status: "scheduled", message: "Reintento manual" } });
  await schedulePublish(postId, at);
}

/** Otras cuentas donde ya está programado o publicado el mismo archivo (mismo hash). */
export async function duplicateAccounts(organizationId: string, videoId: string, excludeAccountId?: string) {
  const video = await db.video.findFirst({ where: { id: videoId, organizationId } });
  if (!video?.sha256) return [];
  const posts = await db.tikTokPost.findMany({
    where: {
      organizationId,
      status: { in: ACTIVE_STATUSES },
      video: { sha256: video.sha256 },
      accountId: excludeAccountId ? { not: excludeAccountId } : undefined,
    },
    select: { account: { select: { id: true, displayName: true } } },
  });
  return [...new Map(posts.map((p) => [p.account.id, p.account])).values()];
}

export function buildCaption(account: Pick<TikTokAccount, "captionTemplate" | "hashtags">, video: Pick<Video, "title">): string {
  const base = (account.captionTemplate || "{titulo}").replaceAll("{titulo}", video.title).trim();
  const tags = account.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).filter((h) => !base.includes(h));
  return [base, tags.join(" ")].filter(Boolean).join("\n\n").slice(0, CAPTION_MAX);
}
