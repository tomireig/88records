import { describe, expect, it } from "vitest";
import { PlatformError } from "../errors";
import { chunkPlan, TikTokClient } from "./index";

type Call = { url: string; init: RequestInit };

function mockFetch(handler: (url: string, init: RequestInit) => { status?: number; json?: unknown }) {
  const calls: Call[] = [];
  const fn = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    const r = handler(url, init);
    return new Response(r.json === undefined ? null : JSON.stringify(r.json), { status: r.status ?? 200 });
  }) as typeof fetch;
  return { fn, calls };
}

const MB = 1024 * 1024;

describe("chunkPlan", () => {
  it("manda archivos chicos en un solo chunk", () => {
    expect(chunkPlan(3 * MB)).toEqual({ chunkSize: 3 * MB, totalChunkCount: 1 });
    expect(chunkPlan(64 * MB)).toEqual({ chunkSize: 64 * MB, totalChunkCount: 1 });
  });

  it("parte en chunks de 10 MB y suma el resto al último", () => {
    expect(chunkPlan(95 * MB)).toEqual({ chunkSize: 10 * MB, totalChunkCount: 9 });
  });
});

describe("TikTokClient", () => {
  it("arma la URL de autorización con los scopes y el state", () => {
    const c = new TikTokClient({ clientKey: "ck", clientSecret: "cs" });
    const url = new URL(c.authorizeUrl({ state: "st", redirectUri: "http://localhost:3000/api/tiktok/callback" }));
    expect(url.origin + url.pathname).toBe("https://www.tiktok.com/v2/auth/authorize/");
    expect(url.searchParams.get("scope")).toBe("user.info.basic,video.upload,video.publish");
    expect(url.searchParams.get("state")).toBe("st");
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("canjea el code por tokens", async () => {
    const { fn, calls } = mockFetch(() => ({
      json: { access_token: "act", refresh_token: "rft", expires_in: 86400, refresh_expires_in: 31536000, open_id: "oid", scope: "user.info.basic,video.publish" },
    }));
    const c = new TikTokClient({ clientKey: "ck", clientSecret: "cs", fetch: fn });
    const t = await c.exchangeCode({ code: "abc", redirectUri: "http://x/cb" });
    expect(t.accessToken).toBe("act");
    expect(t.accountId).toBe("oid");
    expect(t.scopes).toEqual(["user.info.basic", "video.publish"]);
    const body = new URLSearchParams(String(calls[0]!.init.body));
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_secret")).toBe("cs");
  });

  it("clasifica errores de la API", async () => {
    const { fn } = mockFetch(() => ({ status: 401, json: { error: { code: "access_token_invalid", message: "expired" } } }));
    const c = new TikTokClient({ fetch: fn });
    const err = await c.creatorInfo("x").catch((e) => e);
    expect(err).toBeInstanceOf(PlatformError);
    expect(err.kind).toBe("auth");
    expect(err.message).toContain("Reconectala");
  });

  it("publica directo subiendo en chunks con Content-Range", async () => {
    const size = 25 * MB + 123;
    const { fn, calls } = mockFetch((url) => {
      if (url.endsWith("/v2/post/publish/video/init/")) {
        return { json: { data: { publish_id: "p1", upload_url: "https://upload.test/u?x=1" }, error: { code: "ok" } } };
      }
      return { status: 206 };
    });
    const c = new TikTokClient({ fetch: fn });
    // 25 MB entra en un solo chunk (≤ 64 MB)
    const res = await c.publishVideo(
      "act",
      { mode: "direct", caption: "hola #techengue", privacyLevel: "SELF_ONLY", disableComment: true, disableDuet: true, disableStitch: false, brandOrganic: false, brandContent: false },
      { size, mimeType: "video/mp4", readRange: async (s, e) => Buffer.alloc(e - s + 1) },
    );
    expect(res.publishId).toBe("p1");
    const init = JSON.parse(String(calls[0]!.init.body));
    expect(init.post_info).toMatchObject({ title: "hola #techengue", privacy_level: "SELF_ONLY", disable_stitch: false });
    expect(init.source_info).toEqual({ source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 });
    const put = calls[1]!;
    expect(put.init.method).toBe("PUT");
    expect((put.init.headers as Record<string, string>)["Content-Range"]).toBe(`bytes 0-${size - 1}/${size}`);
  });

  it("sube archivos grandes en varios chunks y el último lleva el resto", async () => {
    const size = 95 * MB;
    const { fn, calls } = mockFetch((url) =>
      url.includes("/inbox/video/init/")
        ? { json: { data: { publish_id: "p2", upload_url: "https://upload.test/u" }, error: { code: "ok" } } }
        : { status: 206 },
    );
    const c = new TikTokClient({ fetch: fn });
    await c.publishVideo(
      "act",
      { mode: "draft", caption: "", privacyLevel: "SELF_ONLY", disableComment: true, disableDuet: true, disableStitch: true, brandOrganic: false, brandContent: false },
      { size, mimeType: "video/mp4", readRange: async (s, e) => Buffer.alloc(e - s + 1) },
    );
    const puts = calls.filter((c) => c.init.method === "PUT");
    expect(puts).toHaveLength(9);
    expect((puts[8]!.init.headers as Record<string, string>)["Content-Range"]).toBe(`bytes ${80 * MB}-${size - 1}/${size}`);
    expect(JSON.parse(String(calls[0]!.init.body))).not.toHaveProperty("post_info");
  });

  it("traduce el estado de la publicación", async () => {
    const { fn } = mockFetch(() => ({ json: { data: { status: "PUBLISH_COMPLETE", publicaly_available_post_id: [7123] }, error: { code: "ok" } } }));
    expect(await new TikTokClient({ fetch: fn }).fetchStatus("a", "p")).toEqual({ state: "published", publicPostId: "7123" });
  });
});
