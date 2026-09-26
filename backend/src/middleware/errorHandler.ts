// ============================================
// middleware/errorHandler.ts
// Gestion centralisée des erreurs, format de réponse uniforme.
// En production, ni pile d'appel ni message technique n'est renvoyé.
// ============================================
import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";
import { logger } from "../lib/logger.js";
import { estProduction } from "../config/env.js";

interface ErreurEnrichie extends Error {
  statusCode?: number;
  rule?: string;
  code?: string;
  meta?: { target?: string[] };
}

const errorHandler = (
  err: ErreurEnrichie,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode = err.statusCode ?? 500;
  let message = err.message || "Erreur interne du serveur.";
  let rule: string | undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    rule = err.rule;
  }

  // P2002 : contrainte d'unicité violée (matricule, référence, email)
  if (err.code === "P2002") {
    statusCode = 409;
    const champ = err.meta?.target?.[0] ?? "champ";
    message = `Cette valeur est déjà utilisée (${champ}).`;
  }

  // P2025 : enregistrement introuvable
  if (err.code === "P2025") {
    statusCode = 404;
    message = "Ressource introuvable.";
  }

  if (err.name === "ZodError") {
    statusCode = 400;
    message = "Données invalides.";
  }

  // Les erreurs 5xx sont anormales : elles sont journalisées en error,
  // les 4xx en warn pour ne pas noyer les alertes réelles.
  const contexte = { err, chemin: req.originalUrl, methode: req.method };
  if (statusCode >= 500) {
    logger.error(contexte, "Erreur serveur");
    if (estProduction) message = "Erreur interne du serveur.";
  } else {
    logger.warn(contexte, "Requête refusée");
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(rule ? { rule } : {}),
  });
};

export default errorHandler;
