// ============================================
// lib/prisma.ts
// Client Prisma unique pour tout le processus.
// En développement, le rechargement à chaud recrée le module : l'instance
// est mémorisée sur globalThis pour ne pas ouvrir un pool par rechargement.
// ============================================
import { PrismaClient } from "@prisma/client";
import { estProduction } from "../config/env.js";

const globalPourPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalPourPrisma.prisma ??
  new PrismaClient({
    log: estProduction ? ["error"] : ["error", "warn"],
  });

if (!estProduction) {
  globalPourPrisma.prisma = prisma;
}
