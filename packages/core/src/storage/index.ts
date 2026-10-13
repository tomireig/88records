import type { Readable } from "node:stream";
import { LocalStorage } from "./local";
import { S3Storage } from "./s3";
export { assertSafeKey, videoKey, thumbnailKey } from "./keys";

export interface UploadTarget {
  url: string;
  method: "PUT";
  headers: Record<string, string>;
}

export interface Storage {
  readonly driver: "local" | "s3";
  /** URL firmada para que el navegador suba directo, sin pasar por el servidor. */
  uploadTarget(key: string, contentType: string, expiresSec?: number): Promise<UploadTarget>;
  /** URL firmada de lectura con vencimiento. */
  downloadUrl(key: string, expiresSec?: number): Promise<string>;
  read(key: string, range?: { start: number; end: number }): Promise<Readable>;
  write(key: string, body: Buffer | Readable, contentType: string): Promise<void>;
  size(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
  /** Ruta local para FFmpeg. En S3 baja a un temporal; llamar a cleanup al terminar. */
  toLocalFile(key: string): Promise<{ path: string; cleanup: () => Promise<void> }>;
}

let instance: Storage | undefined;

export function storage(): Storage {
  if (instance) return instance;
  const driver = process.env.STORAGE_DRIVER || "local";
  if (driver === "s3") instance = new S3Storage();
  else if (driver === "local") {
    if (process.env.VERCEL) throw new Error("En Vercel el storage local no persiste: configurá STORAGE_DRIVER=s3 con R2.");
    instance = new LocalStorage();
  } else throw new Error(`STORAGE_DRIVER desconocido: ${driver}`);
  return instance;
}

export { LocalStorage, S3Storage };
