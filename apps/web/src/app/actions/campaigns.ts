"use server";

import { db } from "@88/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CAMPAIGN_TEMPLATE } from "@/lib/campaign-template";
import { addDays, parseDateInput } from "@/lib/dates";
import { optStr, str } from "@/lib/form";
import { CAMPAIGN_STATUS, isEnum } from "@/lib/labels";

export async function createCampaign(fd: FormData) {
  const releaseDate = parseDateInput(fd.get("releaseDate"));
  const trackId = optStr(fd, "trackId");
  let name = str(fd, "name");
  if (!releaseDate) return;

  if (!name && trackId) {
    const track = await db.track.findUnique({ where: { id: trackId }, include: { artist: true } });
    if (track) name = `${track.title} · ${track.artist.name}`;
  }
  if (!name) return;

  const campaign = await db.campaign.create({
    data: {
      name,
      trackId,
      releaseDate,
      tasks: {
        create: CAMPAIGN_TEMPLATE.map((t) => ({
          offsetDays: t.offset,
          title: t.title,
          detail: t.detail,
          dueDate: addDays(releaseDate, t.offset),
        })),
      },
    },
  });
  revalidatePath("/", "layout");
  redirect(`/campanas/${campaign.id}`);
}

export async function toggleTask(fd: FormData) {
  const id = str(fd, "id");
  const task = await db.campaignTask.findUnique({ where: { id } });
  if (!task) return;
  await db.campaignTask.update({ where: { id }, data: { doneAt: task.doneAt ? null : new Date() } });
  revalidatePath("/", "layout");
}

export async function setCampaignStatus(fd: FormData) {
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!id || !isEnum(CAMPAIGN_STATUS, status)) return;
  await db.campaign.update({ where: { id }, data: { status } });
  revalidatePath("/", "layout");
}

/** Mover la fecha de release recalcula las fechas de todas las tareas. */
export async function moveRelease(fd: FormData) {
  const id = str(fd, "id");
  const releaseDate = parseDateInput(fd.get("releaseDate"));
  if (!id || !releaseDate) return;
  const tasks = await db.campaignTask.findMany({ where: { campaignId: id } });
  await db.$transaction([
    db.campaign.update({ where: { id }, data: { releaseDate } }),
    ...tasks.map((t) =>
      db.campaignTask.update({ where: { id: t.id }, data: { dueDate: addDays(releaseDate, t.offsetDays) } }),
    ),
  ]);
  revalidatePath("/", "layout");
}

export async function deleteCampaign(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  await db.campaign.delete({ where: { id } });
  revalidatePath("/", "layout");
  redirect("/campanas");
}
