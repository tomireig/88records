// Lanzamientos: el artista sube el tema, la portada y opcionalmente material crudo.
// El worker analiza, renderiza las piezas y propone la campaña en la bandeja.
import { enqueue, JOBS } from "@88/core/queue";
import { releaseKey, storage, type UploadTarget } from "@88/core/storage";
import { db, type Release } from "@88/db";
import { randomUUID } from "node:crypto";
import { createUpload, LibraryError, VIDEO_TYPES } from "./library";

export const AUDIO_TYPES: Record<string, string> = {
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "audio/aac": "aac",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
};

export const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_AUDIO = 400 * 1024 ** 2;
const MAX_IMAGE = 25 * 1024 ** 2;

export interface FileSpec {
  fileName: string;
  size: number;
  mimeType: string;
}

export async function createRelease(params: {
  organizationId: string;
  userId: string;
  artistId: string;
  title: string;
  releaseDate: string;
  lyrics?: string;
  audio: FileSpec;
  cover: FileSpec | null;
  clips: FileSpec[];
}): Promise<{ release: Release; audio: UploadTarget; cover: UploadTarget | null; clips: { videoId: string; upload: UploadTarget }[] }> {
  const title = params.title.trim().slice(0, 120);
  if (!title) throw new LibraryError("Poné el nombre del tema.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.releaseDate)) throw new LibraryError("Elegí la fecha de lanzamiento.");
  const audioExt = AUDIO_TYPES[params.audio.mimeType];
  if (!audioExt) throw new LibraryError("El audio tiene que ser WAV, MP3, FLAC o M4A.");
  if (params.audio.size <= 0 || params.audio.size > MAX_AUDIO) throw new LibraryError("El audio tiene que pesar menos de 400 MB.");
  const coverExt = params.cover ? IMAGE_TYPES[params.cover.mimeType] : null;
  if (params.cover && !coverExt) throw new LibraryError("La portada tiene que ser JPG, PNG o WebP.");
  if (params.cover && params.cover.size > MAX_IMAGE) throw new LibraryError("La portada tiene que pesar menos de 25 MB.");
  for (const c of params.clips) {
    if (!VIDEO_TYPES[c.mimeType]) throw new LibraryError(`${c.fileName}: los videos crudos tienen que ser MP4, MOV o WebM.`);
  }
  await db.artist.findFirstOrThrow({ where: { id: params.artistId, organizationId: params.organizationId } });

  const id = randomUUID();
  const audioKey = releaseKey(params.organizationId, id, `audio.${audioExt}`);
  const coverKey = coverExt ? releaseKey(params.organizationId, id, `cover.${coverExt}`) : null;
  const release = await db.release.create({
    data: {
      id,
      organizationId: params.organizationId,
      artistId: params.artistId,
      title,
      releaseDate: new Date(`${params.releaseDate}T12:00:00Z`),
      lyrics: params.lyrics?.trim() || null,
      audioKey,
      coverKey,
      createdById: params.userId,
    },
  });

  const s = storage();
  const audio = await s.uploadTarget(audioKey, params.audio.mimeType, 6 * 3600);
  const cover = coverKey && params.cover ? await s.uploadTarget(coverKey, params.cover.mimeType, 6 * 3600) : null;
  const clips = [];
  for (const c of params.clips) {
    const { video, upload } = await createUpload({
      organizationId: params.organizationId,
      userId: params.userId,
      fileName: c.fileName,
      size: c.size,
      mimeType: c.mimeType,
      artistId: params.artistId,
      source: "raw",
      releaseId: id,
    });
    clips.push({ videoId: video.id, upload });
  }
  return { release, audio, cover, clips };
}

/** Cuando el navegador terminó de subir todo: arranca el análisis. */
export async function startReleaseAnalysis(organizationId: string, releaseId: string): Promise<void> {
  const release = await db.release.findFirstOrThrow({ where: { id: releaseId, organizationId } });
  if (!release.audioKey || !(await storage().size(release.audioKey))) {
    throw new LibraryError("El audio no llegó al storage. Probá subirlo de nuevo.");
  }
  const raw = await db.video.findMany({ where: { releaseId, source: "raw", status: "uploading" } });
  for (const v of raw) {
    if (await storage().size(v.storageKey)) {
      await db.video.update({ where: { id: v.id }, data: { status: "processing" } });
      await enqueue(JOBS.libraryProcess, { videoId: v.id });
    } else {
      await db.video.delete({ where: { id: v.id } });
    }
  }
  await db.release.update({ where: { id: releaseId }, data: { status: "analyzing", error: null } });
  await enqueue(JOBS.releaseAnalyze, { releaseId });
}

export async function requestCampaign(organizationId: string, releaseId: string): Promise<void> {
  await db.release.findFirstOrThrow({ where: { id: releaseId, organizationId } });
  await enqueue(JOBS.campaignPropose, { releaseId });
}

export async function retryRelease(organizationId: string, releaseId: string): Promise<void> {
  const release = await db.release.findFirstOrThrow({ where: { id: releaseId, organizationId } });
  if (release.status !== "failed") throw new LibraryError("Solo se puede reintentar un lanzamiento con error.");
  await db.release.update({ where: { id: releaseId }, data: { status: "analyzing", error: null } });
  await enqueue(JOBS.releaseAnalyze, { releaseId });
}
