// ============================================
// jobs/scheduler.ts
// Planificateur des travaux périodiques.
//
// Implémenté avec setInterval plutôt qu'avec une bibliothèque cron : un seul
// travail quotidien ne justifie pas une dépendance de plus. Le point de
// montage reste le même si un ordonnanceur externe est branché plus tard
// (Render Cron, GitHub Actions), il suffira d'appeler la route ou le script.
// ============================================
import { logger } from "../lib/logger.js";
import { executerScanExpiration } from "./expiryScan.job.js";

const INTERVALLE_QUOTIDIEN_MS = 24 * 60 * 60 * 1000;
// Délai avant la première exécution : laisse le serveur finir son démarrage
const DELAI_INITIAL_MS = 30 * 1000;

let minuterie: NodeJS.Timeout | null = null;

const executerEnSecurite = async () => {
  try {
    await executerScanExpiration();
  } catch (err) {
    logger.error({ err }, "Échec du scan d'expiration");
  }
};

export const demarrerPlanificateur = () => {
  if (minuterie) return;

  setTimeout(() => {
    void executerEnSecurite();
    minuterie = setInterval(() => void executerEnSecurite(), INTERVALLE_QUOTIDIEN_MS);
    // Ne pas retenir le processus Node en vie pour ce seul intervalle
    minuterie.unref?.();
  }, DELAI_INITIAL_MS);

  logger.info("Planificateur démarré : scan d'expiration quotidien");
};

export const arreterPlanificateur = () => {
  if (minuterie) {
    clearInterval(minuterie);
    minuterie = null;
  }
};
