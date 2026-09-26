// ============================================
// server.ts
// Point d'entrée du serveur : ouverture du port, démarrage du
// planificateur, arrêt propre.
// ============================================
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { demarrerPlanificateur, arreterPlanificateur } from "./jobs/scheduler.js";

const serveur = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, environnement: env.NODE_ENV },
    `API PGMI démarrée sur http://localhost:${env.PORT}`,
  );
  demarrerPlanificateur();
});

// Arrêt propre : le serveur cesse d'accepter des connexions, puis la
// connexion à la base est refermée. Sans cela, un redéploiement peut
// interrompre une requête en cours d'écriture.
const arreter = async (signal: string) => {
  logger.info({ signal }, "Arrêt du serveur demandé");
  arreterPlanificateur();

  serveur.close(async () => {
    await prisma.$disconnect();
    logger.info("Serveur arrêté proprement");
    process.exit(0);
  });

  // Filet de sécurité si une connexion reste ouverte
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => void arreter("SIGTERM"));
process.on("SIGINT", () => void arreter("SIGINT"));

process.on("unhandledRejection", (raison) => {
  logger.error({ err: raison }, "Promesse rejetée non gérée");
});
