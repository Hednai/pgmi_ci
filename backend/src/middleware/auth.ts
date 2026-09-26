// ============================================
// middleware/auth.ts
// Authentification par jeton d'accès JWT.
//
// Deux publics distincts partagent le même mécanisme : les agents
// (email + mot de passe) et les marins (OTP SMS). Le champ "type" du jeton
// tranche, ce qui évite qu'un jeton marin ouvre une route agent.
// ============================================
import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { prisma } from "../lib/prisma.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AgentRole } from "../domain/roles.js";
import { MARIN_STATUS } from "../domain/status.js";

// Identité de l'appelant, attachée à la requête pour les couches suivantes
export interface Acteur {
  id: string;
  type: "AGENT" | "MARIN";
  role?: AgentRole;
  authorityId?: string;
  label: string;
}

declare module "express-serve-static-core" {
  interface Request {
    acteur?: Acteur;
  }
}

// Extraire le jeton de l'en-tête Authorization
const lireJeton = (req: Request): string | null => {
  const entete = req.headers.authorization;
  if (!entete?.startsWith("Bearer ")) return null;
  const jeton = entete.slice(7).trim();
  return jeton.length > 0 ? jeton : null;
};

// Exiger un agent authentifié.
// Le jeton est recoupé avec la base : un agent désactivé ou déconnecté
// (tokensRevokedAt) est refusé même si son jeton n'a pas encore expiré.
export const requireAgent = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const jeton = lireJeton(req);
    if (!jeton) throw new UnauthorizedError();

    const charge = verifyAccessToken(jeton);
    if (!charge || charge.type !== "AGENT") throw new UnauthorizedError();

    const agent = await prisma.agent.findUnique({
      where: { id: charge.sub },
      select: {
        id: true,
        role: true,
        authorityId: true,
        isActive: true,
        firstName: true,
        lastName: true,
        tokensRevokedAt: true,
      },
    });

    if (!agent || !agent.isActive) throw new UnauthorizedError("Compte agent inactif.");

    // Jeton émis avant une déconnexion serveur : refusé
    const emisLe = (charge.iat ?? 0) * 1000;
    if (agent.tokensRevokedAt && emisLe < agent.tokensRevokedAt.getTime()) {
      throw new UnauthorizedError("Session expirée. Reconnectez-vous.");
    }

    req.acteur = {
      id: agent.id,
      type: "AGENT",
      role: agent.role as AgentRole,
      authorityId: agent.authorityId,
      label: `${agent.firstName} ${agent.lastName}`,
    };

    next();
  },
);

// Exiger un marin authentifié et actif.
// Un compte PENDING peut lire son propre dossier mais ne peut rien soumettre :
// le contrôle fin est fait par requireActiveMarin ci-dessous.
export const requireMarin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const jeton = lireJeton(req);
    if (!jeton) throw new UnauthorizedError();

    const charge = verifyAccessToken(jeton);
    if (!charge || charge.type !== "MARIN") throw new UnauthorizedError();

    const marin = await prisma.marin.findUnique({
      where: { id: charge.sub },
      select: { id: true, firstName: true, lastName: true, status: true, authorityId: true },
    });

    if (!marin) throw new UnauthorizedError();
    if (marin.status === MARIN_STATUS.SUSPENDED) {
      throw new ForbiddenError("Ce dossier marin est suspendu.");
    }

    req.acteur = {
      id: marin.id,
      type: "MARIN",
      authorityId: marin.authorityId,
      label: `${marin.firstName} ${marin.lastName}`,
    };

    next();
  },
);

// Exiger un marin dont le dossier est activé (R1).
// À placer après requireMarin sur toute route qui produit un acte officiel.
export const requireActiveMarin = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const marin = await prisma.marin.findUnique({
      where: { id: req.acteur?.id ?? "" },
      select: { status: true },
    });

    if (marin?.status !== MARIN_STATUS.ACTIVE) {
      throw new ForbiddenError(
        "Votre dossier doit être activé au guichet DGAM avant cette action.",
        "R1",
      );
    }

    next();
  },
);
