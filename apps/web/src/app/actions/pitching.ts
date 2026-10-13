"use server";

import { db } from "@88/db";
import { revalidatePath } from "next/cache";
import { addDays, today } from "@/lib/dates";
import { float, int, list, optInt, optStr, str } from "@/lib/form";
import { PITCH_STAGES, isEnum } from "@/lib/labels";

export async function createCurator(fd: FormData) {
  const name = str(fd, "name");
  const playlist = str(fd, "playlist");
  if (!name || !playlist) return;
  await db.curator.create({
    data: {
      name,
      playlist,
      url: optStr(fd, "url"),
      genres: list(fd, "genres"),
      followers: optInt(fd, "followers"),
      email: optStr(fd, "email"),
      instagram: optStr(fd, "instagram"),
      language: str(fd, "language") === "en" ? "en" : "es",
      notes: optStr(fd, "notes"),
    },
  });
  revalidatePath("/", "layout");
}

export async function deleteCurator(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  await db.curator.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export async function createPitch(fd: FormData) {
  const curatorId = str(fd, "curatorId");
  const trackId = str(fd, "trackId");
  if (!curatorId || !trackId) return;
  const exists = await db.pitch.findFirst({ where: { curatorId, trackId } });
  if (exists) return;
  await db.pitch.create({ data: { curatorId, trackId } });
  revalidatePath("/", "layout");
}

export async function setPitchStage(fd: FormData) {
  const id = str(fd, "id");
  const stage = str(fd, "stage");
  if (!id || !isEnum(PITCH_STAGES, stage)) return;
  const pitch = await db.pitch.findUnique({ where: { id } });
  if (!pitch) return;

  const now = today();
  const data: { stage: typeof stage; sentAt?: Date; followUpAt?: Date | null } = { stage };
  // Al mandarlo, agenda el follow-up a 7 días.
  if (stage === "SENT" && !pitch.sentAt) {
    data.sentAt = now;
    data.followUpAt = addDays(now, 7);
  }
  if (stage === "FOLLOW_UP") data.followUpAt = addDays(now, 7);
  if (stage === "ACCEPTED" || stage === "REJECTED") data.followUpAt = null;

  await db.pitch.update({ where: { id }, data });
  revalidatePath("/", "layout");
}

export async function updatePitch(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  await db.pitch.update({
    where: { id },
    data: { costUsd: float(fd, "costUsd"), adds: int(fd, "adds"), message: optStr(fd, "message") },
  });
  revalidatePath("/", "layout");
}

export async function deletePitch(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  await db.pitch.delete({ where: { id } });
  revalidatePath("/", "layout");
}
