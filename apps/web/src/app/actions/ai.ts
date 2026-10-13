"use server";

import { generate, type GenerationKind } from "@88/ai";
import { db } from "@88/db";
import { revalidatePath } from "next/cache";
import { str } from "@/lib/form";
import { KIND_LABELS } from "@/lib/ai-kinds";

export interface GenerateState {
  text?: string;
  provider?: string;
  notice?: string;
  error?: string;
}

export async function generateAction(_prev: GenerateState, fd: FormData): Promise<GenerateState> {
  const kind = str(fd, "kind") as GenerationKind;
  if (!(kind in KIND_LABELS)) return { error: "Elegí qué querés generar." };

  const input = {
    kind,
    artist: str(fd, "artist") || undefined,
    track: str(fd, "track") || undefined,
    genre: str(fd, "genre") || undefined,
    mood: str(fd, "mood") || undefined,
    platform: str(fd, "platform") || undefined,
    curator: str(fd, "curator") || undefined,
    playlist: str(fd, "playlist") || undefined,
    context: str(fd, "context") || undefined,
  };

  const result = await generate(input);

  await db.aiGeneration.create({
    data: {
      kind,
      prompt: JSON.stringify(input),
      output: result.text,
      provider: result.provider,
    },
  });
  revalidatePath("/ia-studio");

  return {
    text: result.text,
    provider: result.provider,
    notice: result.fallbackReason
      ? `Se usó la plantilla local. Motivo: ${result.fallbackReason}`
      : undefined,
  };
}
