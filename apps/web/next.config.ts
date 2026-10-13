import type { NextConfig } from "next";
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Un solo .env en la raíz del monorepo para todas las apps.
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const nextConfig: NextConfig = {
  transpilePackages: ["@88/db", "@88/ai"],
  // En el monorepo, Next no copia solo el motor de Prisma al deploy.
  webpack: (config, { isServer }) => {
    if (isServer) config.plugins = [...config.plugins, new PrismaPlugin()];
    return config;
  },
};

export default nextConfig;
