// Cloudflare R2 (o cualquier S3) con URLs firmadas. R2 no cobra la descarga.
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { assertSafeKey } from "./keys";
import type { Storage, UploadTarget } from "./index";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta ${name} para el storage S3/R2`);
  return v;
}

export class S3Storage implements Storage {
  readonly driver = "s3" as const;
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = required("S3_BUCKET");
    this.client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: required("S3_ENDPOINT"),
      credentials: { accessKeyId: required("S3_ACCESS_KEY_ID"), secretAccessKey: required("S3_SECRET_ACCESS_KEY") },
      // R2 no soporta los checksums nuevos del SDK en URLs firmadas.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async uploadTarget(key: string, contentType: string, expiresSec = 3600): Promise<UploadTarget> {
    assertSafeKey(key);
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresSec },
    );
    return { url, method: "PUT", headers: { "Content-Type": contentType } };
  }

  async downloadUrl(key: string, expiresSec = 3600): Promise<string> {
    assertSafeKey(key);
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn: expiresSec });
  }

  async read(key: string, range?: { start: number; end: number }): Promise<Readable> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range ? `bytes=${range.start}-${range.end}` : undefined }),
    );
    if (!res.Body) throw new Error(`Objeto vacío: ${key}`);
    return res.Body as Readable;
  }

  async write(key: string, body: Buffer | Readable, contentType: string): Promise<void> {
    assertSafeKey(key);
    const length = Buffer.isBuffer(body) ? body.length : undefined;
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType, ContentLength: length }),
    );
  }

  async size(key: string): Promise<number | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return res.ContentLength ?? null;
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async toLocalFile(key: string) {
    const dir = await mkdtemp(join(tmpdir(), "88-"));
    const path = join(dir, basename(key));
    await pipeline(await this.read(key), createWriteStream(path));
    return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
  }
}
