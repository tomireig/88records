// Storage en disco para desarrollo. Las URLs firmadas apuntan a /api/files del panel,
// que valida la firma y lee o escribe en la misma carpeta que usa el worker.
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { sign, verify } from "../crypto";
import { appUrl, repoRoot } from "../env";
import { assertSafeKey } from "./keys";
import type { Storage, UploadTarget } from "./index";

export type LocalOp = "get" | "put";

export class LocalStorage implements Storage {
  readonly driver = "local" as const;
  readonly root = resolve(process.env.STORAGE_LOCAL_DIR || resolve(repoRoot(), ".storage"));

  path(key: string): string {
    assertSafeKey(key);
    return resolve(this.root, key);
  }

  signedUrl(op: LocalOp, key: string, expiresSec: number): string {
    assertSafeKey(key);
    const exp = Math.floor(Date.now() / 1000) + expiresSec;
    const sig = sign(`${op}:${key}:${exp}`);
    return `${appUrl()}/api/files/${key}?op=${op}&exp=${exp}&sig=${sig}`;
  }

  static verifySignature(op: LocalOp, key: string, exp: string | null, sig: string | null): boolean {
    if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
    return verify(`${op}:${key}:${exp}`, sig);
  }

  async uploadTarget(key: string, contentType: string, expiresSec = 3600): Promise<UploadTarget> {
    return { url: this.signedUrl("put", key, expiresSec), method: "PUT", headers: { "Content-Type": contentType } };
  }

  async downloadUrl(key: string, expiresSec = 3600): Promise<string> {
    return this.signedUrl("get", key, expiresSec);
  }

  async read(key: string, range?: { start: number; end: number }): Promise<Readable> {
    return createReadStream(this.path(key), range);
  }

  async write(key: string, body: Buffer | Readable, _contentType: string): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    const source = Buffer.isBuffer(body) ? Readable.from([body]) : body;
    await pipeline(source, createWriteStream(file));
  }

  async size(key: string): Promise<number | null> {
    try {
      return (await stat(this.path(key))).size;
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  async toLocalFile(key: string) {
    return { path: this.path(key), cleanup: async () => {} };
  }
}
