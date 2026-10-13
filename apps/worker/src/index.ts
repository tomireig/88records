// Worker de 88RECORDS®: corre en la PC de Tomi. Procesa videos, publica en TikTok,
// sigue el estado de cada publicación y refresca tokens.
import { loadRootEnv } from "@88/core/env";

loadRootEnv();

const { boss, JOBS, QUEUE_OPTIONS } = await import("@88/core/queue");
const { publishPost, pollStatus, refreshExpiringAccounts } = await import("@88/services/tiktok");
const { processVideo } = await import("./process-video");
const { db } = await import("@88/db");

type Payload<N extends keyof import("@88/core/queue").JobData> = import("@88/core/queue").JobData[N];

const b = await boss("worker");
const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);

await b.work<Payload<typeof JOBS.libraryProcess>>(JOBS.libraryProcess, { localConcurrency: 2 }, async ([job]) => {
  if (!job) return;
  const limit = QUEUE_OPTIONS[JOBS.libraryProcess].retryLimit ?? 0;
  if (await processVideo(job.data.videoId, job.retryCount >= limit)) log("video procesado", job.data.videoId);
});

await b.work<Payload<typeof JOBS.tiktokPublish>>(JOBS.tiktokPublish, { localConcurrency: 2 }, async ([job]) => {
  if (!job) return;
  const outcome = await publishPost(job.data.postId, {
    retryCount: job.retryCount,
    retryLimit: QUEUE_OPTIONS[JOBS.tiktokPublish].retryLimit ?? 0,
  });
  log("tiktok.publish", job.data.postId, outcome);
});

await b.work<Payload<typeof JOBS.tiktokStatus>>(JOBS.tiktokStatus, async ([job]) => {
  if (!job) return;
  const state = await pollStatus(job.data.postId, job.data.poll);
  if (state !== "pending") log("tiktok.status", job.data.postId, state);
});

await b.work(JOBS.tiktokRefresh, async () => {
  const r = await refreshExpiringAccounts();
  if (r.refreshed || r.failed) log("tokens", r);
});
await b.schedule(JOBS.tiktokRefresh, "*/30 * * * *");

// Latido para que el panel sepa que hay alguien publicando.
const { hostname } = await import("node:os");
const beat = () =>
  db.workerHeartbeat
    .upsert({ where: { id: "main" }, update: { seenAt: new Date(), host: hostname() }, create: { id: "main", seenAt: new Date(), host: hostname() } })
    .catch((err) => console.error("[latido]", err.message));
await beat();
const beatTimer = setInterval(beat, 30_000);

log("Worker andando. Ctrl+C para cortar.");

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearInterval(beatTimer);
  log("Cortando: espero que terminen los jobs en curso…");
  await b.stop({ graceful: true, timeout: 60_000 });
  await db.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
