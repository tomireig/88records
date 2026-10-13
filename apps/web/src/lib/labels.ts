import type {
  CampaignStatus,
  ContentFormat,
  ContentStage,
  PitchStage,
  Platform,
  TrackStatus,
} from "@88/db";

export const PLATFORMS: Record<Platform, string> = {
  TIKTOK: "TikTok",
  INSTAGRAM: "Instagram",
  YOUTUBE: "YouTube",
};

export const FORMATS: Record<ContentFormat, string> = {
  HOOK_REVEAL: "Hook / reveal",
  STORYTELLING: "Storytelling",
  BTS: "BTS",
  LYRIC: "Lyric",
  CHALLENGE: "Challenge",
  DUET: "Dueto",
  VISUALIZER: "Visualizer",
};

export const STAGES: Record<ContentStage, string> = {
  IDEA: "Idea",
  SCRIPT: "Guion",
  RECORDED: "Grabado",
  EDITED: "Editado",
  PUBLISHED: "Publicado",
};
export const STAGE_ORDER: ContentStage[] = ["IDEA", "SCRIPT", "RECORDED", "EDITED", "PUBLISHED"];

export const PITCH_STAGES: Record<PitchStage, string> = {
  TO_SEND: "Por mandar",
  SENT: "Enviado",
  FOLLOW_UP: "Follow-up",
  ACCEPTED: "Aceptado",
  REJECTED: "No entró",
};
export const PITCH_ORDER: PitchStage[] = ["TO_SEND", "SENT", "FOLLOW_UP", "ACCEPTED", "REJECTED"];

export const TRACK_STATUS: Record<TrackStatus, string> = {
  DEMO: "Demo",
  MIX: "Mezcla",
  MASTER: "Master",
  READY: "Listo",
  RELEASED: "Salió",
};

export const CAMPAIGN_STATUS: Record<CampaignStatus, string> = {
  PLANNING: "Planificando",
  ACTIVE: "En curso",
  DONE: "Cerrada",
};

export function isEnum<T extends string>(map: Record<T, string>, v: unknown): v is T {
  return typeof v === "string" && v in map;
}

const nf = new Intl.NumberFormat("es-AR");
export const num = (n: number) => nf.format(Math.round(n));
export const usd = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
export const pct = (n: number) => `${(n * 100).toFixed(1).replace(".", ",")}%`;
