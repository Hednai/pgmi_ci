// ============================================
// features/files/files.route.ts
// Accès aux pièces jointes privées.
//
// Le droit de lire un fichier se déduit de son emplacement, qui porte déjà le
// propriétaire : marins/<marinId>/... ou demandes/<demandeId>/...
// Aucun champ à ajouter au schéma, aucune migration.
// ============================================
import { Router } from "express";
import { join, normalize, resolve } from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { prisma } from "../../lib/prisma.js";
import { requireAuthenticated } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { aPermission, PERMISSION } from "../../domain/permissions.js";
import type { Acteur } from "../../middleware/auth.js";

const filesRouter = Router();

const RACINE_UPLOADS = resolve(process.cwd(), "uploads");

// Préfixe avec séparateur final. Sans lui, un dossier voisin nommé uploads2
// ou uploads-old passerait le contrôle de confinement.
const PREFIXE_RACINE = RACINE_UPLOADS.endsWith("/") ? RACINE_UPLOADS : `${RACINE_UPLOADS}/`;

// Vrai si le chemin résolu reste à l'intérieur du dossier des pièces jointes
const sousLaRacine = (absolu: string): boolean =>
  absolu === RACINE_UPLOADS || absolu.startsWith(PREFIXE_RACINE);

// Le marin propriétaire du fichier, déduit de son chemin de stockage.
// Renvoie null si le chemin ne suit aucun des schémas connus.
const proprietaireDuChemin = async (chemin: string): Promise<string | null> => {
  const segments = chemin.split("/").filter(Boolean);

  // marins/<marinId>/documents/... et marins/<marinId>/sea-service/...
  if (segments[0] === "marins" && segments[1]) {
    return segments[1];
  }

  // demandes/<demandeId>/... : le propriétaire est le marin de la demande
  if (segments[0] === "demandes" && segments[1]) {
    const demande = await prisma.renewalRequest.findUnique({
      where: { id: segments[1] },
      select: { marinId: true },
    });
    return demande?.marinId ?? null;
  }

  return null;
};

// Un marin lit ses propres fichiers. Un agent habilité à consulter un dossier
// lit ceux de son périmètre. Toute autre situation est refusée.
const autoriserLecture = async (acteur: Acteur, chemin: string): Promise<void> => {
  if (acteur.type === "AGENT") {
    if (!aPermission(acteur.role, PERMISSION.MARIN_CONSULTER)) {
      throw new ForbiddenError("Votre habilitation ne permet pas de consulter ce document.");
    }
    return;
  }

  const proprietaire = await proprietaireDuChemin(chemin);
  if (!proprietaire || proprietaire !== acteur.id) {
    throw new ForbiddenError("Ce document n'appartient pas à votre dossier.");
  }
};

filesRouter.get(
  "/*chemin",
  requireAuthenticated,
  asyncHandler(async (req, res) => {
    const acteur = req.acteur;
    if (!acteur) throw new ForbiddenError();

    const brut = Array.isArray(req.params.chemin)
      ? req.params.chemin.join("/")
      : String(req.params.chemin ?? "");

    const absolu = normalize(join(RACINE_UPLOADS, brut));
    if (!sousLaRacine(absolu)) {
      throw new ForbiddenError("Chemin de fichier invalide.");
    }

    await autoriserLecture(acteur, brut);

    try {
      await stat(absolu);
    } catch {
      throw new NotFoundError("Document introuvable.");
    }

    // Les pièces jointes ne sont jamais mises en cache par un intermédiaire :
    // ce sont des pièces d'identité.
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    createReadStream(absolu).pipe(res);
  }),
);

export { filesRouter };