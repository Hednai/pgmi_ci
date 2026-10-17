// ============================================
// hooks/useHabilitation.ts
// Lecture des habilitations de l'agent connecté.
//
// La liste vient du serveur : le client ne connaît pas la matrice et ne peut
// donc pas diverger d'elle. Masquer une entrée de menu est un confort
// d'affichage, le contrôle réel reste posé sur la route serveur.
// ============================================
import { useAuthStore } from "../stores/authStore.js";

export function useHabilitation() {
  const agent = useAuthStore(function (etat) {
    return etat.agent;
  });

  const permissions = agent?.permissions ?? [];

  return {
    // Vrai si l'agent porte la permission demandée
    peut: (permission: string): boolean => permissions.includes(permission),
    // Vrai si l'agent porte au moins une des permissions demandées
    peutAuMoins: (candidates: string[]): boolean =>
      candidates.some(function (permission) {
        return permissions.includes(permission);
      }),
  };
}