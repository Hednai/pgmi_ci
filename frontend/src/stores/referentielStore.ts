// ============================================
// stores/referentielStore.ts
// Référentiels chargés une fois par session.
//
// Fonctions, types de certificats et barèmes alimentent presque tous les
// formulaires : les recharger à chaque écran gaspillerait de la donnée
// mobile, ressource coûteuse pour un marin en Côte d'Ivoire.
// ============================================
import { create } from "zustand";
import { api } from "../lib/apiClient.js";
import type { Referentiels, TypeCertificat, Bareme } from "../types/api.js";

interface EtatReferentiel extends Partial<Referentiels> {
  charge: boolean;
  charger: () => Promise<void>;
  certificat: (id: string) => TypeCertificat | undefined;
  bareme: (certificateTypeId: string, requestType: string) => Bareme | undefined;
}

export const useReferentielStore = create<EtatReferentiel>((set, get) => ({
  fonctions: [],
  certificats: [],
  baremes: [],
  charge: false,

  charger: async () => {
    if (get().charge) return;
    const donnees = await api.get<Referentiels>("/api/referentiels", true);
    set({ ...donnees, charge: true });
  },

  certificat: (id) => get().certificats?.find((certificat) => certificat.id === id),

  // Absence de barème signifie gratuité, le service serveur applique la
  // même règle : les deux côtés restent cohérents.
  bareme: (certificateTypeId, requestType) =>
    get().baremes?.find(
      (bareme) =>
        bareme.certificateTypeId === certificateTypeId && bareme.requestType === requestType,
    ),
}));
