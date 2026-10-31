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
import type { CorpsBareme } from "../lib/baremes.js";
import type { Referentiels, TypeCertificat, Bareme } from "../types/api.js";

interface EtatReferentiel extends Partial<Referentiels> {
  charge: boolean;
  charger: () => Promise<void>;
  certificat: (id: string) => TypeCertificat | undefined;
  bareme: (certificateTypeId: string, requestType: string) => Bareme | undefined;
  enregistrerBareme: (corps: CorpsBareme) => Promise<void>;
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

  // Création ou modification d'un tarif. L'appel réseau appartient au
  // magasin : l'écran ne connaît ni la route ni la forme de la réponse.
  //
  // La ligne renvoyée par le serveur remplace la précédente, ou complète la
  // liste s'il s'agit d'une création. Aucun rechargement complet n'est
  // déclenché : la lecture des référentiels est mise en cache cinq minutes
  // par le navigateur et servirait encore l'ancien montant.
  enregistrerBareme: async (corps) => {
    const enregistre = await api.post<Bareme>("/api/referentiels/baremes", corps);
    const baremes = get().baremes ?? [];
    const connue = baremes.some((bareme) => bareme.id === enregistre.id);

    set({
      baremes: connue
        ? baremes.map((bareme) => (bareme.id === enregistre.id ? enregistre : bareme))
        : baremes.concat(enregistre),
    });
  },
}));