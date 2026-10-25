// ============================================
// lib/fichiers.ts
// Ouverture des pièces jointes privées.
//
// Les pièces du registre ne sont pas servies en statique : la route
// /uploads vérifie l'identité du demandeur, journalise la consultation
// (R14) puis délivre le contenu ou une URL signée. Elle exige donc un
// en-tête Authorization.
//
// Un simple <a href="/uploads/..."> ne pouvait pas fonctionner : un lien
// HTML n'envoie aucun jeton, et l'adresse relative visait le domaine du
// frontend au lieu de celui de l'API. Le justificatif restait invisible,
// pour le marin comme pour l'agent.
//
// La pièce est donc récupérée par fetch avec le jeton, puis présentée au
// navigateur sous forme d'URL temporaire.
// ============================================
import { t } from "../i18n/index.js";
import { jetons, ErreurApi } from "./apiClient.js";

const BASE = import.meta.env.VITE_API_URL ?? "";

// Délai avant révocation de l'URL temporaire, en millisecondes. Le temps que
// l'onglet ouvert ait chargé le contenu ; au-delà l'objet est libéré.
const DELAI_REVOCATION_MS = 60 * 1000;

// Récupérer une pièce et la transformer en URL utilisable par le navigateur.
// L'appelant est responsable de ce qu'il en fait : affichage ou enregistrement.
const telechargerBlob = async (cheminFichier: string): Promise<string> => {
  const jeton = jetons.lireAcces();
  if (!jeton) {
    throw new ErreurApi(t.pieces.sessionExpiree, 401);
  }

  let reponse: Response;
  try {
    reponse = await fetch(`${BASE}${cheminFichier}`, {
      headers: { Authorization: `Bearer ${jeton}` },
    });
  } catch {
    throw new ErreurApi(t.commun.erreurReseau, 0);
  }

  if (!reponse.ok) {
    throw new ErreurApi(
      reponse.status === 403 ? t.pieces.accesRefuse : t.pieces.indisponible,
      reponse.status,
    );
  }

  const contenu = await reponse.blob();
  return URL.createObjectURL(contenu);
};

// Libérer l'URL temporaire après un délai : la révoquer immédiatement
// couperait le chargement de l'onglet qui vient de s'ouvrir.
const libererPlusTard = (url: string) => {
  window.setTimeout(function revoquer() {
    URL.revokeObjectURL(url);
  }, DELAI_REVOCATION_MS);
};

// Ouvrir une pièce dans un nouvel onglet.
// Le repli en navigation directe couvre les navigateurs mobiles qui
// bloquent window.open hors interaction immédiate.
export const ouvrirPieceJointe = async (cheminFichier: string): Promise<void> => {
  const url = await telechargerBlob(cheminFichier);
  const onglet = window.open(url, "_blank", "noopener,noreferrer");
  if (!onglet) {
    window.location.href = url;
  }
  libererPlusTard(url);
};

// Enregistrer une pièce sous le nom d'origine.
export const enregistrerPieceJointe = async (
  cheminFichier: string,
  nomPropose: string,
): Promise<void> => {
  const url = await telechargerBlob(cheminFichier);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomPropose;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  libererPlusTard(url);
};