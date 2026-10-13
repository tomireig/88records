import { AnthropicProvider } from "./anthropic";
import { localTemplate } from "./local";
import { SYSTEM_PROMPT, buildPrompt } from "./prompts";
import type { AIProvider, GenerationInput, GenerationResult } from "./types";

export * from "./types";
export { AnthropicProvider } from "./anthropic";

export function getProvider(): AIProvider | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new AnthropicProvider(key, process.env.AI_MODEL);
}

export async function generate(input: GenerationInput): Promise<GenerationResult> {
  const provider = getProvider();
  if (!provider) {
    return { text: localTemplate(input), provider: "local", fallbackReason: "No hay ANTHROPIC_API_KEY configurada." };
  }
  try {
    const text = await provider.complete({ system: SYSTEM_PROMPT, prompt: buildPrompt(input) });
    return { text, provider: provider.name };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Error desconocido";
    return { text: localTemplate(input), provider: "local", fallbackReason: reason };
  }
}
