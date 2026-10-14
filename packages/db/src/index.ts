import { PrismaClient } from "@prisma/client";
import { resolveDatabaseEnv } from "./env";

export * from "@prisma/client";

resolveDatabaseEnv();

// Un solo cliente por proceso: en dev, Next recarga módulos y abriría conexiones de más.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
