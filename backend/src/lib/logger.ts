// ============================================
// lib/logger.ts
// Journalisation Pino. En développement, pino-pretty rend la sortie lisible ;
// en production, le JSON brut est conservé pour être exploité par l'hébergeur.
//
// Convention du projet : l'objet erreur passe TOUJOURS en premier argument,
// logger.error({ err }, "texte").
// ============================================
import pino from "pino";
import { env, estProduction } from "../config/env.js";

export const logger = pino({
  level: estProduction ? "info" : "debug",
  // Ne jamais journaliser un secret ou un code OTP en clair
  redact: {
    paths: [
      "req.headers.authorization",
      "*.password",
      "*.passwordHash",
      "*.code",
      "*.codeHash",
      "*.token",
    ],
    censor: "[masqué]",
  },
  transport: estProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
      },
});

logger.debug({ env: env.NODE_ENV }, "Journalisation initialisée");
