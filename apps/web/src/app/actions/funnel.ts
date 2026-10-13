"use server";

import { db } from "@88/db";
import { revalidatePath } from "next/cache";
import { int, str } from "@/lib/form";

/** Un snapshot por mes. Si ya existe ese mes, lo pisa. */
export async function saveSnapshot(fd: FormData) {
  const m = str(fd, "month").match(/^(\d{4})-(\d{2})$/);
  if (!m) return;
  const month = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const data = {
    monthlyListeners: int(fd, "monthlyListeners"),
    followers: int(fd, "followers"),
    emailSubs: int(fd, "emailSubs"),
    superfans: int(fd, "superfans"),
  };
  await db.fanSnapshot.upsert({ where: { month }, update: data, create: { month, ...data } });
  revalidatePath("/", "layout");
}

export async function deleteSnapshot(fd: FormData) {
  const id = str(fd, "id");
  if (!id) return;
  await db.fanSnapshot.delete({ where: { id } });
  revalidatePath("/", "layout");
}
