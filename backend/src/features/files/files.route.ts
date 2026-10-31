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
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { storage } from "../../services/storage/storage.service.js";
import { mimeDepuisExtension } from "../../services/storage/signature.js";
import { STOCKAGE } from "../../config/constants.js";
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

    // Ordre imposé, et il ne doit jamais changer :
    //   1. contrôle d'habilitation, qui peut refuser ;
    //   2. journalisation, qui doit précéder toute délivrance ;
    //   3. délivrance du contenu ou de l'URL signée.
    // Journaliser après la délivrance laisserait une fenêtre où un fichier
    // est servi sans trace si le processus tombe entre les deux.
    await autoriserLecture(acteur, brut);

    // R14 : la consultation d'une pièce d'identité est une action sensible.
    // Sans cette trace, un agent habilité pouvait ouvrir le livret maritime
    // de n'importe quel marin du registre sans laisser d'empreinte.
    //
    // Le journal ne porte que le chemin de stockage et le propriétaire : ni
    // URL signée, ni jeton, ni contenu. Une trace d'audit ne doit jamais
    // devenir elle-même un moyen d'accès.
    await logAction({
      actorType: acteur.type,
      actorId: acteur.id,
      actorLabel: acteur.label,
      action: AUDIT_ACTION.FILE_READ,
      targetType: "Fichier",
      targetId: brut,
      metadata: { proprietaire: await proprietaireDuChemin(brut) },
      req,
    });

    // Les pièces jointes ne sont jamais mises en cache par un intermédiaire :
    // ce sont des pièces d'identité.
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    // L'URL signée ne doit pas fuiter vers un site tiers via l'en-tête
    // Referer si le document contient un lien.
    res.setHeader("Referrer-Policy", "no-referrer");

    // Stockage distant : le serveur ne relaie pas les octets, il redirige
    // vers une URL signée de courte durée. La signature n'est demandée
    // qu'ici, après le contrôle et la trace.
    const urlSignee = storage.urlDeLecture
      ? await storage.urlDeLecture(`${STOCKAGE.PREFIXE_URL}${brut}`)
      : null;

    if (urlSignee) {
      res.redirect(302, urlSignee);
      return;
    }

    // Stockage local : le fichier est lu sur le disque du serveur.
    try {
      await stat(absolu);
    } catch {
      throw new NotFoundError("Document introuvable.");
    }

    // Le type réel est déduit de l'extension, elle-même posée au dépôt à
    // partir de la signature du fichier. Servi sans en-tête de type, le
    // document arrivait au navigateur comme un flux binaire inconnu :
    // impossible à afficher, et enregistré sans format.
    const typeMime = mimeDepuisExtension(absolu);
    if (typeMime) {
      res.setHeader("Content-Type", typeMime);
    }

    // inline : la pièce s'affiche dans l'onglet de consultation. Le
    // téléchargement reste piloté par le client, qui impose son nom.
    res.setHeader("Content-Disposition", "inline");

    createReadStream(absolu).pipe(res);
  }),
);

export { filesRouter };