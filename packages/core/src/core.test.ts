import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt, sign, verify } from "./crypto";
import { autofillWeek, type AutofillAccount } from "./scheduling";
import { assertSafeKey } from "./storage/keys";
import { atLocal, dayKey, timeKey, weekDays, weekStart } from "./time";

const TZ = "America/Argentina/Buenos_Aires";

beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("crypto", () => {
  it("cifra y descifra", () => {
    const enc = encrypt("act.secreto");
    expect(enc).not.toContain("secreto");
    expect(decrypt(enc)).toBe("act.secreto");
  });

  it("detecta manipulación", () => {
    const enc = encrypt("act.secreto");
    const parts = enc.split(".");
    parts[3] = Buffer.from("otra cosa").toString("base64url");
    expect(() => decrypt(parts.join("."))).toThrow();
  });

  it("firma y verifica", () => {
    const s = sign("put:org/x.mp4:123");
    expect(verify("put:org/x.mp4:123", s)).toBe(true);
    expect(verify("get:org/x.mp4:123", s)).toBe(false);
  });
});

describe("storage keys", () => {
  it("rechaza rutas peligrosas", () => {
    expect(() => assertSafeKey("org/a/videos/b.mp4")).not.toThrow();
    expect(() => assertSafeKey("../etc/passwd")).toThrow();
    expect(() => assertSafeKey("org/../../x")).toThrow();
    expect(() => assertSafeKey("/abs")).toThrow();
  });
});

describe("time", () => {
  it("convierte hora local de Buenos Aires a UTC", () => {
    const at = atLocal("2026-10-13", "21:30", TZ);
    expect(at.toISOString()).toBe("2026-10-14T00:30:00.000Z");
    expect(dayKey(at, TZ)).toBe("2026-10-13");
    expect(timeKey(at, TZ)).toBe("21:30");
  });

  it("arranca la semana el lunes", () => {
    const start = weekStart(new Date("2026-10-15T15:00:00Z"), TZ);
    expect(weekDays(start, TZ)).toEqual([
      "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18",
    ]);
  });
});

describe("autofillWeek", () => {
  const start = weekStart(new Date("2026-10-12T12:00:00Z"), TZ);
  const now = new Date("2026-10-11T12:00:00Z");
  const acc = (id: string, artistId: string | null, max = 2): AutofillAccount => ({
    id,
    artistId,
    preferredSlots: ["12:30", "19:00", "21:30"],
    maxPostsPerDay: max,
  });

  it("respeta el tope diario y reparte en la semana", () => {
    const videos = Array.from({ length: 10 }, (_, i) => ({ id: `v${i}`, artistId: null, sha256: `h${i}` }));
    const out = autofillWeek({ weekStart: start, tz: TZ, now, accounts: [acc("a", null, 1)], videos, occupied: [], usedHashes: new Set() });
    expect(out).toHaveLength(7);
    expect(new Set(out.map((o) => dayKey(o.at, TZ))).size).toBe(7);
  });

  it("no repite archivos ni mezcla artistas", () => {
    const videos = [
      { id: "v1", artistId: "x", sha256: "same" },
      { id: "v2", artistId: "x", sha256: "same" },
      { id: "v3", artistId: "y", sha256: "used" },
      { id: "v4", artistId: "y", sha256: "ok" },
    ];
    const out = autofillWeek({
      weekStart: start, tz: TZ, now,
      accounts: [acc("ax", "x"), acc("ay", "y")],
      videos, occupied: [], usedHashes: new Set(["used"]),
    });
    expect(out.map((o) => `${o.videoId}>${o.accountId}`).sort()).toEqual(["v1>ax", "v4>ay"]);
  });

  it("no pisa horarios ocupados ni programa en el pasado", () => {
    const busy = atLocal("2026-10-12", "19:00", TZ);
    const out = autofillWeek({
      weekStart: start, tz: TZ, now: atLocal("2026-10-12", "13:00", TZ),
      accounts: [acc("a", null, 3)],
      videos: Array.from({ length: 30 }, (_, i) => ({ id: `v${i}`, artistId: null, sha256: null })),
      occupied: [{ accountId: "a", at: busy }],
      usedHashes: new Set(),
    });
    const monday = out.filter((o) => dayKey(o.at, TZ) === "2026-10-12").map((o) => timeKey(o.at, TZ));
    expect(monday).toEqual(["21:30"]);
    expect(out).toHaveLength(1 + 6 * 3);
  });
});
