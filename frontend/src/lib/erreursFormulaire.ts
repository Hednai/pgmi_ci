// ============================================
// lib/erreursFormulaire.ts
// Répartition d'une erreur d'API entre les champs d'un formulaire et le
// bandeau global.
//
// Le serveur renvoie déjà, pour chaque refus de validation, le champ fautif
// et le format attendu. Sans ce découpage, les écrans n'affichaient que le
// message d'enveloppe, et l'utilisateur devait deviner quelle saisie
// reprendre. La règle appliquée ici : un problème rattaché à un champ
// s'affiche sous ce champ, un problème qui ne l'est pas reste dans le
// bandeau. Les deux ne sont jamais montrés en même temps pour la même
// cause.
// ============================================
import { ErreurApi } from "./apiClient.js";

export interface ErreursFormulaire {
  // Message à passer à la propriété erreur de InputField, SelectField
  // ou TextAreaField, indexé par nom de champ
  parChamp: Record<string, string>;
  // Message du bandeau, vide si tous les problèmes portent sur un champ
  global: string;
}

export const AUCUNE_ERREUR: ErreursFormulaire = { parChamp: {}, global: "" };

export const repartirErreurs = (
  erreur: unknown,
  messageParDefaut: string,
): ErreursFormulaire => {
  if (!(erreur instanceof ErreurApi)) {
    return { parChamp: {}, global: messageParDefaut };
  }

  const parChamp = erreur.parChamp;
  const porteSurUnChamp = Object.keys(parChamp).length > 0;

  return { parChamp, global: porteSurUnChamp ? "" : erreur.message };
};