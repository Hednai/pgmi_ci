// ============================================
// hooks/useIdentifiantsDemo.ts
// Accès aux identifiants du jeu de démonstration.
//
// Le chargement est différé et conditionnel : hors mode démonstration, le
// fichier de données n'est jamais importé et ne pèse donc pas sur le premier
// affichage de l'application réelle.
// ============================================
import { useEffect, useState } from "react";
import { estModeDemo } from "../lib/apiClient.js";

export interface CompteAgentDemo {
  email: string;
  motDePasse: string;
  role: string;
}

export interface IdentifiantsDemo {
  codeOtp: string;
  comptesAgent: CompteAgentDemo[];
}

export function useIdentifiantsDemo(): IdentifiantsDemo | null {
  const [identifiants, setIdentifiants] = useState<IdentifiantsDemo | null>(null);

  useEffect(function chargerIdentifiants() {
    if (!estModeDemo()) return;

    let actif = true;

    void import("../mocks/serveurDemo.js")
      .then(function (module) {
        if (actif) setIdentifiants(module.IDENTIFIANTS_DEMO);
      })
      .catch(function (erreur) {
        // Le jeu de démonstration n'a pas pu être chargé. L'application reste
        // utilisable, seul le bandeau d'identifiants ne s'affichera pas.
        console.error("Chargement des identifiants de démonstration impossible", erreur);
      });

    return function nettoyer() {
      actif = false;
    };
  }, []);

  return identifiants;
}