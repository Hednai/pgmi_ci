// ============================================
// jobs/scheduler.ts
// Planificateur des travaux périodiques.
//
// Implémenté avec setInterval plutôt qu'avec une bibliothèque cron : deux
// travaux ne justifient pas une dépendance de plus. Le point de montage
// reste le même si un ordonnanceur externe est branché plus tard (Render
// Cron, GitHub Actions), il suffira d'appeler la route ou le script.
//
// Les travaux sont déclarés dans une table plutôt qu'appelés en dur : en
// ajouter un consiste à ajouter une ligne, pas à toucher au mécanisme. Un
// échec reste confiné à son travail et n'interrompt pas les autres.
// ============================================
import { logger } from "../lib/logger.js";
import { PLANIFICATEUR } from "../config/constants.js";
import { executerScanExpiration } from "./expiryScan.job.js";
import { executerNettoyageStockage } from "./nettoyageStockage.job.js";

interface TravailPeriodique {
  nom: string;
  intervalleMs: number;
  // La valeur de retour est ignorée par le planificateur : chaque travail
  // journalise lui-même son compte rendu.
  executer: () => Promise<unknown>;
}

const TRAVAUX: readonly TravailPeriodique[] = [
  {
    nom: "scan-expiration",
    intervalleMs: PLANIFICATEUR.SCAN_EXPIRATION_MS,
    executer: executerScanExpiration,
  },
  {
    nom: "nettoyage-stockage",
    intervalleMs: PLANIFICATEUR.NETTOYAGE_STOCKAGE_MS,
    executer: executerNettoyageStockage,
  },
];

const minuteries: NodeJS.Timeout[] = [];

// Un travail qui lève ne doit ni interrompre le planificateur, ni laisser
// une promesse rejetée non gérée remonter jusqu'au processus.
const executerEnSecurite = async (travail: TravailPeriodique): Promise<void> => {
  try {
    await travail.executer();
  } catch (err) {
    logger.error({ err, travail: travail.nom }, "Échec d'un travail périodique");
  }
};

export const demarrerPlanificateur = (): void => {
  if (minuteries.length > 0) return;

  for (const travail of TRAVAUX) {
    // Délai initial : laisse le serveur finir son démarrage avant de
    // lancer des requêtes de fond.
    const depart = setTimeout(() => {
      void executerEnSecurite(travail);

      const intervalle = setInterval(
        () => void executerEnSecurite(travail),
        travail.intervalleMs,
      );
      // Ne pas retenir le processus Node en vie pour ce seul intervalle
      intervalle.unref?.();
      minuteries.push(intervalle);
    }, PLANIFICATEUR.DELAI_INITIAL_MS);

    depart.unref?.();
    minuteries.push(depart);
  }

  logger.info(
    { travaux: TRAVAUX.map((travail) => travail.nom) },
    "Planificateur démarré",
  );
};

export const arreterPlanificateur = (): void => {
  for (const minuterie of minuteries) {
    clearInterval(minuterie);
    clearTimeout(minuterie);
  }
  minuteries.length = 0;
};