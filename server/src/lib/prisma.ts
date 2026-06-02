import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Reuse client across hot reloads (dev) and warm serverless invocations (Vercel)
globalForPrisma.prisma = prisma;

export default prisma;
