import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** Raíz del monorepo (donde está pnpm-workspace.yaml), para que web y worker compartan rutas. */
export function repoRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const up = dirname(dir);
    if (up === dir) return process.cwd();
    dir = up;
  }
}

/** Carga el .env de la raíz si existe. Las variables ya definidas no se pisan. */
export function loadRootEnv(): void {
  const file = resolve(repoRoot(), ".env");
  if (existsSync(file)) process.loadEnvFile(file);
}

export function appUrl(): string {
  const url = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return url.replace(/\/$/, "");
}

export function flag(name: string): boolean {
  return ["1", "true", "yes"].includes((process.env[name] ?? "").toLowerCase());
}
