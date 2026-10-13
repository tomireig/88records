export type GenerationKind =
  | "hooks"
  | "script"
  | "caption"
  | "visual"
  | "media_prompt"
  | "calendar"
  | "bio"
  | "pitch"
  | "dm_es"
  | "dm_en";

export interface GenerationInput {
  kind: GenerationKind;
  artist?: string;
  track?: string;
  genre?: string;
  mood?: string;
  platform?: string;
  curator?: string;
  playlist?: string;
  context?: string;
}

export interface AIProvider {
  readonly name: string;
  complete(args: { system: string; prompt: string; maxTokens?: number }): Promise<string>;
}

export interface GenerationResult {
  text: string;
  provider: string;
  /** Si la IA no estuvo disponible y se usó la plantilla local, acá va el motivo. */
  fallbackReason?: string;
}
