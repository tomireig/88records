// Prueba de punta a punta del panel de TikTok contra la base local y una API de TikTok falsa.
// Necesita Postgres corriendo (`pnpm db:local`); si no está, se saltea.
import { loadRootEnv } from "@88/core/env";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startFakeTikTok, type FakeTikTok } from "./fake-tiktok";

loadRootEnv();
process.env.TIKTOK_DIRECT_POST_ENABLED = "true";
process.env.TIKTOK_APP_AUDITED = "false";
process.env.STORAGE_DRIVER = "local";

const { db } = await import("@88/db");
const reachable = await db.$queryRaw`SELECT 1`.then(() => true).catch(() => false);

describe.skipIf(!reachable)("pipeline TikTok", () => {
  let fake: FakeTikTok;
  let orgId: string;
  let userId: string;
  let dir: string;
  const svc = {} as typeof import("@88/services/tiktok") & typeof import("@88/services/library");

  let tone = 300;
  async function makeVideo(name: string, seconds: number): Promise<string> {
    tone += 37;
    const { run, FFMPEG } = await import("@88/video");
    const { storage } = await import("@88/core/storage");
    const file = join(dir, name);
    await run(FFMPEG(), [
      "-v", "error", "-f", "lavfi", "-i", `testsrc=size=720x1280:rate=30`, "-f", "lavfi", "-i", `sine=frequency=${tone}`,
      "-t", String(seconds), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", file,
    ]);
    const buf = await readFile(file);
    const { video } = await svc.createUpload({ organizationId: orgId, userId, fileName: name, size: buf.length, mimeType: "video/mp4" });
    await storage().write(video.storageKey, buf, "video/mp4");
    await svc.completeUpload(orgId, video.id);
    const { processVideo } = await import("../src/process-video");
    await processVideo(video.id, true);
    return video.id;
  }

  beforeAll(async () => {
    fake = await startFakeTikTok();
    process.env.TIKTOK_API_BASE = fake.url;
    process.env.TIKTOK_CLIENT_KEY = "ck";
    process.env.TIKTOK_CLIENT_SECRET = "cs";
    Object.assign(svc, await import("@88/services/tiktok"), await import("@88/services/library"));
    dir = await mkdtemp(join(tmpdir(), "88e2e-"));
    const slug = `test-${Date.now()}`;
    const org = await db.organization.create({ data: { name: "Test", slug } });
    const user = await db.user.create({ data: { email: `${slug}@test.local` } });
    orgId = org.id;
    userId = user.id;
  }, 60_000);

  afterAll(async () => {
    if (orgId) {
      await db.tikTokPost.deleteMany({ where: { organizationId: orgId } });
      await db.organization.delete({ where: { id: orgId } });
      await db.user.delete({ where: { id: userId } });
    }
    await fake?.close();
    await rm(dir, { recursive: true, force: true });
    const { boss } = await import("@88/core/queue");
    await (await boss()).stop({ graceful: false });
    await db.$disconnect();
  });

  let accountId: string;
  let videoId: string;
  let postId: string;

  it("conecta la cuenta y guarda los tokens cifrados", async () => {
    const client = svc.tiktok();
    const tokens = await client.exchangeCode({ code: "c", redirectUri: "http://localhost:3000/api/tiktok/callback" });
    const profile = await client.profile(tokens.accessToken);
    const acc = await svc.saveConnection({ organizationId: orgId, userId, tokens, profile });
    accountId = acc.id;
    expect(acc.displayName).toBe("Artista Test");
    expect(acc.accessTokenEnc).not.toContain("act.");
  });

  it("procesa el video: duración, hash y miniatura", async () => {
    videoId = await makeVideo("primer-clip.mp4", 2);
    const v = await db.video.findUniqueOrThrow({ where: { id: videoId } });
    expect(v.status).toBe("ready");
    expect(v.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(v.thumbnailKey).toBeTruthy();
    expect(v.height).toBe(1280);
  }, 60_000);

  it("sin auditoría solo deja publicar como privado", async () => {
    const info = await svc.withAccessToken(accountId, (t) => svc.tiktok().creatorInfo(t));
    const choices = { caption: "Primer clip ⚡️ #techengue", allowComment: false, allowDuet: false, allowStitch: false, brandOrganic: false, brandContent: false, consent: true };
    await expect(
      svc.schedulePost({ organizationId: orgId, userId, accountId, videoId, at: new Date(Date.now() + 1000), choices: { ...choices, privacyLevel: "PUBLIC_TO_EVERYONE" }, info }),
    ).rejects.toThrow(/privacidad/);
    await expect(
      svc.schedulePost({ organizationId: orgId, userId, accountId, videoId, at: new Date(Date.now() + 1000), choices: { ...choices, privacyLevel: "SELF_ONLY", allowStitch: true }, info }),
    ).rejects.toThrow(/stitch/);
    const post = await svc.schedulePost({ organizationId: orgId, userId, accountId, videoId, at: new Date(Date.now() + 1000), choices: { ...choices, privacyLevel: "SELF_ONLY" }, info });
    postId = post.id;
    expect(post.status).toBe("scheduled");
    expect(post.disableComment).toBe(true);
  });

  it("publica: refresca el token vencido, sube en chunks y sigue el estado", async () => {
    fake.state.failNextCreatorInfoWith401 = true;
    const outcome = await svc.publishPost(postId, { retryCount: 0, retryLimit: 3 });
    expect(outcome).toBe("submitted");
    expect(fake.state.refreshes).toBe(1);
    const v = await db.video.findUniqueOrThrow({ where: { id: videoId } });
    expect(fake.state.uploadedBytes).toBe(Number(v.sizeBytes));
    expect(fake.state.initBodies[0]).toMatchObject({ post_info: { title: "Primer clip ⚡️ #techengue", privacy_level: "SELF_ONLY", disable_comment: true } });

    expect(await svc.pollStatus(postId, 0)).toBe("pending");
    expect(await svc.pollStatus(postId, 1)).toBe("published");
    const post = await db.tikTokPost.findUniqueOrThrow({ where: { id: postId }, include: { events: { orderBy: { at: "asc" } } } });
    expect(post.status).toBe("published");
    expect(post.publicPostId).toBe("7400000000001");
    expect(post.events.map((e) => e.status)).toEqual(["scheduled", "publishing", "processing", "published"]);
  });

  it("no publica dos veces el mismo post", async () => {
    expect(await svc.publishPost(postId, { retryCount: 0, retryLimit: 3 })).toBe("skipped");
  });

  it("autollenar propone, no repite archivos y la aprobación programa", async () => {
    const { weekStart } = await import("@88/core/time");
    await makeVideo("segundo-clip.mp4", 2);
    await makeVideo("tercer-clip.mp4", 3);
    const nextWeek = weekStart(new Date(Date.now() + 7 * 24 * 3600_000), "America/Argentina/Buenos_Aires");
    const n = await svc.proposeWeek(orgId, nextWeek);
    expect(n).toBe(2); // el primero ya salió: no se vuelve a proponer
    expect(await svc.proposeWeek(orgId, nextWeek)).toBe(0); // y no duplica propuestas

    const actions = await db.action.findMany({ where: { organizationId: orgId, status: "proposed" } });
    const res = await svc.approveTikTokActions({
      organizationId: orgId, userId, actionIds: actions.map((a) => a.id),
      choices: { privacyLevel: "SELF_ONLY", allowComment: true, allowDuet: false, allowStitch: false, brandOrganic: false, brandContent: false, consent: true },
    });
    expect(res).toEqual({ approved: 2, errors: [] });
    const scheduled = await db.tikTokPost.findMany({ where: { organizationId: orgId, status: "scheduled" } });
    expect(scheduled).toHaveLength(2);
    expect(scheduled.every((p) => p.actionId && !p.disableComment)).toBe(true);

    // Reprogramar mueve el mismo job (singletonKey) en vez de crear otro.
    const { boss, JOBS } = await import("@88/core/queue");
    const target = scheduled[0]!;
    await svc.reschedulePost(orgId, target.id, new Date(target.scheduledFor.getTime() + 3600_000));
    const jobs = await (await boss()).findJobs(JOBS.tiktokPublish, { key: target.id });
    const pending = jobs.filter((j) => j.state === "created");
    expect(pending).toHaveLength(1);
    expect(pending[0]!.startAfter.getTime()).toBe(target.scheduledFor.getTime() + 3600_000);
  }, 90_000);

  it("avisa si el mismo archivo ya está en otra cuenta", async () => {
    const client = svc.tiktok();
    fake.state.validToken = "act.otra";
    const other = await svc.saveConnection({
      organizationId: orgId, userId,
      tokens: { ...(await client.refresh("x")), accountId: "open-456" },
      profile: { accountId: "open-456", displayName: "Otra cuenta", avatarUrl: null },
    });
    const dups = await svc.duplicateAccounts(orgId, videoId, other.id);
    expect(dups.map((d) => d.displayName)).toEqual(["Artista Test"]);
  });
});
