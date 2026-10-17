// ============================================
// lib/contraintesDepot.ts
// Contraintes de dépôt de fichier, telles que le serveur les applique.
//
// Le marin apprenait la limite de taille au moment du rejet, après avoir
// attendu l'envoi d'un fichier sur une connexion mobile. Les contraintes
// sont donc lues auprès du serveur et affichées avant tout dépôt.
//
// Le serveur reste la seule autorité : ce module ne fait qu'informer, il ne
// valide rien. Un contrôle côté client qui se croirait décisif serait une
// deuxième source de vérité, donc une divergence en puissance.
// ============================================
import { api } from "./apiClient.js";

export interface ContraintesDepot {
  // Types MIME acceptés, pour l'attribut accept du sélecteur de fichier
  typesAcceptes: string[];
  // Libellé lisible des formats, par exemple « JPG, PNG, WEBP, PDF »
  formats: string;
  tailleMaxOctets: number;
}

// Mémorisées après le premier appel : elles ne changent pas en cours de
// session, et plusieurs écrans peuvent les demander.
let enCours: Promise<ContraintesDepot> | null = null;

export const obtenirContraintesDepot = (): Promise<ContraintesDepot> => {
  if (!enCours) {
    enCours = api.get<ContraintesDepot>("/api/referentiels/contraintes-depot");
  }
  return enCours;
};

// Taille lisible par un humain, en mégaoctets arrondis au dixième.
export const tailleLisible = (octets: number): string =>
  `${Math.round((octets / 1024 / 1024) * 10) / 10} Mo`;