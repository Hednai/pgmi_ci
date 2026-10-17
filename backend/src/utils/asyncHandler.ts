// ============================================
// utils/asyncHandler.ts
// Enveloppe un contrôleur asynchrone et transmet toute erreur au
// gestionnaire centralisé. Évite un try/catch répété dans chaque contrôleur.
// ============================================
import type { Request, Response, NextFunction, RequestHandler } from "express";

type ControleurAsync = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

export const asyncHandler =
  (controleur: ControleurAsync): RequestHandler =>
  (req, res, next) => {
    controleur(req, res, next).catch(next);
  };
