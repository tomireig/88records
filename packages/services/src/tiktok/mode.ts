import type { CreatorInfo, PrivacyLevel } from "@88/connectors/tiktok";
import { flag } from "@88/core/env";

export interface TikTokMode {
  /** true: publica directo (video.publish). false: manda a borradores (video.upload). */
  directPost: boolean;
  /** La app pasó la auditoría de TikTok. Sin auditoría todo sale privado y hasta 5 cuentas por día. */
  audited: boolean;
}

export function tiktokMode(): TikTokMode {
  return { directPost: flag("TIKTOK_DIRECT_POST_ENABLED"), audited: flag("TIKTOK_APP_AUDITED") };
}

/** Opciones de privacidad que se pueden ofrecer: las de creator_info, recortadas si la app no está auditada. */
export function allowedPrivacy(info: CreatorInfo, mode: TikTokMode): PrivacyLevel[] {
  return mode.audited ? info.privacyLevelOptions : info.privacyLevelOptions.filter((p) => p === "SELF_ONLY");
}

export const PRIVACY_LABELS: Record<PrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: "Todo el mundo",
  MUTUAL_FOLLOW_FRIENDS: "Amigos",
  FOLLOWER_OF_CREATOR: "Seguidores",
  SELF_ONLY: "Solo yo",
};
