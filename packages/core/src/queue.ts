// Colas sobre Postgres con pg-boss: la misma base de Supabase, sin Redis.
// El panel solo encola; el worker (en la PC de Tomi) procesa.
import { PgBoss, type SendOptions } from "pg-boss";

export const JOBS = {
  libraryProcess: "library.process",
  tiktokPublish: "tiktok.publish",
  tiktokStatus: "tiktok.status",
  tiktokRefresh: "tiktok.refresh-tokens",
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS];

export interface JobData {
  [JOBS.libraryProcess]: { videoId: string };
  [JOBS.tiktokPublish]: { postId: string };
  [JOBS.tiktokStatus]: { postId: string; poll: number };
  [JOBS.tiktokRefresh]: Record<string, never>;
}

/** Reintentos y vencimientos por cola. */
export const QUEUE_OPTIONS: Record<JobName, Omit<SendOptions, "db">> = {
  [JOBS.libraryProcess]: { retryLimit: 2, retryDelay: 30, expireInSeconds: 30 * 60 },
  [JOBS.tiktokPublish]: { retryLimit: 3, retryDelay: 60, retryBackoff: true, retryDelayMax: 30 * 60, expireInSeconds: 30 * 60 },
  [JOBS.tiktokStatus]: { retryLimit: 5, retryDelay: 20, retryBackoff: true, expireInSeconds: 5 * 60 },
  [JOBS.tiktokRefresh]: { retryLimit: 1, expireInSeconds: 10 * 60 },
};

const g = globalThis as unknown as { __boss?: Promise<PgBoss> };

function connectionString(): string {
  // pg-boss necesita conexión de sesión: en Supabase, el session pooler (puerto 5432) o la directa.
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL");
  return url;
}

/**
 * Instancia compartida. El panel la abre en modo "solo encolar" (sin supervisión ni cron);
 * el worker la abre completa.
 */
export function boss(role: "producer" | "worker" = "producer"): Promise<PgBoss> {
  g.__boss ??= (async () => {
    const instance = new PgBoss({
      connectionString: connectionString(),
      application_name: `88records-${role}`,
      max: role === "worker" ? 6 : 2,
      supervise: role === "worker",
      schedule: role === "worker",
    });
    instance.on("error", (err) => console.error("[pg-boss]", err));
    await instance.start();
    await ensureQueues(instance);
    return instance;
  })().catch((err) => {
    g.__boss = undefined;
    throw err;
  });
  return g.__boss;
}

async function ensureQueues(instance: PgBoss): Promise<void> {
  const existing = new Set((await instance.getQueues()).map((q) => q.name));
  for (const name of Object.values(JOBS)) {
    if (!existing.has(name)) await instance.createQueue(name, QUEUE_OPTIONS[name]);
  }
}

export async function enqueue<N extends JobName>(name: N, data: JobData[N], options: SendOptions = {}): Promise<string | null> {
  return (await boss()).send(name, data, { ...QUEUE_OPTIONS[name], ...options });
}

/**
 * Programa (o reprograma) la publicación. Usa el id del post como singletonKey: mover el
 * post en el calendario actualiza el mismo job en vez de crear otro.
 */
export async function schedulePublish(postId: string, at: Date): Promise<void> {
  const b = await boss();
  await b.upsert(JOBS.tiktokPublish, { postId }, { ...QUEUE_OPTIONS[JOBS.tiktokPublish], singletonKey: postId, startAfter: at });
}
