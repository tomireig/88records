// Biblioteca de videos: el navegador sube directo al storage con una URL firmada y
// el worker procesa (duración, tamaño, hash, miniatura).
import { enqueue, JOBS } from "@88/core/queue";
import { storage, videoKey, type UploadTarget } from "@88/core/storage";
import { db, type Video } from "@88/db";
import { randomUUID } from "node:crypto";

export const VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** TikTok acepta hasta 4 GB por video. */
export const MAX_VIDEO_BYTES = 4 * 1024 ** 3;

export class LibraryError extends Error {}

export async function createUpload(params: {
  organizationId: string;
  userId: string;
  fileName: string;
  size: number;
  mimeType: string;
  artistId?: string | null;
  /** "upload" para la biblioteca; "raw" para material crudo de un lanzamiento */
  source?: "upload" | "raw";
  releaseId?: string | null;
}): Promise<{ video: Video; upload: UploadTarget }> {
  const ext = VIDEO_TYPES[params.mimeType];
  if (!ext) throw new LibraryError("Formato no soportado. Subí MP4, MOV o WebM.");
  if (params.size <= 0 || params.size > MAX_VIDEO_BYTES) throw new LibraryError("El archivo tiene que pesar menos de 4 GB.");
  if (params.artistId) {
    await db.artist.findFirstOrThrow({ where: { id: params.artistId, organizationId: params.organizationId } });
  }

  const id = randomUUID();
  const title = params.fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 120) || "Video";
  const video = await db.video.create({
    data: {
      id,
      organizationId: params.organizationId,
      artistId: params.artistId || null,
      title,
      storageKey: videoKey(params.organizationId, id, ext),
      mimeType: params.mimeType,
      sizeBytes: BigInt(params.size),
      uploadedById: params.userId,
      source: params.source ?? "upload",
      releaseId: params.releaseId ?? null,
    },
  });
  const upload = await storage().uploadTarget(video.storageKey, params.mimeType, 6 * 3600);
  return { video, upload };
}

export async function completeUpload(organizationId: string, videoId: string): Promise<void> {
  const video = await db.video.findFirstOrThrow({ where: { id: videoId, organizationId } });
  if (video.status !== "uploading") return;
  const size = await storage().size(video.storageKey);
  if (!size) throw new LibraryError("El archivo no llegó al storage. Probá subirlo de nuevo.");
  await db.video.update({ where: { id: videoId }, data: { status: "processing", sizeBytes: BigInt(size) } });
  await enqueue(JOBS.libraryProcess, { videoId });
}

export async function deleteVideo(organizationId: string, videoId: string): Promise<void> {
  const video = await db.video.findFirstOrThrow({ where: { id: videoId, organizationId }, include: { tiktokPosts: true } });
  if (video.tiktokPosts.some((p) => ["scheduled", "publishing", "processing"].includes(p.status))) {
    throw new LibraryError("Este video tiene publicaciones programadas. Cancelalas antes de borrarlo.");
  }
  if (video.tiktokPosts.length) {
    throw new LibraryError("Este video ya se publicó: queda en la biblioteca para el historial.");
  }
  await db.action.updateMany({
    where: { organizationId, status: "proposed", payload: { path: ["videoId"], equals: videoId } },
    data: { status: "discarded" },
  });
  await db.video.delete({ where: { id: videoId } });
  await Promise.all([storage().remove(video.storageKey), video.thumbnailKey ? storage().remove(video.thumbnailKey) : null]);
}

export async function renameVideo(organizationId: string, videoId: string, title: string, artistId: string | null): Promise<void> {
  const clean = title.trim().slice(0, 120);
  if (!clean) throw new LibraryError("El título no puede quedar vacío.");
  await db.video.updateMany({ where: { id: videoId, organizationId }, data: { title: clean, artistId } });
}
