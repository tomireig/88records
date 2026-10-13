// "Conectar cuenta": abre el login oficial de TikTok. Nunca vemos la contraseña.
import { TikTokClient } from "@88/connectors/tiktok";
import { randomToken, sign } from "@88/core/crypto";
import { appUrl } from "@88/core/env";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "tt_oauth_state";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.redirect(`${appUrl()}/login`);
  if (!TikTokClient.isConfigured()) return NextResponse.redirect(`${appUrl()}/cuentas?error=config`);

  const nonce = randomToken(24);
  const state = `${nonce}.${sign(`${nonce}:${session.user.id}`)}`;
  const res = NextResponse.redirect(
    new TikTokClient().authorizeUrl({ state, redirectUri: `${appUrl()}/api/tiktok/callback` }),
  );
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl().startsWith("https"),
    path: "/api/tiktok",
    maxAge: 600,
  });
  return res;
}
