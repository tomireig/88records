// Storage local (solo desarrollo): sirve y recibe archivos con URLs firmadas que vencen,
// igual que R2. En producción el storage es S3/R2 y esta ruta no se usa.
import { LocalStorage, storage } from "@88/core/storage";
import { createReadStream } from "node:fs";
import { mkdir, rename, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", jpg: "image/jpeg", png: "image/png" };

function local(): LocalStorage | null {
  const s = storage();
  return s instanceof LocalStorage ? s : null;
}

type Ctx = { params: Promise<{ key: string[] }> };

async function authorize(req: Request, ctx: Ctx, op: "get" | "put") {
  const s = local();
  if (!s) return { error: new Response("No disponible", { status: 404 }) };
  const key = (await ctx.params).key.join("/");
  const url = new URL(req.url);
  if (url.searchParams.get("op") !== op || !LocalStorage.verifySignature(op, key, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return { error: new Response("Link vencido o inválido", { status: 403 }) };
  }
  return { s, key, path: s.path(key) };
}

export async function GET(req: Request, ctx: Ctx) {
  const a = await authorize(req, ctx, "get");
  if ("error" in a) return a.error;
  let size: number;
  try {
    size = (await stat(a.path)).size;
  } catch {
    return new Response("No existe", { status: 404 });
  }
  const type = TYPES[a.key.split(".").pop() ?? ""] ?? "application/octet-stream";
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  // Rangos para que el <video> pueda adelantar.
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(a.path, { start, end })) as ReadableStream;
    return new Response(stream, {
      status: 206,
      headers: { "Content-Type": type, "Content-Length": String(end - start + 1), "Content-Range": `bytes ${start}-${end}/${size}`, "Accept-Ranges": "bytes" },
    });
  }
  const stream = Readable.toWeb(createReadStream(a.path)) as ReadableStream;
  return new Response(stream, {
    headers: { "Content-Type": type, "Content-Length": String(size), "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" },
  });
}

export async function PUT(req: Request, ctx: Ctx) {
  const a = await authorize(req, ctx, "put");
  if ("error" in a) return a.error;
  if (!req.body) return new Response("Sin contenido", { status: 400 });
  await mkdir(dirname(a.path), { recursive: true });
  const tmp = `${a.path}.part`;
  await pipeline(Readable.fromWeb(req.body as never), createWriteStream(tmp));
  await rename(tmp, a.path);
  return new Response(null, { status: 200 });
}
