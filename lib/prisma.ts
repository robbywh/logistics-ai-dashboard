import { PrismaClient } from "../generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const accelerateUrl = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL!;

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ accelerateUrl });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
