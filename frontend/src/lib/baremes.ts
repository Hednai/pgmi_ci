// ============================================
// lib/baremes.ts
// Logique d'une ligne de barème, hors de tout composant.
//
// Une ligne tarife soit un type de certificat, soit une prestation de la
// plateforme. Les deux formes n'ont ni les mêmes champs ni la même clé
// d'unicité : les distinguer ici évite de répandre la condition dans les
// écrans. Aucune nature de demande, aucun code de service et aucun montant
// n'est écrit en dur : les listes proviennent du dictionnaire, les montants
// de la base.
// ============================================
import { t } from "../i18n/index.js";
import type { Bareme, TypeCertificat } from "../types/api.js";

// Les deux formes qu'une ligne de barème peut prendre.
export const FORME_BAREME = {
  CERTIFICAT: "CERTIFICAT",
  SERVICE: "SERVICE",
} as const;

export type FormeBareme = (typeof FORME_BAREME)[keyof typeof FORME_BAREME];

// Natures de demande tarifables pour un certificat. La liste vient du
// dictionnaire : en ajouter une ne demande de toucher à aucun écran.
export const NATURES_DEMANDE: string[] = Object.keys(t.demandes.type);

// Codes de service tarifables, alimentés de la même façon.
export const CODES_SERVICE: string[] = Object.keys(t.referentiels.services);

// Saisie du formulaire. Le montant reste une chaîne tant qu'il est édité :
// un champ vidé par l'utilisateur ne doit pas se transformer en zéro.
export interface SaisieBareme {
  forme: FormeBareme;
  certificateTypeId: string;
  serviceCode: string;
  requestType: string;
  amount: string;
  currency: string;
}

// Corps accepté par POST /api/referentiels/baremes. Le serveur valide une
// union : un champ étranger à la forme choisie n'y a pas sa place.
export interface CorpsBaremeCertificat {
  certificateTypeId: string;
  requestType: string;
  amount: string;
  currency?: string;
}

export interface CorpsBaremeService {
  serviceCode: string;
  amount: string;
  currency?: string;
}

export type CorpsBareme = CorpsBaremeCertificat | CorpsBaremeService;

// Forme d'une ligne existante, déduite du champ renseigné et non d'un
// indicateur séparé qui pourrait contredire les données.
export const formeDe = (bareme: Bareme): FormeBareme =>
  bareme.serviceCode ? FORME_BAREME.SERVICE : FORME_BAREME.CERTIFICAT;

// Libellé affiché pour une ligne, quelle que soit sa forme.
export const libelleBareme = (
  bareme: Bareme,
  certificats: TypeCertificat[],
): string => {
  if (bareme.serviceCode) {
    return t.referentiels.services[bareme.serviceCode] ?? t.referentiels.prestationInconnue;
  }

  const certificat = certificats.find((valeur) => valeur.id === bareme.certificateTypeId);
  return certificat?.label ?? t.referentiels.prestationInconnue;
};

// Nature lisible d'une ligne. Les natures de certificat sont déjà traduites
// pour le marin ; une prestation porte une nature unique.
export const natureBareme = (bareme: Bareme): string =>
  bareme.serviceCode
    ? t.referentiels.natureService
    : (t.demandes.type[bareme.requestType] ?? bareme.requestType);

// Saisie de départ : vide pour une création, alimentée par la ligne pour
// une modification. La devise existante est conservée telle quelle, celle
// d'une création est laissée au serveur.
export const saisieDepuis = (bareme?: Bareme): SaisieBareme => ({
  forme: bareme ? formeDe(bareme) : FORME_BAREME.CERTIFICAT,
  certificateTypeId: bareme?.certificateTypeId ?? "",
  serviceCode: bareme?.serviceCode ?? "",
  requestType: bareme?.serviceCode ? "" : (bareme?.requestType ?? ""),
  amount: bareme ? String(bareme.amount) : "",
  currency: bareme?.currency ?? "",
});

// Contrôles minimaux avant envoi, indexés par nom de champ serveur pour que
// les refus du client et ceux de la validation s'affichent au même endroit.
// Le serveur reste l'autorité : un montant vide y partirait sous la forme
// d'un zéro accepté, c'est la raison d'être de ce garde-fou.
export const verifierSaisie = (saisie: SaisieBareme): Record<string, string> => {
  const erreurs: Record<string, string> = {};

  if (saisie.forme === FORME_BAREME.SERVICE) {
    if (!saisie.serviceCode) erreurs.serviceCode = t.referentiels.prestationObligatoire;
  } else {
    if (!saisie.certificateTypeId) {
      erreurs.certificateTypeId = t.referentiels.certificatObligatoire;
    }
    if (!saisie.requestType) erreurs.requestType = t.referentiels.natureObligatoire;
  }

  const montantSaisi = saisie.amount.trim();
  if (!montantSaisi) {
    erreurs.amount = t.referentiels.montantObligatoire;
  } else if (!/^\d+$/.test(montantSaisi)) {
    erreurs.amount = t.referentiels.montantInvalide;
  }

  return erreurs;
};

// Corps envoyé au serveur. Seuls les champs de la forme retenue sont
// transmis : la devise n'est jointe que si la ligne en portait déjà une,
// sinon le défaut du serveur s'applique.
export const corpsBareme = (saisie: SaisieBareme): CorpsBareme => {
  const montantEtDevise = {
    amount: saisie.amount.trim(),
    ...(saisie.currency ? { currency: saisie.currency } : {}),
  };

  if (saisie.forme === FORME_BAREME.SERVICE) {
    return { serviceCode: saisie.serviceCode, ...montantEtDevise };
  }

  return {
    certificateTypeId: saisie.certificateTypeId,
    requestType: saisie.requestType,
    ...montantEtDevise,
  };
};