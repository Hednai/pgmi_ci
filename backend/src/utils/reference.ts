// ============================================
// utils/reference.ts
// Génération des références lisibles par un agent au guichet.
// Une référence n'est jamais aléatoire seule : elle porte l'année, ce qui
// permet de classer et de retrouver un dossier sans requête.
// ============================================
import { randomInt } from "node:crypto";
import { PREFIXE } from "../config/constants.js";

// Suffixe aléatoire à quatre chiffres
const suffixe = (): string => String(randomInt(0, 10000)).padStart(4, "0");

// Référence de demande : REN-2026-0812
export const genererReferenceDemande = (): string =>
  `${PREFIXE.DEMANDE}-${new Date().getUTCFullYear()}-${suffixe()}`;

// Code de session de formation : SES-2026-0412
export const genererCodeSession = (): string =>
  `${PREFIXE.SESSION}-${new Date().getUTCFullYear()}-${suffixe()}`;

// Référence de paiement interne, distincte de la référence de l'opérateur
export const genererReferencePaiement = (): string =>
  `${PREFIXE.PAIEMENT}-${Date.now().toString(36).toUpperCase()}-${suffixe()}`;

// Matricule marin : CI-MAR-2026-0847.
// L'unicité est garantie par la contrainte d'unicité en base, le service
// réessaie en cas de collision.
export const genererMatricule = (annee = new Date().getUTCFullYear()): string =>
  `${PREFIXE.MATRICULE}-${annee}-${suffixe()}`;

// Masquer un nom pour la page publique de vérification (R10) :
// « Kouassi Yao Jean » devient « K***** Y** J*** ».
export const masquerNom = (nomComplet: string): string =>
  nomComplet
    .split(/\s+/)
    .filter(Boolean)
    .map((mot) => {
      const premiere = mot.charAt(0).toUpperCase();
      return premiere + "*".repeat(Math.max(mot.length - 1, 1));
    })
    .join(" ");

// Masquer un numéro de téléphone : +225 07 ** ** ** 45
export const masquerTelephone = (telephone: string): string => {
  if (telephone.length <= 4) return "****";
  return `${telephone.slice(0, 4)}${"*".repeat(telephone.length - 6)}${telephone.slice(-2)}`;
};
