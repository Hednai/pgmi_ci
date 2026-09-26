// ============================================
// services/storage/storage.service.ts
// Stockage des pièces jointes (photos, certificats, justificatifs).
//
// Le contrat StorageProvider isole le reste du code du support réel :
// disque local en développement, Supabase Storage en production. Aucune
// couche métier ne manipule de chemin de fichier.
// ============================================
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../../lib/logger.js";
import { MAX_UPLOAD_BYTES } from "../../domain/rules.js";
import { ValidationError } from "../../utils/errors.js";

export interface FichierEntrant {
  nom: string;
  mimeType: string;
  // Contenu encodé en base64, envoyé par le client après compression
  contenuBase64: string;
}

export interface FichierStocke {
  url: string;
  nom: string;
  mimeType: string;
  taille: number;
}

export interface StorageProvider {
  readonly code: string;
  enregistrer(dossier: string, fichier: FichierEntrant): Promise<FichierStocke>;
  supprimer(url: string): Promise<void>;
}

// Types acceptés (cahier des charges : JPG, PNG, PDF)
const MIME_AUTORISES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const RACINE_UPLOADS = join(process.cwd(), "uploads");

// Implémentation disque local. Les fichiers sont servis en statique par
// app.ts sous /uploads.
export const localDiskStorageProvider: StorageProvider = {
  code: "LOCAL_DISK",

  async enregistrer(dossier: string, fichier: FichierEntrant): Promise<FichierStocke> {
    if (!MIME_AUTORISES.includes(fichier.mimeType)) {
      throw new ValidationError("Format de fichier non accepté. Formats admis : JPG, PNG, PDF.");
    }

    const contenu = Buffer.from(fichier.contenuBase64, "base64");

    if (contenu.byteLength > MAX_UPLOAD_BYTES) {
      throw new ValidationError("Fichier trop volumineux. Taille maximale : 2 Mo.");
    }

    const cible = join(RACINE_UPLOADS, dossier);
    await mkdir(cible, { recursive: true });

    // Nom aléatoire : le nom d'origine n'est jamais utilisé sur le disque,
    // il pourrait contenir un chemin relatif.
    const nomFichier = `${randomUUID()}${extname(fichier.nom) || ""}`;
    await writeFile(join(cible, nomFichier), contenu);

    return {
      url: `/uploads/${dossier}/${nomFichier}`,
      nom: fichier.nom,
      mimeType: fichier.mimeType,
      taille: contenu.byteLength,
    };
  },

  async supprimer(url: string): Promise<void> {
    try {
      await unlink(join(process.cwd(), url.replace(/^\//, "")));
    } catch (err) {
      logger.warn({ err, url }, "Suppression de fichier impossible");
    }
  },
};

// Fournisseur actif. Supabase Storage viendra s'ajouter ici.
export const storage: StorageProvider = localDiskStorageProvider;
