// ============================================
// services/storage/validation.ts
// Contrôles d'entrée communs à tous les fournisseurs de stockage.
//
// Ces règles étaient écrites dans le fournisseur disque local. Les dupliquer
// dans le fournisseur distant aurait garanti qu'elles divergent au premier
// ajout de format. Elles vivent donc ici, et chaque fournisseur les appelle.
// ============================================
import {
  EXTENSIONS_PAR_MIME,
  FORMATS_LIBELLE,
  MIME_AUTORISES,
  signatureConcorde,
} from "./signature.js";
import { MAX_UPLOAD_BYTES } from "../../domain/rules.js";
import { STOCKAGE } from "../../config/constants.js";
import { ValidationError } from "../../utils/errors.js";
import type { FichierEntrant } from "./storage.service.js";

// Un dossier de stockage est une suite de segments simples. Il est construit
// par le code appelant à partir d'identifiants (marins/<id>/documents), mais
// rien ne garantit qu'un identifiant reste propre : le contrôle est fait
// ici, pas supposé en amont.
const SEGMENT_VALIDE = /^[A-Za-z0-9_-]+$/;

export const validerDossier = (dossier: string): string => {
  const segments = dossier.split("/").filter(function (segment) {
    return segment.length > 0;
  });

  if (segments.length === 0 || segments.length > STOCKAGE.PROFONDEUR_MAX_DOSSIER) {
    throw new ValidationError("Dossier de stockage invalide.");
  }

  const valides = segments.every(function (segment) {
    return SEGMENT_VALIDE.test(segment);
  });

  if (!valides) {
    throw new ValidationError("Dossier de stockage invalide.");
  }

  return segments.join("/");
};

// Pièce contrôlée, prête à être écrite sur le support.
export interface PieceValidee {
  contenu: Buffer;
  extension: string;
}

export const validerPieceEntrante = (fichier: FichierEntrant): PieceValidee => {
  if (!MIME_AUTORISES.includes(fichier.mimeType)) {
    throw new ValidationError(
      `Format de fichier non accepté. Formats admis : ${FORMATS_LIBELLE}.`,
    );
  }

  // Buffer.from ignore silencieusement les caractères invalides en base64 :
  // un contenu corrompu produirait un fichier tronqué plutôt qu'une erreur.
  // Le contrôle de signature plus bas est ce qui l'arrête.
  const contenu = Buffer.from(fichier.contenuBase64, "base64");

  if (contenu.byteLength === 0) {
    throw new ValidationError("Fichier vide ou illisible.");
  }

  if (contenu.byteLength > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `Fichier trop volumineux. Taille maximale : ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} Mo.`,
    );
  }

  // Le type réel du fichier est contrôlé sur ses premiers octets : le
  // mimeType annoncé par le client n'engage que lui.
  if (!signatureConcorde(fichier.mimeType, contenu)) {
    throw new ValidationError(
      `Le fichier ne correspond pas au format annoncé. Formats admis : ${FORMATS_LIBELLE}.`,
    );
  }

  return { contenu, extension: EXTENSIONS_PAR_MIME[fichier.mimeType] };
};

// Chemin de l'objet à partir de l'URL enregistrée en base.
//
// Toutes les URL de pièces produites par la plateforme commencent par
// /uploads/. Accepter autre chose reviendrait à laisser un appelant
// construire un chemin arbitraire pour une suppression ou une signature.
export const extraireCheminStocke = (url: string): string => {
  if (!url.startsWith(STOCKAGE.PREFIXE_URL)) {
    throw new ValidationError("Référence de fichier invalide.");
  }

  const chemin = url.slice(STOCKAGE.PREFIXE_URL.length);

  if (chemin.length === 0 || chemin.includes("..") || chemin.startsWith("/")) {
    throw new ValidationError("Référence de fichier invalide.");
  }

  return chemin;
};