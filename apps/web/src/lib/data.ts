import "server-only";
import { storage } from "@88/core/storage";
import { atLocal, dayKey } from "@88/core/time";
import { db, type PostStatus } from "@88/db";
import {
  ACTIVE_STATUSES,
  connectionHealth,
  TIKTOK_PUBLISH,
  type ConnectionHealth,
  type TikTokPublishPayload,
  type TikTokPublishPreview,
} from "@88/services/tiktok";

export interface AccountDTO {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
  artistId: string | null;
  artistName: string | null;
  health: ConnectionHealth;
  lastError: string | null;
  maxPostsPerDay: number;
  preferredSlots: string[];
  captionTemplate: string | null;
  hashtags: string[];
  todayCount: number;
  nextPostAt: string | null;
  refreshExpiresAt: string;
}

export interface VideoDTO {
  id: string;
  title: string;
  status: "uploading" | "processing" | "ready" | "failed";
  error: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  thumbUrl: string | null;
  artistId: string | null;
  artistName: string | null;
  createdAt: string;
  /** Cuentas donde este archivo (o uno idéntico) ya está programado o publicado. */
  usedOn: { id: string; displayName: string; color: string }[];
}

export interface PostDTO {
  id: string;
  accountId: string;
  videoId: string;
  videoTitle: string;
  thumbUrl: string | null;
  scheduledFor: string;
  status: PostStatus;
  caption: string;
  failReason: string | null;
  mode: "direct" | "draft";
  publicPostId: string | null;
  privacyLevel: string | null;
}

export interface ProposalDTO {
  actionId: string;
  accountId: string;
  videoId: string;
  videoTitle: string;
  thumbUrl: string | null;
  scheduledFor: string;
  caption: string;
  reason: string;
}

export interface ArtistDTO {
  id: string;
  name: string;
}

async function signedThumb(key: string | null): Promise<string | null> {
  if (!key) return null;
  try {
    return await storage().downloadUrl(key, 3600);
  } catch {
    return null;
  }
}

export async function listArtists(organizationId: string): Promise<ArtistDTO[]> {
  return db.artist.findMany({ where: { organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function listAccounts(organizationId: string, tz: string): Promise<AccountDTO[]> {
  const now = new Date();
  const today = atLocal(dayKey(now, tz), "00:00", tz);
  const tomorrow = new Date(today.getTime() + 24 * 3600_000);
  const accounts = await db.tikTokAccount.findMany({
    where: { organizationId },
    include: {
      artist: { select: { name: true } },
      posts: {
        where: { status: { in: ACTIVE_STATUSES }, scheduledFor: { gte: today } },
        select: { scheduledFor: true, status: true },
        orderBy: { scheduledFor: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return accounts.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    avatarUrl: a.avatarUrl,
    color: a.color,
    artistId: a.artistId,
    artistName: a.artist?.name ?? null,
    health: connectionHealth(a, now),
    lastError: a.lastError,
    maxPostsPerDay: a.maxPostsPerDay,
    preferredSlots: a.preferredSlots,
    captionTemplate: a.captionTemplate,
    hashtags: a.hashtags,
    todayCount: a.posts.filter((p) => p.scheduledFor < tomorrow).length,
    nextPostAt: a.posts.find((p) => p.status === "scheduled" && p.scheduledFor > now)?.scheduledFor.toISOString() ?? null,
    refreshExpiresAt: a.refreshTokenExpiresAt.toISOString(),
  }));
}

export async function listVideos(organizationId: string): Promise<VideoDTO[]> {
  const videos = await db.video.findMany({
    where: { organizationId },
    include: { artist: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const hashes = videos.map((v) => v.sha256).filter((h): h is string => Boolean(h));
  const used = hashes.length
    ? await db.tikTokPost.findMany({
        where: { organizationId, status: { in: ACTIVE_STATUSES }, video: { sha256: { in: hashes } } },
        select: { video: { select: { sha256: true } }, account: { select: { id: true, displayName: true, color: true } } },
      })
    : [];
  const byHash = new Map<string, Map<string, VideoDTO["usedOn"][number]>>();
  for (const u of used) {
    const h = u.video.sha256!;
    if (!byHash.has(h)) byHash.set(h, new Map());
    byHash.get(h)!.set(u.account.id, u.account);
  }
  return Promise.all(
    videos.map(async (v) => ({
      id: v.id,
      title: v.title,
      status: v.status,
      error: v.error,
      durationSec: v.durationSec,
      width: v.width,
      height: v.height,
      sizeBytes: v.sizeBytes === null ? null : Number(v.sizeBytes),
      thumbUrl: await signedThumb(v.thumbnailKey),
      artistId: v.artistId,
      artistName: v.artist?.name ?? null,
      createdAt: v.createdAt.toISOString(),
      usedOn: v.sha256 ? [...(byHash.get(v.sha256)?.values() ?? [])] : [],
    })),
  );
}

export async function listPosts(organizationId: string, from: Date, to: Date): Promise<PostDTO[]> {
  const posts = await db.tikTokPost.findMany({
    where: { organizationId, scheduledFor: { gte: from, lt: to }, status: { not: "canceled" } },
    include: { video: { select: { title: true, thumbnailKey: true } } },
    orderBy: { scheduledFor: "asc" },
  });
  return Promise.all(
    posts.map(async (p) => ({
      id: p.id,
      accountId: p.accountId,
      videoId: p.videoId,
      videoTitle: p.video.title,
      thumbUrl: await signedThumb(p.video.thumbnailKey),
      scheduledFor: p.scheduledFor.toISOString(),
      status: p.status,
      caption: p.caption,
      failReason: p.failReason,
      mode: p.mode,
      publicPostId: p.publicPostId,
      privacyLevel: p.privacyLevel,
    })),
  );
}

export async function listProposals(organizationId: string, from?: Date, to?: Date): Promise<ProposalDTO[]> {
  const actions = await db.action.findMany({
    where: {
      organizationId,
      type: TIKTOK_PUBLISH,
      status: "proposed",
      scheduledFor: from && to ? { gte: from, lt: to } : undefined,
    },
    orderBy: { scheduledFor: "asc" },
  });
  return Promise.all(
    actions.map(async (a) => {
      const payload = a.payload as unknown as TikTokPublishPayload;
      const preview = a.preview as unknown as TikTokPublishPreview;
      return {
        actionId: a.id,
        accountId: payload.accountId,
        videoId: payload.videoId,
        videoTitle: preview.videoTitle,
        thumbUrl: await signedThumb(preview.thumbnailKey),
        scheduledFor: payload.scheduledFor,
        caption: payload.caption,
        reason: a.reason,
      };
    }),
  );
}

export async function countProposals(organizationId: string): Promise<number> {
  return db.action.count({ where: { organizationId, status: "proposed" } });
}
