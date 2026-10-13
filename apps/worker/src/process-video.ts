import { storage, thumbnailKey } from "@88/core/storage";
import { db } from "@88/db";
import { probe, sha256File, thumbnail } from "@88/video";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Duración, tamaño, hash y miniatura de un video recién subido. False si ya no existe o ya estaba listo. */
export async function processVideo(videoId: string, finalAttempt: boolean): Promise<boolean> {
  const video = await db.video.findUnique({ where: { id: videoId } });
  if (!video || video.status === "ready") return false;

  const s = storage();
  const local = await s.toLocalFile(video.storageKey);
  const thumbPath = join(tmpdir(), `88thumb-${video.id}.jpg`);
  try {
    const info = await probe(local.path);
    const sha256 = await sha256File(local.path);
    await thumbnail(local.path, thumbPath, Math.min(1, info.durationSec / 2));
    const thumbKey = thumbnailKey(video.organizationId, video.id);
    await s.write(thumbKey, await readFile(thumbPath), "image/jpeg");

    await db.video.update({
      where: { id: video.id },
      data: {
        status: "ready",
        error: null,
        durationSec: info.durationSec,
        width: info.width,
        height: info.height,
        sha256,
        thumbnailKey: thumbKey,
      },
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (finalAttempt) {
      await db.video.update({
        where: { id: video.id },
        data: { status: "failed", error: `No se pudo leer el video: ${message.slice(0, 300)}` },
      });
      return false;
    }
    throw err;
  } finally {
    await local.cleanup();
    await rm(thumbPath, { force: true });
  }
}
