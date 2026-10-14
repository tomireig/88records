// Transcripción con tiempos por palabra: Whisper en ONNX con transformers.js, local, sin Python.
// El modelo se baja la primera vez a MODELS_DIR (por defecto .models en la raíz) y queda cacheado.
import { decode, type Word } from "@88/audio";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(path: string, opts?: { language?: string }): Promise<Word[]>;
}

function repoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const up = dirname(dir);
    if (up === dir) return process.cwd();
    dir = up;
  }
}

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string; chunks?: { text: string; timestamp: [number, number | null] }[] }>;

export class WhisperProvider implements TranscriptionProvider {
  readonly name = "whisper";
  private asr: Promise<Asr> | null = null;

  constructor(
    readonly model = process.env.WHISPER_MODEL || "onnx-community/whisper-base_timestamped",
    private readonly dtype = process.env.WHISPER_DTYPE || "q8",
  ) {}

  private load(): Promise<Asr> {
    this.asr ??= (async () => {
      const { env, pipeline } = await import("@huggingface/transformers");
      env.cacheDir = resolve(process.env.MODELS_DIR || join(repoRoot(), ".models"));
      env.allowLocalModels = true;
      const p = await pipeline("automatic-speech-recognition", this.model, { dtype: this.dtype as never });
      return p as unknown as Asr;
    })().catch((err) => {
      this.asr = null;
      throw err;
    });
    return this.asr;
  }

  async transcribe(path: string, opts: { language?: string } = {}): Promise<Word[]> {
    const asr = await this.load();
    const audio = await decode(path, 900, 16000);
    const out = await asr(audio, {
      return_timestamps: "word",
      language: opts.language ?? "spanish",
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const words: Word[] = [];
    for (const c of out.chunks ?? []) {
      const word = c.text.trim();
      const [start, end] = c.timestamp;
      if (!word || start === null || start === undefined) continue;
      words.push({ word, start: Math.round(start * 1000) / 1000, end: Math.round((end ?? start + 0.3) * 1000) / 1000 });
    }
    return words;
  }
}

/** Whisper alucina texto en silencios o en temas instrumentales: si casi no hay palabras por minuto, no hay voz. */
export function looksLikeVocals(words: Word[], durationSec: number): boolean {
  if (words.length < 6) return false;
  return words.length / Math.max(1, durationSec / 60) >= 12;
}
