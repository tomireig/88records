// Textos con IA: Ollama local cuando está corriendo; si no, plantillas escritas a mano.
// Anthropic, OpenAI, Gemini o Groq se enchufan implementando AIProvider cuando haya presupuesto.

export interface CompleteOptions {
  system?: string;
  /** Pide JSON y lo parsea. */
  json?: boolean;
  temperature?: number;
  timeoutMs?: number;
}

export interface AIProvider {
  readonly name: string;
  available(): Promise<boolean>;
  complete(prompt: string, opts?: CompleteOptions): Promise<string>;
}

export class OllamaProvider implements AIProvider {
  readonly name = "ollama";
  constructor(
    private readonly baseUrl = (process.env.OLLAMA_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
    readonly model = process.env.OLLAMA_MODEL || "llama3.2:3b",
  ) {}

  async available(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) return false;
      const { models } = (await res.json()) as { models?: { name: string }[] };
      return Boolean(models?.some((m) => m.name === this.model || m.name.startsWith(`${this.model}:`)));
    } catch {
      return false;
    }
  }

  async complete(prompt: string, opts: CompleteOptions = {}): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        system: opts.system,
        stream: false,
        format: opts.json ? "json" : undefined,
        options: { temperature: opts.temperature ?? 0.8 },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
    });
    if (!res.ok) throw new Error(`Ollama respondió ${res.status}`);
    const data = (await res.json()) as { response?: string };
    return (data.response ?? "").trim();
  }
}

let cached: { provider: AIProvider | null; at: number } | null = null;

/** El proveedor configurado si está disponible ahora; null si hay que usar plantillas. Se revisa cada minuto. */
export async function aiProvider(): Promise<AIProvider | null> {
  if (cached && Date.now() - cached.at < 60_000) return cached.provider;
  const choice = (process.env.AI_PROVIDER || "ollama").toLowerCase();
  let provider: AIProvider | null = null;
  if (choice === "ollama") {
    const o = new OllamaProvider();
    provider = (await o.available()) ? o : null;
  }
  cached = { provider, at: Date.now() };
  return provider;
}

export function resetProviderCache(): void {
  cached = null;
}

export * from "./copy";
