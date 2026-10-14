// Prueba real de Whisper (baja el modelo la primera vez). Corre con RUN_WHISPER=1 y WHISPER_SAMPLE=<wav en español>.
import { describe, expect, it } from "vitest";
import { findHook } from "@88/audio";
import { WhisperProvider } from "./transcribe";

const sample = process.env.WHISPER_SAMPLE;

describe.skipIf(!process.env.RUN_WHISPER || !sample)("Whisper", () => {
  it("transcribe en español con tiempos por palabra", async () => {
    const words = await new WhisperProvider().transcribe(sample!);
    console.log(words.map((w) => `${w.word}@${w.start.toFixed(2)}`).join(" "));
    const text = words.map((w) => w.word.toLowerCase()).join(" ");
    expect(text).toContain("noche");
    expect(text).toContain("sola");
    for (let i = 1; i < words.length; i++) expect(words[i]!.start).toBeGreaterThanOrEqual(words[i - 1]!.start);
    expect(findHook(words)?.text.toLowerCase()).toContain("noche");
  }, 600_000);
});
