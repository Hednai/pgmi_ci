// ============================================
// middleware/rbac.ts
// Contrôle d'accès par rôle (ENF-007).
//
// Les listes de rôles viennent de domain/roles.ts : une route déclare
// l'intention métier ("qui décide ?"), pas une énumération recopiée.
// ============================================
import type { Request, Response, NextFunction } from "express";
import type { AgentRole } from "../domain/roles.js";
import { AUTHORITY_LEVEL } from "../domain/roles.js";
import { ForbiddenError, UnauthorizedError } from "../utils/errors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../lib/prisma.js";

// Restreindre une route à une liste de rôles
export const requireRole =
  (...roles: AgentRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const acteur = req.acteur;
    if (!acteur || acteur.type !== "AGENT") {
      return next(new UnauthorizedError());
    }
    if (!acteur.role || !roles.includes(acteur.role)) {
      return next(new ForbiddenError("Votre rôle ne permet pas cette action."));
    }
    return next();
  };

// Restreindre une route aux agents rattachés à une institution de formation.
// Contrôle l'autorité réelle en base, pas seulement le rôle porté par le
// jeton : un rôle ARSTM rattaché par erreur à la DGAM est refusé.
export const requireTrainingInstitution = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const acteur = req.acteur;
    if (!acteur?.authorityId) throw new UnauthorizedError();

    const autorite = await prisma.authority.findUnique({
      where: { id: acteur.authorityId },
      select: { level: true, isActive: true },
    });

    if (!autorite?.isActive || autorite.level !== AUTHORITY_LEVEL.TRAINING_INSTITUTION) {
      throw new ForbiddenError(
        "Cette action est réservée aux institutions de formation partenaires.",
      );
    }

    next();
  },
);
