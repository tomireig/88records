// TikTok: Login Kit (OAuth 2.0) + Content Posting API v2.
// Docs: developers.tiktok.com/doc/login-kit-web, /doc/content-posting-api-reference-direct-post
// Login Kit para web no usa PKCE (es para apps móviles y de escritorio): la protección es el
// `state` firmado que valida el callback.
import { PlatformError, type ErrorKind } from "../errors";
import type {
  PlatformConnector,
  Profile,
  PublishStatus,
  SocialProvider,
  TokenSet,
  VideoSource,
} from "../index";
import { describeTikTokError } from "./messages";

export { describeTikTokError, describeFailReason } from "./messages";

export const TIKTOK_SCOPES = ["user.info.basic", "video.upload", "video.publish"] as const;

export type PrivacyLevel = "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "FOLLOWER_OF_CREATOR" | "SELF_ONLY";

export interface CreatorInfo {
  avatarUrl: string | null;
  username: string;
  nickname: string;
  privacyLevelOptions: PrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number;
}

export interface TikTokPublishOptions {
  /** "direct" publica; "draft" lo manda a la bandeja de la app de TikTok. */
  mode: "direct" | "draft";
  caption: string;
  privacyLevel: PrivacyLevel;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  brandOrganic: boolean;
  brandContent: boolean;
}

interface Config {
  clientKey: string;
  clientSecret: string;
  apiBase: string;
  authBase: string;
  fetch: typeof fetch;
}

export const CAPTION_MAX = 2200;
const MB = 1024 * 1024;
const SINGLE_CHUNK_MAX = 64 * MB;
const CHUNK_SIZE = 10 * MB;

/** Reglas de la API: hasta 64 MB va en un solo chunk; si no, chunks de 10 MB y el resto se suma al último. */
export function chunkPlan(size: number): { chunkSize: number; totalChunkCount: number } {
  if (size <= 0) throw new Error("El video está vacío");
  if (size <= SINGLE_CHUNK_MAX) return { chunkSize: size, totalChunkCount: 1 };
  const totalChunkCount = Math.floor(size / CHUNK_SIZE);
  if (totalChunkCount > 1000) throw new Error("El video es demasiado grande para TikTok");
  return { chunkSize: CHUNK_SIZE, totalChunkCount };
}

function kindFor(status: number, code: string): ErrorKind {
  if (code === "access_token_invalid" || status === 401) return "auth";
  if (code === "rate_limit_exceeded" || status === 429) return "rate_limit";
  if (status >= 500 || code === "internal_error") return "transient";
  return "permanent";
}

export class TikTokClient implements PlatformConnector, SocialProvider<TikTokPublishOptions> {
  readonly platform = "tiktok" as const;
  private cfg: Config;

  constructor(cfg: Partial<Config> = {}) {
    this.cfg = {
      clientKey: cfg.clientKey ?? process.env.TIKTOK_CLIENT_KEY ?? "",
      clientSecret: cfg.clientSecret ?? process.env.TIKTOK_CLIENT_SECRET ?? "",
      apiBase: (cfg.apiBase ?? process.env.TIKTOK_API_BASE ?? "https://open.tiktokapis.com").replace(/\/$/, ""),
      authBase: (cfg.authBase ?? process.env.TIKTOK_AUTH_BASE ?? "https://www.tiktok.com").replace(/\/$/, ""),
      fetch: cfg.fetch ?? fetch,
    };
  }

  static isConfigured(): boolean {
    return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET);
  }

  // ─── OAuth ────────────────────────────────────────────────────────────────

  authorizeUrl({ state, redirectUri }: { state: string; redirectUri: string }): string {
    const q = new URLSearchParams({
      client_key: this.cfg.clientKey,
      response_type: "code",
      scope: TIKTOK_SCOPES.join(","),
      redirect_uri: redirectUri,
      state,
      // Siempre mostrar la pantalla: así se puede elegir otra cuenta al conectar varias.
      disable_auto_auth: "1",
    });
    return `${this.cfg.authBase}/v2/auth/authorize/?${q}`;
  }

  exchangeCode({ code, redirectUri }: { code: string; redirectUri: string }): Promise<TokenSet> {
    return this.token({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  }

  refresh(refreshToken: string): Promise<TokenSet> {
    return this.token({ grant_type: "refresh_token", refresh_token: refreshToken });
  }

  async revoke(accessToken: string): Promise<void> {
    await this.cfg.fetch(`${this.cfg.apiBase}/v2/oauth/revoke/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: this.cfg.clientKey, client_secret: this.cfg.clientSecret, token: accessToken }),
    });
  }

  private async token(params: Record<string, string>): Promise<TokenSet> {
    const res = await this.cfg.fetch(`${this.cfg.apiBase}/v2/oauth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
      body: new URLSearchParams({ client_key: this.cfg.clientKey, client_secret: this.cfg.clientSecret, ...params }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || typeof json.access_token !== "string") {
      const code = String(json.error ?? `http_${res.status}`);
      const kind: ErrorKind = code === "invalid_grant" ? "auth" : kindFor(res.status, code);
      throw new PlatformError(describeTikTokError(code, String(json.error_description ?? "")), kind, code, json.log_id as string);
    }
    const now = Date.now();
    return {
      accessToken: json.access_token,
      refreshToken: String(json.refresh_token),
      accessTokenExpiresAt: new Date(now + Number(json.expires_in) * 1000),
      refreshTokenExpiresAt: new Date(now + Number(json.refresh_expires_in) * 1000),
      scopes: String(json.scope ?? "").split(",").filter(Boolean),
      accountId: String(json.open_id),
    };
  }

  // ─── API ──────────────────────────────────────────────────────────────────

  private async api<T>(accessToken: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await this.cfg.fetch(`${this.cfg.apiBase}${path}`, {
      method: init.method ?? "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const json = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: string; message?: string; log_id?: string; logid?: string } };
    const code = json.error?.code ?? (res.ok ? "ok" : `http_${res.status}`);
    if (code !== "ok" || !res.ok) {
      throw new PlatformError(
        describeTikTokError(code, json.error?.message ?? ""),
        kindFor(res.status, code),
        code,
        json.error?.log_id ?? json.error?.logid,
      );
    }
    return json.data as T;
  }

  async profile(accessToken: string): Promise<Profile> {
    const data = await this.api<{ user: { open_id: string; display_name?: string; avatar_url?: string } }>(
      accessToken,
      "/v2/user/info/?fields=open_id,display_name,avatar_url",
      { method: "GET" },
    );
    return { accountId: data.user.open_id, displayName: data.user.display_name || "Cuenta de TikTok", avatarUrl: data.user.avatar_url ?? null };
  }

  /** Obligatorio antes de mostrar la pantalla de publicación y antes de publicar. */
  async creatorInfo(accessToken: string): Promise<CreatorInfo> {
    const d = await this.api<{
      creator_avatar_url?: string;
      creator_username?: string;
      creator_nickname?: string;
      privacy_level_options?: PrivacyLevel[];
      comment_disabled?: boolean;
      duet_disabled?: boolean;
      stitch_disabled?: boolean;
      max_video_post_duration_sec?: number;
    }>(accessToken, "/v2/post/publish/creator_info/query/", { body: {} });
    return {
      avatarUrl: d.creator_avatar_url ?? null,
      username: d.creator_username ?? "",
      nickname: d.creator_nickname ?? d.creator_username ?? "",
      privacyLevelOptions: d.privacy_level_options ?? [],
      commentDisabled: Boolean(d.comment_disabled),
      duetDisabled: Boolean(d.duet_disabled),
      stitchDisabled: Boolean(d.stitch_disabled),
      maxVideoPostDurationSec: d.max_video_post_duration_sec ?? 60,
    };
  }

  async publishVideo(accessToken: string, o: TikTokPublishOptions, source: VideoSource): Promise<{ publishId: string }> {
    const { chunkSize, totalChunkCount } = chunkPlan(source.size);
    const source_info = { source: "FILE_UPLOAD", video_size: source.size, chunk_size: chunkSize, total_chunk_count: totalChunkCount };

    const init =
      o.mode === "direct"
        ? await this.api<{ publish_id: string; upload_url: string }>(accessToken, "/v2/post/publish/video/init/", {
            body: {
              post_info: {
                title: o.caption,
                privacy_level: o.privacyLevel,
                disable_comment: o.disableComment,
                disable_duet: o.disableDuet,
                disable_stitch: o.disableStitch,
                brand_organic_toggle: o.brandOrganic,
                brand_content_toggle: o.brandContent,
              },
              source_info,
            },
          })
        : await this.api<{ publish_id: string; upload_url: string }>(accessToken, "/v2/post/publish/inbox/video/init/", {
            body: { source_info },
          });

    await this.upload(init.upload_url, source, chunkSize, totalChunkCount);
    return { publishId: init.publish_id };
  }

  private async upload(url: string, source: VideoSource, chunkSize: number, count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      const start = i * chunkSize;
      const end = i === count - 1 ? source.size - 1 : start + chunkSize - 1;
      const body = await source.readRange(start, end);
      let res: Response | undefined;
      // Los 5xx se reintentan sobre el mismo chunk.
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await this.cfg.fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": source.mimeType,
            "Content-Length": String(body.length),
            "Content-Range": `bytes ${start}-${end}/${source.size}`,
          },
          body: new Uint8Array(body),
        });
        if (res.status < 500) break;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
      if (!res || (res.status !== 201 && res.status !== 206 && res.status !== 200)) {
        const status = res?.status ?? 0;
        throw new PlatformError(
          `TikTok rechazó la subida del video (HTTP ${status}).`,
          status >= 500 || status === 403 || status === 404 ? "transient" : "permanent",
          `upload_http_${status}`,
        );
      }
    }
  }

  async fetchStatus(accessToken: string, publishId: string): Promise<PublishStatus> {
    const d = await this.api<{ status: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] }>(
      accessToken,
      "/v2/post/publish/status/fetch/",
      { body: { publish_id: publishId } },
    );
    switch (d.status) {
      case "PUBLISH_COMPLETE":
        return { state: "published", publicPostId: d.publicaly_available_post_id?.[0]?.toString() };
      case "SEND_TO_USER_INBOX":
        return { state: "in_drafts" };
      case "FAILED":
        return { state: "failed", failReason: d.fail_reason ?? "unknown" };
      default:
        return { state: "processing" };
    }
  }
}
