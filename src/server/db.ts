import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/server/env";

function createClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

// Reuse a single client across hot reloads in development — but drop it when the generated
// client itself changed (after `prisma generate`), otherwise new columns stay "unknown".
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaClass?: unknown };

const cached = globalForPrisma.prismaClass === PrismaClient ? globalForPrisma.prisma : undefined;
export const prisma = cached ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaClass = PrismaClient;
}

export type Db = typeof prisma;
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
