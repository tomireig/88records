// Acepta los nombres que cargan las distintas integraciones de base en Vercel:
// Neon (DATABASE_URL / DATABASE_URL_UNPOOLED), Vercel Postgres o Supabase (POSTGRES_*).
export function resolveDatabaseEnv(env: NodeJS.ProcessEnv = process.env): void {
  env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
  env.DATABASE_URL_UNPOOLED ||= env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
}
