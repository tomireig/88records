"use server";

import type { CreatorInfo, PrivacyLevel } from "@88/connectors/tiktok";
import { storage } from "@88/core/storage";
import { isValidTime } from "@88/core/time";
import { db } from "@88/db";
import { discardActions } from "@88/services/actions";
import { completeUpload, createUpload, deleteVideo, LibraryError, renameVideo } from "@88/services/library";
import {
  allowedPrivacy,
  approveTikTokActions,
  cancelPost,
  disconnectAccount,
  duplicateAccounts,
  postsOnDay,
  proposeWeek,
  reschedulePost,
  retryPost,
  schedulePost,
  tiktok,
  tiktokMode,
  ValidationError,
  withAccessToken,
  type PublishChoices,
  type TikTokMode,
} from "@88/services/tiktok";
import { PlatformError } from "@88/connectors";
import { revalidatePath } from "next/cache";
import { sessionOrThrow } from "@/lib/auth";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (err) {
    if (err instanceof ValidationError || err instanceof LibraryError || err instanceof PlatformError) {
      return { ok: false, error: err.message };
    }
    console.error(err);
    return { ok: false, error: err instanceof Error ? err.message : "Algo falló. Probá de nuevo." };
  }
}

function refresh() {
  for (const p of ["/calendario", "/biblioteca", "/cuentas", "/bandeja"]) revalidatePath(p);
}

// ─── Biblioteca ─────────────────────────────────────────────────────────────

export async function startUpload(input: { fileName: string; size: number; mimeType: string; artistId: string | null }) {
  return run(async () => {
    const s = await sessionOrThrow();
    const { video, upload } = await createUpload({ organizationId: s.org.id, userId: s.user.id, ...input });
    return { videoId: video.id, upload };
  });
}

export async function finishUpload(videoId: string) {
  return run(async () => {
    const s = await sessionOrThrow();
    await completeUpload(s.org.id, videoId);
    refresh();
    return {};
  });
}

export async function abandonUpload(videoId: string) {
  return run(async () => {
    const s = await sessionOrThrow();
    await db.video.deleteMany({ where: { id: videoId, organizationId: s.org.id, status: "uploading" } });
    return {};
  });
}

export async function removeVideo(videoId: string) {
  return run(async () => {
    const s = await sessionOrThrow();
    await deleteVideo(s.org.id, videoId);
    refresh();
    return {};
  });
}

export async function updateVideo(videoId: string, title: string, artistId: string | null) {
  return run(async () => {
    const s = await sessionOrThrow();
    await renameVideo(s.org.id, videoId, title, artistId);
    refresh();
    return {};
  });
}

// ─── Pantalla de publicación ────────────────────────────────────────────────

export interface PublishContext {
  info: CreatorInfo;
  allowed: PrivacyLevel[];
  mode: TikTokMode;
  duplicates: { id: string; displayName: string }[];
  videoUrl: string;
  videoTitle: string;
  durationSec: number | null;
  dayCount: number;
  maxPostsPerDay: number;
}

/** Consulta creator_info en el momento de abrir la pantalla, como exige TikTok. */
export async function loadPublishContext(accountId: string, videoId: string, at: string) {
  return run<{ context: PublishContext }>(async () => {
    const s = await sessionOrThrow();
    const [account, video] = await Promise.all([
      db.tikTokAccount.findFirstOrThrow({ where: { id: accountId, organizationId: s.org.id } }),
      db.video.findFirstOrThrow({ where: { id: videoId, organizationId: s.org.id } }),
    ]);
    const info = await withAccessToken(account.id, (t) => tiktok().creatorInfo(t));
    const mode = tiktokMode();
    return {
      context: {
        info,
        allowed: allowedPrivacy(info, mode),
        mode,
        duplicates: await duplicateAccounts(s.org.id, videoId, accountId),
        videoUrl: await storage().downloadUrl(video.storageKey, 3600),
        videoTitle: video.title,
        durationSec: video.durationSec,
        dayCount: await postsOnDay(accountId, new Date(at), s.org.timezone),
        maxPostsPerDay: account.maxPostsPerDay,
      },
    };
  });
}

export async function createPost(input: { accountId: string; videoId: string; at: string; choices: PublishChoices }) {
  return run(async () => {
    const s = await sessionOrThrow();
    const info = await withAccessToken(input.accountId, (t) => tiktok().creatorInfo(t));
    const post = await schedulePost({
      organizationId: s.org.id,
      userId: s.user.id,
      accountId: input.accountId,
      videoId: input.videoId,
      at: new Date(input.at),
      choices: input.choices,
      info,
    });
    refresh();
    return { postId: post.id };
  });
}

export async function movePost(postId: string, at: string) {
  return run(async () => {
    const s = await sessionOrThrow();
    await reschedulePost(s.org.id, postId, new Date(at));
    refresh();
    return {};
  });
}

export async function cancelScheduledPost(postId: string) {
  return run(async () => {
    const s = await sessionOrThrow();
    await cancelPost(s.org.id, postId);
    refresh();
    return {};
  });
}

export async function retryFailedPost(postId: string) {
  return run(async () => {
    const s = await sessionOrThrow();
    await retryPost(s.org.id, postId);
    refresh();
    return {};
  });
}

export async function loadPostDetail(postId: string) {
  return run(async () => {
    const s = await sessionOrThrow();
    const p = await db.tikTokPost.findFirstOrThrow({
      where: { id: postId, organizationId: s.org.id },
      include: { events: { orderBy: { at: "asc" } }, account: { select: { displayName: true, color: true, avatarUrl: true } }, video: { select: { title: true } } },
    });
    return {
      post: {
        id: p.id,
        caption: p.caption,
        privacyLevel: p.privacyLevel,
        mode: p.mode,
        status: p.status,
        scheduledFor: p.scheduledFor.toISOString(),
        publishedAt: p.publishedAt?.toISOString() ?? null,
        failReason: p.failReason,
        publicPostId: p.publicPostId,
        creatorNickname: p.creatorNickname,
        allow: { comment: !p.disableComment, duet: !p.disableDuet, stitch: !p.disableStitch },
        brandOrganic: p.brandOrganic,
        brandContent: p.brandContent,
        account: p.account,
        videoTitle: p.video.title,
        events: p.events.map((e) => ({ id: e.id, at: e.at.toISOString(), status: e.status, message: e.message })),
      },
    };
  });
}

// ─── Autollenar y bandeja ───────────────────────────────────────────────────

export async function autofillWeek(weekStartIso: string) {
  return run(async () => {
    const s = await sessionOrThrow();
    const count = await proposeWeek(s.org.id, new Date(weekStartIso));
    refresh();
    return { count };
  });
}

/** Contexto para aprobar en lote: creator_info de cada cuenta involucrada. */
export async function loadBatchContext(actionIds: string[]) {
  return run(async () => {
    const s = await sessionOrThrow();
    const actions = await db.action.findMany({ where: { id: { in: actionIds }, organizationId: s.org.id, status: "proposed" } });
    const accountIds = [...new Set(actions.map((a) => (a.payload as { accountId: string }).accountId))];
    const mode = tiktokMode();
    const accounts = await Promise.all(
      accountIds.map(async (id) => {
        const acc = await db.tikTokAccount.findUniqueOrThrow({ where: { id } });
        try {
          const info = await withAccessToken(id, (t) => tiktok().creatorInfo(t));
          return { id, displayName: acc.displayName, nickname: info.nickname, info, allowed: allowedPrivacy(info, mode), error: null };
        } catch (err) {
          return { id, displayName: acc.displayName, nickname: acc.displayName, info: null, allowed: [] as PrivacyLevel[], error: err instanceof Error ? err.message : "Sin conexión" };
        }
      }),
    );
    // Solo se ofrece lo que todas las cuentas permiten.
    const common = (["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"] as PrivacyLevel[]).filter((p) =>
      accounts.every((a) => a.allowed.includes(p)),
    );
    return {
      mode,
      accounts,
      common,
      commentLocked: accounts.some((a) => a.info?.commentDisabled),
      duetLocked: accounts.some((a) => a.info?.duetDisabled),
      stitchLocked: accounts.some((a) => a.info?.stitchDisabled),
    };
  });
}

export async function approveProposals(actionIds: string[], choices: Omit<PublishChoices, "caption"> & { caption?: string }) {
  return run(async () => {
    const s = await sessionOrThrow();
    const res = await approveTikTokActions({ organizationId: s.org.id, userId: s.user.id, actionIds, choices });
    refresh();
    return res;
  });
}

export async function discardProposals(actionIds: string[]) {
  return run(async () => {
    const s = await sessionOrThrow();
    const count = await discardActions(s.org.id, s.user.id, actionIds);
    refresh();
    return { count };
  });
}

// ─── Cuentas y artistas ─────────────────────────────────────────────────────

export async function saveAccountRules(
  accountId: string,
  rules: { artistId: string | null; preferredSlots: string[]; maxPostsPerDay: number; captionTemplate: string; hashtags: string[]; color: string },
) {
  return run(async () => {
    const s = await sessionOrThrow();
    const slots = [...new Set(rules.preferredSlots.map((t) => t.trim()))].filter(Boolean);
    const bad = slots.find((t) => !isValidTime(t));
    if (bad) throw new ValidationError([`"${bad}" no es una hora válida. Usá el formato 21:30.`]);
    if (!slots.length) throw new ValidationError(["Dejá al menos una franja horaria."]);
    if (!Number.isInteger(rules.maxPostsPerDay) || rules.maxPostsPerDay < 1 || rules.maxPostsPerDay > 15) {
      throw new ValidationError(["El tope diario va de 1 a 15 (el límite real de TikTok ronda los 15 por cuenta)."]);
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(rules.color)) throw new ValidationError(["Color inválido."]);
    if (rules.artistId) await db.artist.findFirstOrThrow({ where: { id: rules.artistId, organizationId: s.org.id } });
    await db.tikTokAccount.updateMany({
      where: { id: accountId, organizationId: s.org.id },
      data: {
        artistId: rules.artistId,
        preferredSlots: slots.sort(),
        maxPostsPerDay: rules.maxPostsPerDay,
        captionTemplate: rules.captionTemplate.trim() || null,
        hashtags: rules.hashtags.map((h) => h.trim().replace(/^#*/, "")).filter(Boolean).slice(0, 30),
        color: rules.color,
      },
    });
    refresh();
    return {};
  });
}

export async function disconnect(accountId: string) {
  return run(async () => {
    const s = await sessionOrThrow();
    await disconnectAccount(s.org.id, accountId);
    refresh();
    return {};
  });
}

export async function createArtist(name: string) {
  return run(async () => {
    const s = await sessionOrThrow();
    const clean = name.trim().slice(0, 80);
    if (!clean) throw new ValidationError(["Poné el nombre del artista."]);
    const slug = clean.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artista";
    const exists = await db.artist.findUnique({ where: { organizationId_slug: { organizationId: s.org.id, slug } } });
    if (exists) throw new ValidationError([`Ya existe ${exists.name}.`]);
    const artist = await db.artist.create({ data: { organizationId: s.org.id, name: clean, slug } });
    refresh();
    return { artist: { id: artist.id, name: artist.name } };
  });
}
