// Corre las migraciones pendientes (en el build de Vercel o a mano contra producción).
// Resuelve los nombres de variables de cada integración y el schema de la plataforma
// (misma lógica que src/env.ts) antes de llamar a Prisma.
import { spawnSync } from "node:child_process";

const env = { ...process.env };
const schema = env.DATABASE_SCHEMA || "plataforma";
const withSchema = (url) => (!url || /[?&]schema=/.test(url) ? url : `${url}${url.includes("?") ? "&" : "?"}schema=${encodeURIComponent(schema)}`);

env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
env.DATABASE_URL_UNPOOLED ||= env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
env.DATABASE_URL = withSchema(env.DATABASE_URL);
env.DATABASE_URL_UNPOOLED = withSchema(env.DATABASE_URL_UNPOOLED);

if (!env.DATABASE_URL) {
  console.error("No hay base configurada: cargá DATABASE_URL (o conectá Neon desde Storage en Vercel).");
  process.exit(1);
}

console.log(`Migrando el schema "${schema}"…`);
const res = spawnSync("prisma", ["migrate", "deploy"], { stdio: "inherit", env, shell: true });
process.exit(res.status ?? 1);
