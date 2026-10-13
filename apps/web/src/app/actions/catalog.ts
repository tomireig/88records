"use server";

import { db } from "@88/db";
import { revalidatePath } from "next/cache";
import { parseDateInput } from "@/lib/dates";
import { duration, optInt, optStr, str } from "@/lib/form";
import { TRACK_STATUS, isEnum } from "@/lib/labels";

export async function createArtist(fd: FormData) {
  const name = str(fd, "name");
  if (!name) return;
  await db.artist.upsert({
    where: { name },
    update: {},
    create: { name, country: optStr(fd, "country"), genre: optStr(fd, "genre") },
  });
  revalidatePath("/", "layout");
}

function trackData(fd: FormData) {
  const status = str(fd, "status");
  return {
    title: str(fd, "title"),
    artistId: str(fd, "artistId"),
    status: isEnum(TRACK_STATUS, status) ? status : "DEMO",
    genre: optStr(fd, "genre")?.toLowerCase() ?? null,
    mood: optStr(fd, "mood"),
    bpm: optInt(fd, "bpm"),
    musicalKey: optStr(fd, "musicalKey"),
    durationSec: duration(fd, "duration"),
    isrc: optStr(fd, "isrc")?.toUpperCase() ?? null,
    releaseDate: parseDateInput(fd.get("releaseDate")),
    notes: optStr(fd, "notes"),
  };
}

export async function createTrack(fd: FormData) {
  const data = trackData(fd);
  if (!data.title || !data.artistId) return;
  await db.track.create({ data });
  revalidatePath("/", "layout");
}

export async function updateTrack(fd: FormData) {
  const id = str(fd, "id");
  const data = trackData(fd);
  if (!id || !data.title || !data.artistId) return;
  await db.track.update({ where: { id }, data });
  revalidatePath("/", "layout");
}

export async function deleteTrack(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  await db.track.delete({ where: { id } });
  revalidatePath("/", "layout");
}
