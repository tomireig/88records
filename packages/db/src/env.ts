// Acepta los nombres que cargan las distintas integraciones de base en Vercel:
// Neon (DATABASE_URL / DATABASE_URL_UNPOOLED), Vercel Postgres o Supabase (POSTGRES_*).
// La plataforma vive en su propio schema de Postgres ("plataforma"), así convive sin tocar
// las tablas que ya haya en "public" (por ejemplo, las del Marketing OS anterior).

export const DEFAULT_SCHEMA = "plataforma";

export function withSchema(url: string | undefined, schema: string): string | undefined {
  if (!url || /[?&]schema=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}schema=${encodeURIComponent(schema)}`;
}

export function resolveDatabaseEnv(env: NodeJS.ProcessEnv = process.env): void {
  const schema = env.DATABASE_SCHEMA || DEFAULT_SCHEMA;
  env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
  env.DATABASE_URL_UNPOOLED ||= env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
  env.DATABASE_URL = withSchema(env.DATABASE_URL, schema);
  env.DATABASE_URL_UNPOOLED = withSchema(env.DATABASE_URL_UNPOOLED, schema);
}
