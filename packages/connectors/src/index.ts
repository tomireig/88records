// Interfaces comunes. Cada plataforma (TikTok hoy; Instagram y YouTube en la etapa 4)
// implementa las dos sin que el resto del sistema sepa con quién habla.

export type Platform = "tiktok" | "instagram" | "youtube";

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
  scopes: string[];
  /** id estable de la cuenta en la plataforma */
  accountId: string;
}

export interface Profile {
  accountId: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Conexión OAuth por cuenta. */
export interface PlatformConnector {
  readonly platform: Platform;
  authorizeUrl(params: { state: string; redirectUri: string }): string;
  exchangeCode(params: { code: string; redirectUri: string }): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  revoke(accessToken: string): Promise<void>;
  profile(accessToken: string): Promise<Profile>;
}

/** Lectura de un archivo por rangos, para subir en chunks sin cargarlo entero en memoria. */
export interface VideoSource {
  size: number;
  mimeType: string;
  readRange(start: number, endInclusive: number): Promise<Buffer>;
}

export type PublishState = "processing" | "in_drafts" | "published" | "failed";

export interface PublishStatus {
  state: PublishState;
  failReason?: string;
  publicPostId?: string;
}

/** Publicación de video. Las opciones concretas dependen de cada plataforma. */
export interface SocialProvider<Options> {
  readonly platform: Platform;
  publishVideo(accessToken: string, options: Options, source: VideoSource): Promise<{ publishId: string }>;
  fetchStatus(accessToken: string, publishId: string): Promise<PublishStatus>;
}

export * from "./errors";
