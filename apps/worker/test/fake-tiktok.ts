// Servidor que imita la API de TikTok para las pruebas. Valida lo mismo que valida TikTok
// (token, Content-Range, tamaño) para que los tests fallen donde fallaría la API real.
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface FakeTikTok {
  url: string;
  server: Server;
  state: {
    validToken: string;
    refreshes: number;
    uploadedBytes: number;
    initBodies: Record<string, unknown>[];
    statusCalls: number;
    failNextCreatorInfoWith401: boolean;
    privacyOptions: string[];
  };
  close(): Promise<void>;
}

async function body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

// Cuentas conectadas por el flujo OAuth de desarrollo (authorize → callback).
const DEV_NAMES = ["Lumbre", "Kaia Santos", "Tremor Club", "Nico Vela", "La Fiebre", "Ruido Rosa"];

export async function startFakeTikTok(port = 0): Promise<FakeTikTok> {
  const devAccounts = new Map<string, { openId: string; name: string }>();
  let authorizations = 0;
  const state: FakeTikTok["state"] = {
    validToken: "act.1",
    refreshes: 0,
    uploadedBytes: 0,
    initBodies: [],
    statusCalls: 0,
    failNextCreatorInfoWith401: false,
    privacyOptions: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
  };
  let expectedSize = 0;
  let publishes = 0;
  const publishPolls = new Map<string, { polls: number; inbox: boolean }>();

  const server = createServer(async (req, res) => {
    const json = (status: number, data: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    const url = new URL(req.url ?? "/", "http://x");
    const raw = await body(req);
    const bearer = String(req.headers.authorization ?? "").replace(/^Bearer /, "");
    const dev = devAccounts.get(bearer);
    const authed = bearer === state.validToken || Boolean(dev);
    const unauthorized = () => json(401, { error: { code: "access_token_invalid", message: "expired", log_id: "l" } });

    if (url.pathname === "/v2/auth/authorize/") {
      authorizations++;
      const back = new URL(url.searchParams.get("redirect_uri")!);
      back.searchParams.set("code", `dev${authorizations}`);
      back.searchParams.set("state", url.searchParams.get("state") ?? "");
      res.writeHead(302, { Location: back.toString() }).end();
      return;
    }
    if (url.pathname === "/v2/oauth/token/") {
      const p = new URLSearchParams(raw.toString());
      const code = p.get("code") ?? "";
      const rft = p.get("refresh_token") ?? "";
      const devId = code.startsWith("dev") ? code.slice(3) : rft.startsWith("rft.dev") ? rft.slice(7) : null;
      if (devId) {
        const token = `act.dev${devId}.${Date.now()}`;
        devAccounts.set(token, { openId: `open-dev${devId}`, name: DEV_NAMES[(Number(devId) - 1) % DEV_NAMES.length]! });
        return json(200, { access_token: token, refresh_token: `rft.dev${devId}`, expires_in: 86400, refresh_expires_in: 31536000, open_id: `open-dev${devId}`, scope: "user.info.basic,video.upload,video.publish", token_type: "Bearer" });
      }
      if (p.get("grant_type") === "refresh_token") {
        state.refreshes++;
        state.validToken = `act.${state.refreshes + 1}`;
      }
      return json(200, {
        access_token: state.validToken, refresh_token: "rft", expires_in: 86400, refresh_expires_in: 31536000,
        open_id: "open-123", scope: "user.info.basic,video.upload,video.publish", token_type: "Bearer",
      });
    }
    if (url.pathname === "/v2/oauth/revoke/") return json(200, {});
    if (url.pathname === "/v2/user/info/") {
      if (!authed) return unauthorized();
      return json(200, { data: { user: { open_id: dev?.openId ?? "open-123", display_name: dev?.name ?? "Artista Test", avatar_url: null } }, error: { code: "ok" } });
    }
    if (url.pathname === "/v2/post/publish/creator_info/query/") {
      if (state.failNextCreatorInfoWith401) {
        state.failNextCreatorInfoWith401 = false;
        return unauthorized();
      }
      if (!authed) return unauthorized();
      return json(200, {
        data: {
          creator_nickname: dev?.name ?? "Artista Test", creator_username: "artistatest", privacy_level_options: state.privacyOptions,
          comment_disabled: false, duet_disabled: false, stitch_disabled: true, max_video_post_duration_sec: 600,
        },
        error: { code: "ok" },
      });
    }
    if (url.pathname === "/v2/post/publish/video/init/" || url.pathname === "/v2/post/publish/inbox/video/init/") {
      if (!authed) return unauthorized();
      const b = JSON.parse(raw.toString());
      state.initBodies.push(b);
      const pi = b.post_info;
      if (pi && !state.privacyOptions.includes(pi.privacy_level)) {
        return json(403, { error: { code: "privacy_level_option_mismatch", message: "" } });
      }
      expectedSize = b.source_info.video_size;
      state.uploadedBytes = 0;
      const publishId = `v_pub_${++publishes}`;
      publishPolls.set(publishId, { polls: 0, inbox: url.pathname.includes("/inbox/") });
      const addr = server.address() as AddressInfo;
      return json(200, { data: { publish_id: publishId, upload_url: `http://127.0.0.1:${addr.port}/upload?u=1` }, error: { code: "ok" } });
    }
    if (url.pathname === "/upload" && req.method === "PUT") {
      const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(String(req.headers["content-range"]));
      if (!m || Number(m[3]) !== expectedSize || Number(m[1]) !== state.uploadedBytes || raw.length !== Number(m[2]) - Number(m[1]) + 1) {
        res.writeHead(416).end();
        return;
      }
      state.uploadedBytes += raw.length;
      res.writeHead(state.uploadedBytes === expectedSize ? 201 : 206).end();
      return;
    }
    if (url.pathname === "/v2/post/publish/status/fetch/") {
      if (!authed) return unauthorized();
      state.statusCalls++;
      const pid = JSON.parse(raw.toString()).publish_id as string;
      const entry = publishPolls.get(pid) ?? { polls: 0, inbox: false };
      entry.polls++;
      publishPolls.set(pid, entry);
      const done = entry.polls >= 2;
      return json(200, {
        data: !done ? { status: "PROCESSING_UPLOAD" } : entry.inbox ? { status: "SEND_TO_USER_INBOX" } : { status: "PUBLISH_COMPLETE", publicaly_available_post_id: [7400000000000 + publishes] },
        error: { code: "ok" },
      });
    }
    json(404, { error: { code: "not_found" } });
  });

  await new Promise<void>((r) => server.listen(port, "127.0.0.1", r));
  const bound = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${bound}`,
    server,
    state,
    close: () => new Promise((r) => server.close(() => r())),
  };
}
