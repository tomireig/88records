import { PlatformError } from "@88/connectors";
import { verify } from "@88/core/crypto";
import { appUrl } from "@88/core/env";
import { saveConnection, tiktok } from "@88/services/tiktok";
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "tt_oauth_state";

function back(params: Record<string, string>) {
  const res = NextResponse.redirect(`${appUrl()}/cuentas?${new URLSearchParams(params)}`);
  res.cookies.delete({ name: STATE_COOKIE, path: "/api/tiktok" });
  return res;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.redirect(`${appUrl()}/login`);

  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back({ error: q.get("error") === "access_denied" ? "denied" : "oauth" });

  const state = q.get("state") ?? "";
  const cookie = req.cookies.get(STATE_COOKIE)?.value;
  const [nonce, sig] = state.split(".");
  if (!cookie || cookie !== state || !nonce || !sig || !verify(`${nonce}:${session.user.id}`, sig)) {
    return back({ error: "state" });
  }

  const code = q.get("code");
  if (!code) return back({ error: "oauth" });

  try {
    const client = tiktok();
    const tokens = await client.exchangeCode({ code, redirectUri: `${appUrl()}/api/tiktok/callback` });
    const profile = await client.profile(tokens.accessToken);
    const acc = await saveConnection({ organizationId: session.org.id, userId: session.user.id, tokens, profile });
    return back({ connected: acc.displayName });
  } catch (err) {
    console.error("[tiktok callback]", err);
    return back({ error: "oauth", detail: err instanceof PlatformError ? err.message : "No se pudo completar la conexión." });
  }
}
