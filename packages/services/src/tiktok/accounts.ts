import { PlatformError, type Profile, type TokenSet } from "@88/connectors";
import { TikTokClient } from "@88/connectors/tiktok";
import { decrypt, encrypt } from "@88/core/crypto";
import { db, type TikTokAccount } from "@88/db";

export const tiktok = () => new TikTokClient();

/** Colores de calendario: acentos de la marca y variaciones frías para distinguir cuentas. */
const COLORS = ["#FF4D00", "#4D5BFF", "#00C2A8", "#FFB000", "#E04DFF", "#4DB8FF", "#FF4D8D", "#9BE15D"];

const REFRESH_MARGIN_MS = 5 * 60_000;
const EXPIRING_SOON_MS = 7 * 24 * 3600_000;

export type ConnectionHealth = "active" | "expiring" | "broken";

export function connectionHealth(acc: Pick<TikTokAccount, "status" | "refreshTokenExpiresAt">, now = new Date()): ConnectionHealth {
  if (acc.status === "broken" || acc.refreshTokenExpiresAt.getTime() <= now.getTime()) return "broken";
  if (acc.refreshTokenExpiresAt.getTime() - now.getTime() < EXPIRING_SOON_MS) return "expiring";
  return "active";
}

export async function saveConnection(params: {
  organizationId: string;
  userId: string;
  tokens: TokenSet;
  profile: Profile;
}): Promise<TikTokAccount> {
  const { organizationId, userId, tokens, profile } = params;
  const tokenData = {
    accessTokenEnc: encrypt(tokens.accessToken),
    refreshTokenEnc: encrypt(tokens.refreshToken),
    accessTokenExpiresAt: tokens.accessTokenExpiresAt,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
    scopes: tokens.scopes,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    status: "active" as const,
    lastError: null,
  };
  const count = await db.tikTokAccount.count({ where: { organizationId } });
  return db.tikTokAccount.upsert({
    where: { organizationId_openId: { organizationId, openId: tokens.accountId } },
    update: tokenData,
    create: {
      organizationId,
      openId: tokens.accountId,
      connectedById: userId,
      color: COLORS[count % COLORS.length]!,
      ...tokenData,
    },
  });
}

export async function markBroken(accountId: string, reason: string): Promise<void> {
  await db.tikTokAccount.update({ where: { id: accountId }, data: { status: "broken", lastError: reason } });
}

export async function refreshAccount(acc: TikTokAccount): Promise<TikTokAccount> {
  try {
    const t = await tiktok().refresh(decrypt(acc.refreshTokenEnc));
    return await db.tikTokAccount.update({
      where: { id: acc.id },
      data: {
        accessTokenEnc: encrypt(t.accessToken),
        refreshTokenEnc: encrypt(t.refreshToken),
        accessTokenExpiresAt: t.accessTokenExpiresAt,
        refreshTokenExpiresAt: t.refreshTokenExpiresAt,
        scopes: t.scopes.length ? t.scopes : acc.scopes,
        status: "active",
        lastError: null,
      },
    });
  } catch (err) {
    if (err instanceof PlatformError && !err.retriable) await markBroken(acc.id, err.message);
    throw err;
  }
}

/**
 * Ejecuta una llamada con un token válido. Refresca antes si está por vencer y, si TikTok
 * igual lo rechaza, refresca una vez y reintenta. Si no hay forma, marca la cuenta caída.
 */
export async function withAccessToken<T>(accountId: string, fn: (token: string) => Promise<T>): Promise<T> {
  let acc = await db.tikTokAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (acc.status === "broken") {
    throw new PlatformError("La conexión con TikTok de esta cuenta está caída. Reconectala.", "auth", "account_broken");
  }
  if (acc.accessTokenExpiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS) acc = await refreshAccount(acc);
  try {
    return await fn(decrypt(acc.accessTokenEnc));
  } catch (err) {
    if (!(err instanceof PlatformError) || err.kind !== "auth") throw err;
    acc = await refreshAccount(acc);
    try {
      return await fn(decrypt(acc.accessTokenEnc));
    } catch (again) {
      if (again instanceof PlatformError && again.kind === "auth") await markBroken(acc.id, again.message);
      throw again;
    }
  }
}

/** Para el cron: refresca los tokens que vencen en las próximas 2 horas. */
export async function refreshExpiringAccounts(): Promise<{ refreshed: number; failed: number }> {
  const soon = new Date(Date.now() + 2 * 3600_000);
  const accounts = await db.tikTokAccount.findMany({ where: { status: "active", accessTokenExpiresAt: { lt: soon } } });
  let refreshed = 0;
  let failed = 0;
  for (const acc of accounts) {
    try {
      await refreshAccount(acc);
      refreshed++;
    } catch (err) {
      failed++;
      console.error(`[tiktok] no se pudo refrescar ${acc.displayName}:`, err instanceof Error ? err.message : err);
    }
  }
  return { refreshed, failed };
}

export async function disconnectAccount(organizationId: string, accountId: string): Promise<void> {
  const acc = await db.tikTokAccount.findFirstOrThrow({ where: { id: accountId, organizationId } });
  await db.tikTokPost.updateMany({
    where: { accountId, status: "scheduled" },
    data: { status: "canceled", failReason: "Se desconectó la cuenta" },
  });
  try {
    await tiktok().revoke(decrypt(acc.accessTokenEnc));
  } catch {
    // Si el token ya no sirve, igual la borramos de nuestro lado.
  }
  await db.tikTokAccount.delete({ where: { id: accountId } });
}
