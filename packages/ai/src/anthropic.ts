import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider } from "./types";

const DEFAULT_MODEL = "claude-opus-5-5";

export class AnthropicProvider implements AIProvider {
  readonly name: string;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || DEFAULT_MODEL;
    this.name = `anthropic:${this.model}`;
  }

  async complete({ system, prompt, maxTokens = 4000 }: { system: string; prompt: string; maxTokens?: number }) {
    // Fallback del lado del servidor: si el modelo declina, la API reintenta
    // con otro modelo dentro de la misma llamada.
    const response = await this.client.beta.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: prompt }],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("El modelo no quiso generar este contenido.");
    }

    const text = response.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("\n")
      .trim();
    if (!text) throw new Error("La respuesta vino vacía.");
    return text;
  }
}
