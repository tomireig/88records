// Convierte "Autollenar semana" en acciones propuestas para la bandeja.
import { autofillWeek } from "@88/core/scheduling";
import { timeKey } from "@88/core/time";
import { db } from "@88/db";
import { ACTIVE_STATUSES, buildCaption } from "./posts";

export const TIKTOK_PUBLISH = "tiktok.publish";

export interface TikTokPublishPayload {
  accountId: string;
  videoId: string;
  scheduledFor: string;
  caption: string;
}

export interface TikTokPublishPreview {
  accountName: string;
  accountColor: string;
  avatarUrl: string | null;
  videoTitle: string;
  thumbnailKey: string | null;
  durationSec: number | null;
}

export async function proposeWeek(organizationId: string, weekStart: Date): Promise<number> {
  const org = await db.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600_000);

  const [accounts, videos, posts, proposals] = await Promise.all([
    db.tikTokAccount.findMany({ where: { organizationId, status: "active" }, orderBy: { createdAt: "asc" } }),
    db.video.findMany({
      where: {
        organizationId,
        status: "ready",
        tiktokPosts: { none: { status: { in: ACTIVE_STATUSES } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.tikTokPost.findMany({
      where: { organizationId, status: { in: ACTIVE_STATUSES } },
      select: { accountId: true, scheduledFor: true, video: { select: { sha256: true } } },
    }),
    db.action.findMany({ where: { organizationId, type: TIKTOK_PUBLISH, status: "proposed" } }),
  ]);

  const proposed = proposals.map((a) => a.payload as unknown as TikTokPublishPayload);
  const proposedVideoIds = new Set(proposed.map((p) => p.videoId));
  const pending = videos.filter((v) => !proposedVideoIds.has(v.id));

  const occupied = [
    ...posts.filter((p) => p.scheduledFor >= weekStart && p.scheduledFor < weekEnd).map((p) => ({ accountId: p.accountId, at: p.scheduledFor })),
    ...proposed.map((p) => ({ accountId: p.accountId, at: new Date(p.scheduledFor) })),
  ];
  const usedHashes = new Set(posts.map((p) => p.video.sha256).filter((h): h is string => Boolean(h)));
  for (const v of videos) if (proposedVideoIds.has(v.id) && v.sha256) usedHashes.add(v.sha256);

  const assignments = autofillWeek({
    weekStart,
    tz: org.timezone,
    now: new Date(),
    accounts: accounts.map((a) => ({ id: a.id, artistId: a.artistId, preferredSlots: a.preferredSlots, maxPostsPerDay: a.maxPostsPerDay })),
    videos: pending.map((v) => ({ id: v.id, artistId: v.artistId, sha256: v.sha256 })),
    occupied,
    usedHashes,
  });

  const accById = new Map(accounts.map((a) => [a.id, a]));
  const vidById = new Map(pending.map((v) => [v.id, v]));
  await db.action.createMany({
    data: assignments.map((a) => {
      const account = accById.get(a.accountId)!;
      const video = vidById.get(a.videoId)!;
      const payload: TikTokPublishPayload = {
        accountId: account.id,
        videoId: video.id,
        scheduledFor: a.at.toISOString(),
        caption: buildCaption(account, video),
      };
      const preview: TikTokPublishPreview = {
        accountName: account.displayName,
        accountColor: account.color,
        avatarUrl: account.avatarUrl,
        videoTitle: video.title,
        thumbnailKey: video.thumbnailKey,
        durationSec: video.durationSec,
      };
      return {
        organizationId,
        artistId: account.artistId ?? video.artistId,
        type: TIKTOK_PUBLISH,
        payload: payload as never,
        preview: preview as never,
        scheduledFor: a.at,
        reason: `Hueco libre en la franja de las ${timeKey(a.at, org.timezone)} de ${account.displayName}. El video está listo y todavía no salió en ninguna cuenta.`,
      };
    }),
  });
  return assignments.length;
}
