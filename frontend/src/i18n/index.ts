// ============================================
// i18n/index.ts
// Point d'accès unique aux libellés.
//
// Une seule langue est livrée en V1, mais tous les écrans passent déjà par
// cette indirection : l'ajout de l'anglais se fera sans modifier un composant.
// ============================================
import { fr } from "./fr.js";
import type { Dictionnaire } from "./fr.js";

export type LangueDisponible = "fr";

const dictionnaires: Record<LangueDisponible, Dictionnaire> = { fr };

export const LANGUE_PAR_DEFAUT: LangueDisponible = "fr";

// Dictionnaire courant. Exporté comme t pour rester court à l'usage.
export const t = dictionnaires[LANGUE_PAR_DEFAUT];

// Traduire une valeur de statut sans risquer un affichage vide :
// un statut inconnu du dictionnaire est affiché tel quel plutôt que masqué.
export const libelle = (table: Record<string, string>, cle: string | null | undefined): string => {
  if (!cle) return "";
  return table[cle] ?? cle;
};
