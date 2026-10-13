import type { NextConfig } from "next";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Un solo .env en la raíz del monorepo para web y worker.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  // La raíz es el monorepo, no cualquier lockfile que haya más arriba en la compu.
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
  transpilePackages: ["@88/db", "@88/core", "@88/connectors", "@88/services"],
  serverExternalPackages: ["pg-boss", "pg"],
  images: { unoptimized: true },
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  // En el monorepo, Next no copia solo el motor de Prisma al deploy.
  webpack: (config, { isServer }) => {
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    return config;
  },
};

export default nextConfig;
