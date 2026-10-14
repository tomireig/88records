import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OllamaProvider, pieceCopy, resetProviderCache, templateCopy, type CopyContext } from "./index";

const ctx: CopyContext = { artist: "Lumbre", title: "Bailo Sola", format: "hook", phase: "pre", day: -5, seed: 3 };

describe("templateCopy", () => {
  it("arma caption, overlay y hashtags sin IA", () => {
    const c = templateCopy(ctx);
    expect(c.caption).toMatch(/Bailo Sola|Lumbre/);
    expect(c.caption).not.toMatch(/\{/);
    expect(c.overlay.length).toBeGreaterThan(0);
    expect(c.hashtags).toContain("lumbre");
    expect(c.hashtags).toContain("88records");
  });

  it("usa la frase de la letra en el lyric", () => {
    expect(templateCopy({ ...ctx, format: "lyric", hookLyric: "esta noche bailo sola" }).overlay).toBe("esta noche bailo sola");
  });
});

describe("Ollama", () => {
  let server: Server;
  let calls = 0;
  beforeAll(async () => {
    server = createServer(async (req, res) => {
      if (req.url === "/api/tags") return res.end(JSON.stringify({ models: [{ name: "llama3.2:3b" }] }));
      calls++;
      res.end(JSON.stringify({ response: JSON.stringify({ caption: "Faltan 5 días. Guardalo.", hashtags: ["#Lumbre", "techengue"], overlay: "esperá el drop" }) }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    process.env.OLLAMA_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    resetProviderCache();
  });
  afterAll(() => {
    delete process.env.OLLAMA_URL;
    resetProviderCache();
    server.close();
  });

  it("detecta el modelo instalado", async () => {
    expect(await new OllamaProvider().available()).toBe(true);
  });

  it("usa la IA cuando está y limpia los hashtags", async () => {
    const c = await pieceCopy(ctx);
    expect(c.source).toBe("ai");
    expect(c.hashtags).toEqual(["lumbre", "techengue", "88records"]);
    expect(calls).toBe(1);
  });

  it("cae a plantilla si Ollama no está", async () => {
    process.env.OLLAMA_URL = "http://127.0.0.1:9";
    resetProviderCache();
    expect((await pieceCopy(ctx)).source).toBe("template");
  });
});
