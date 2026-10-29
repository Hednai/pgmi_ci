// ============================================
// hooks/useFluxTempsReel.ts
// Abonnement au flux temps réel du serveur.
//
// L'écran ne reçoit pas de données : il reçoit l'information qu'une donnée
// a changé, et rappelle l'API. C'est volontaire. Un écran qui recalculerait
// son état à partir du message dupliquerait les règles du serveur et
// finirait par diverger ; ici le serveur reste la seule source de vérité.
// ============================================
import { useEffect, useRef, useState } from "react";
import { api, ErreurApi, jetons } from "../lib/apiClient.js";

// Délai avant une nouvelle tentative d'ouverture quand le ticket a été
// refusé ou que le réseau est tombé, en millisecondes.
const DELAI_NOUVELLE_TENTATIVE_MS = 5000;

// Fenêtre de regroupement des rafraîchissements, en millisecondes. Une
// approbation de demande produit plusieurs événements en quelques
// millisecondes ; sans ce regroupement l'écran rappellerait l'API autant de
// fois.
const REGROUPEMENT_MS = 300;

interface TicketFlux {
  ticket: string;
  expireDans: number;
  evenements: string[];
}

interface OptionsFlux {
  // Événements qui déclenchent le rappel. Les autres sont ignorés.
  evenements: readonly string[];
  // Action exécutée quand l'un de ces événements arrive
  surEvenement: () => void;
  // Faux pour suspendre l'abonnement, par exemple tant que la session
  // n'est pas restaurée
  actif?: boolean;
}

const BASE = import.meta.env.VITE_API_URL ?? "";

export function useFluxTempsReel(options: OptionsFlux): { connecte: boolean } {
  const [connecte, setConnecte] = useState(false);

  // La fonction de rappel est tenue dans une référence : l'écran la
  // redéfinit à chaque rendu, le flux ne doit pas se rouvrir pour autant.
  const rappel = useRef(options.surEvenement);
  rappel.current = options.surEvenement;

  const evenements = options.evenements.join(",");
  const actif = options.actif ?? true;

  useEffect(
    function abonner() {
      if (!actif || !jetons.lireAcces()) {
        return;
      }

      let vivant = true;
      let source: EventSource | null = null;
      let attente: ReturnType<typeof setTimeout> | null = null;
      let regroupement: ReturnType<typeof setTimeout> | null = null;

      // Un seul rappel pour une rafale d'événements
      const programmerRappel = () => {
        if (regroupement) return;
        regroupement = setTimeout(function () {
          regroupement = null;
          rappel.current();
        }, REGROUPEMENT_MS);
      };

      const ouvrir = async () => {
        if (!vivant) return;

        try {
          // Le ticket est demandé sur une route authentifiée classique :
          // c'est le seul appel qui porte le jeton d'accès.
          const { ticket } = await api.post<TicketFlux>("/api/temps-reel/ticket");
          if (!vivant) return;

          source = new EventSource(
            `${BASE}/api/temps-reel/flux?ticket=${encodeURIComponent(ticket)}`,
          );

          source.onopen = function () {
            setConnecte(true);
          };

          for (const nom of evenements.split(",").filter(Boolean)) {
            source.addEventListener(nom, programmerRappel);
          }

          source.onerror = function () {
            setConnecte(false);
            // Le ticket est à usage unique : une reconnexion automatique du
            // navigateur réutiliserait un ticket déjà consommé et serait
            // refusée. Le flux est donc refermé et rouvert avec un ticket neuf.
            source?.close();
            source = null;
            if (vivant && !attente) {
              attente = setTimeout(function () {
                attente = null;
                void ouvrir();
              }, DELAI_NOUVELLE_TENTATIVE_MS);
            }
          };
        } catch (erreur) {
          // Serveur injoignable ou ticket refusé : l'écran reste utilisable,
          // il se rafraîchit simplement à la navigation.
          setConnecte(false);

          // Un 401 ou 403 signifie que le jeton d'accès est révoqué ou absent :
          // réessayer ne peut rien donner. On arrête la boucle pour ne pas
          // marteler le serveur après une déconnexion.
          const estRefus =
            erreur instanceof ErreurApi &&
            (erreur.statut === 401 || erreur.statut === 403);
          const jetonAbsent = !jetons.lireAcces();

          if (vivant && !attente && !estRefus && !jetonAbsent) {
            attente = setTimeout(function () {
              attente = null;
              void ouvrir();
            }, DELAI_NOUVELLE_TENTATIVE_MS);
          }
        }
      };

      void ouvrir();

      return function fermer() {
        vivant = false;
        if (attente) clearTimeout(attente);
        if (regroupement) clearTimeout(regroupement);
        source?.close();
        setConnecte(false);
      };
    },
    [evenements, actif],
  );

  return { connecte };
}