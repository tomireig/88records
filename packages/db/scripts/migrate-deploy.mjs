// Corre las migraciones pendientes (en el build de Vercel o a mano contra producción).
// Resuelve los nombres de variables de cada integración antes de llamar a Prisma.
import { spawnSync } from "node:child_process";

const env = { ...process.env };
env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
env.DATABASE_URL_UNPOOLED ||= env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;

if (!env.DATABASE_URL) {
  console.error("No hay base configurada: cargá DATABASE_URL (o conectá Neon desde Storage en Vercel).");
  process.exit(1);
}

const res = spawnSync("prisma", ["migrate", "deploy"], { stdio: "inherit", env, shell: true });
process.exit(res.status ?? 1);
