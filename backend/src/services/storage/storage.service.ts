// ============================================
// services/storage/storage.service.ts
// Stockage des pièces jointes (photos, certificats, justificatifs).
//
// Le contrat StorageProvider isole le reste du code du support réel :
// disque local en développement, Supabase Storage en production. Aucune
// couche métier ne manipule de chemin de fichier.
// ============================================
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../../lib/logger.js";
import { STOCKAGE } from "../../config/constants.js";
import { env } from "../../config/env.js";
// validation.ts n'importe de ce fichier que des types, effacés à la
// compilation : il n'y a donc pas de cycle à l'exécution.
import {
  extraireCheminStocke,
  validerDossier,
  validerPieceEntrante,
} from "./validation.js";

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
  // URL de lecture temporaire, quand le support en propose une.
  // Null signifie « lis le fichier toi-même » : c'est le cas du disque
  // local, servi par la route des pièces jointes. La route appelle cette
  // méthode après son contrôle d'habilitation, jamais avant.
  urlDeLecture?(url: string): Promise<string | null>;
}

const RACINE_UPLOADS = join(process.cwd(), "uploads");

// Implémentation disque local. Les fichiers sont servis en statique par
// app.ts sous /uploads.
export const localDiskStorageProvider: StorageProvider = {
  code: "LOCAL_DISK",

  async enregistrer(dossier: string, fichier: FichierEntrant): Promise<FichierStocke> {
    const sousDossier = validerDossier(dossier);
    const { contenu, extension } = validerPieceEntrante(fichier);

    const cible = join(RACINE_UPLOADS, sousDossier);
    await mkdir(cible, { recursive: true });

    // Nom aléatoire, extension déduite du type réel. Le nom d'origine
    // n'est jamais utilisé sur le disque.
    const nomFichier = `${randomUUID()}${extension}`;
    await writeFile(join(cible, nomFichier), contenu);

    return {
      url: `${STOCKAGE.PREFIXE_URL}${sousDossier}/${nomFichier}`,
      nom: fichier.nom,
      mimeType: fichier.mimeType,
      taille: contenu.byteLength,
    };
  },

  async supprimer(url: string): Promise<void> {
    const chemin = extraireCheminStocke(url);
    try {
      await unlink(join(RACINE_UPLOADS, chemin));
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      // ENOENT : fichier déjà absent, la suppression est idempotente.
      if (code === "ENOENT") {
        logger.warn({ chemin }, "Fichier déjà absent au moment de la suppression");
        return;
      }
      // Toute autre cause est remontée : une pièce d'identité restée en
      // place alors que l'application la croit effacée est précisément ce
      // qu'un audit reproche.
      throw err;
    }
  },
};

// Fournisseurs disponibles, indexés par la valeur de STORAGE_PROVIDER.
// L'import de Supabase est différé : une instance en stockage local
// ne charge jamais son code.
const fournisseurs: Record<string, () => Promise<StorageProvider>> = {
  local: async () => localDiskStorageProvider,
  supabase: async () => {
    const { supabaseStorageProvider } = await import("./supabaseStorageProvider.js");
    return supabaseStorageProvider;
  },
};

// C'est la promesse qui est mémorisée, pas son résultat. Deux appels
// concurrents au démarrage partagent le même import au lieu d'instancier
// deux fournisseurs dont le second écrase le premier.
let chargement: Promise<StorageProvider> | null = null;

const obtenirStockage = async (): Promise<StorageProvider> => {
  if (!chargement) {
    const fabrique = fournisseurs[env.STORAGE_PROVIDER];

    if (!fabrique) {
      const details = {
        valeur: env.STORAGE_PROVIDER,
        fournisseursConnus: Object.keys(fournisseurs),
      };

      // En production, une valeur inconnue fait échouer le service.
      // Retomber sur le disque local réintroduirait exactement le défaut que
      // le stockage distant corrige : une faute de frappe dans la variable
      // suffirait à écrire des pièces d'identité sur un disque éphémère, et
      // personne ne s'en apercevrait avant le premier redéploiement.
      if (env.NODE_ENV === "production") {
        logger.error(details, "STORAGE_PROVIDER inconnu en production");
        throw new Error(
          `STORAGE_PROVIDER inconnu : "${env.STORAGE_PROVIDER}". ` +
            `Valeurs acceptées : ${Object.keys(fournisseurs).join(", ")}.`,
        );
      }

      // Hors production, le repli local reste commode, mais jamais muet.
      logger.error(details, "STORAGE_PROVIDER inconnu, repli sur le disque local");
    }

    chargement = (fabrique ?? fournisseurs.local)().then(function (fournisseur) {
      logger.info({ fournisseur: fournisseur.code }, "Fournisseur de stockage actif");
      return fournisseur;
    });
  }

  return chargement;
};

// Façade conservée pour les appelants existants : ils continuent d'écrire
// storage.enregistrer(...) sans connaître le fournisseur réel.
export const storage: StorageProvider = {
  code: "DELEGUE",
  enregistrer: async (dossier, fichier) =>
    (await obtenirStockage()).enregistrer(dossier, fichier),
  supprimer: async (url) => (await obtenirStockage()).supprimer(url),
  urlDeLecture: async (url) => {
    const fournisseur = await obtenirStockage();
    return fournisseur.urlDeLecture ? fournisseur.urlDeLecture(url) : null;
  },
};