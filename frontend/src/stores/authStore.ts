// ============================================
// stores/authStore.ts
// État d'authentification, partagé par toute l'application.
//
// Un seul magasin pour les deux publics : le champ type distingue un marin
// d'un agent, et les gardes de route s'appuient dessus.
// ============================================
import { create } from "zustand";
import { api, jetons } from "../lib/apiClient.js";
import type { Marin, Agent } from "../types/api.js";

interface EtatAuth {
  type: "MARIN" | "AGENT" | null;
  marin: Marin | null;
  agent: Agent | null;
  // Vrai tant que la session n'a pas été restaurée au démarrage
  initialisation: boolean;

  connecterMarin: (marin: Marin, acces: string, rafraichissement: string) => void;
  connecterAgent: (agent: Agent, acces: string, rafraichissement: string) => void;
  majMarin: (marin: Marin) => void;
  deconnecter: () => void;
  restaurerSession: () => Promise<void>;
}

export const useAuthStore = create<EtatAuth>((set) => ({
  type: null,
  marin: null,
  agent: null,
  initialisation: true,

  connecterMarin: (marin, acces, rafraichissement) => {
    jetons.enregistrer(acces, rafraichissement);
    set({ type: "MARIN", marin, agent: null, initialisation: false });
  },

  connecterAgent: (agent, acces, rafraichissement) => {
    jetons.enregistrer(acces, rafraichissement);
    set({ type: "AGENT", agent, marin: null, initialisation: false });
  },

  majMarin: (marin) => set({ marin }),

  deconnecter: () => {
    jetons.effacer();
    set({ type: null, marin: null, agent: null, initialisation: false });
  },

  // Au rechargement de la page, le jeton survit mais pas l'état React.
  // La session est reconstruite en interrogeant l'API : le profil marin
  // d'abord, le profil agent ensuite.
  restaurerSession: async () => {
    if (!jetons.lireAcces() && !jetons.lireRafraichissement()) {
      set({ initialisation: false });
      return;
    }

    try {
      const marin = await api.get<Marin>("/api/marins/me");
      set({ type: "MARIN", marin, agent: null, initialisation: false });
      return;
    } catch {
      // Ce n'est pas un marin : l'essai suivant tranche
    }

    try {
      const acteur = await api.get<{ id: string; label: string; role: string }>("/api/auth/me");
      set({
        type: "AGENT",
        agent: {
          id: acteur.id,
          email: "",
          firstName: acteur.label.split(" ")[0] ?? "",
          lastName: acteur.label.split(" ").slice(1).join(" "),
          role: acteur.role,
          roleLabel: acteur.role,
          authority: { id: "", code: "", name: "", level: "" },
        },
        marin: null,
        initialisation: false,
      });
    } catch {
      jetons.effacer();
      set({ type: null, marin: null, agent: null, initialisation: false });
    }
  },
}));
