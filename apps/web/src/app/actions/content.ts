"use server";

import { db } from "@88/db";
import { revalidatePath } from "next/cache";
import { buildBatch } from "@/lib/content-batch";
import { addDays, parseDateInput, today } from "@/lib/dates";
import { int, optStr, str } from "@/lib/form";
import { FORMATS, PLATFORMS, STAGES, STAGE_ORDER, isEnum } from "@/lib/labels";

export async function createPiece(fd: FormData) {
  const title = str(fd, "title");
  const platform = str(fd, "platform");
  const format = str(fd, "format");
  if (!title || !isEnum(PLATFORMS, platform) || !isEnum(FORMATS, format)) return;
  await db.contentPiece.create({
    data: {
      title,
      platform,
      format,
      hook: optStr(fd, "hook"),
      scheduledFor: parseDateInput(fd.get("scheduledFor")),
      campaignId: optStr(fd, "campaignId"),
      trackId: optStr(fd, "trackId"),
    },
  });
  revalidatePath("/", "layout");
}

export async function movePiece(fd: FormData) {
  const id = str(fd, "id");
  const dir = str(fd, "dir") === "back" ? -1 : 1;
  const piece = await db.contentPiece.findUnique({ where: { id } });
  if (!piece) return;
  const next = STAGE_ORDER[STAGE_ORDER.indexOf(piece.stage) + dir];
  if (!next) return;
  await db.contentPiece.update({
    where: { id },
    data: {
      stage: next,
      publishedAt: next === "PUBLISHED" ? (piece.publishedAt ?? new Date()) : piece.publishedAt,
    },
  });
  revalidatePath("/", "layout");
}

export async function updatePiece(fd: FormData) {
  const id = str(fd, "id");
  const platform = str(fd, "platform");
  const format = str(fd, "format");
  const stage = str(fd, "stage");
  if (!id || !str(fd, "title")) return;
  await db.contentPiece.update({
    where: { id },
    data: {
      title: str(fd, "title"),
      hook: optStr(fd, "hook"),
      notes: optStr(fd, "notes"),
      scheduledFor: parseDateInput(fd.get("scheduledFor")),
      ...(isEnum(PLATFORMS, platform) && { platform }),
      ...(isEnum(FORMATS, format) && { format }),
      ...(isEnum(STAGES, stage) && { stage }),
      views: int(fd, "views"),
      likes: int(fd, "likes"),
      comments: int(fd, "comments"),
      shares: int(fd, "shares"),
      saves: int(fd, "saves"),
    },
  });
  revalidatePath("/", "layout");
}

export async function deletePiece(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  await db.contentPiece.delete({ where: { id } });
  revalidatePath("/", "layout");
}

/**
 * Genera 20 piezas para 4 semanas. Si hay campaña, arranca en D−21 (o hoy, si
 * D−21 ya pasó). Si no, arranca hoy.
 */
export async function generateBatch(fd: FormData) {
  const campaignId = optStr(fd, "campaignId");
  const campaign = campaignId
    ? await db.campaign.findUnique({ where: { id: campaignId }, include: { track: true } })
    : null;

  let start = today();
  if (campaign) {
    const d21 = addDays(campaign.releaseDate, -21);
    if (d21 > start) start = d21;
  }
  const label = campaign?.track?.title ?? campaign?.name ?? "Batch";

  await db.contentPiece.createMany({
    data: buildBatch(start, label).map((p) => ({
      ...p,
      campaignId: campaign?.id ?? null,
      trackId: campaign?.trackId ?? null,
    })),
  });
  revalidatePath("/", "layout");
}
