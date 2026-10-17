// ============================================
// jobs/nettoyageStockage.job.ts
// Drainage de la file des suppressions de pièces.
//
// La base et le stockage objet ne partagent pas de transaction : ce travail
// est ce qui garantit qu'une pièce effacée dans l'application finit par
// l'être dans le bucket. Il tourne beaucoup plus souvent que le scan
// d'expiration, parce qu'une pièce d'identité résiduelle ne doit pas
// attendre vingt-quatre heures.
// ============================================
import { logger } from "../lib/logger.js";
import { traiterSuppressionsEnAttente } from "../services/storage/suppressionDifferee.js";

export const executerNettoyageStockage = async (): Promise<void> => {
  const bilan = await traiterSuppressionsEnAttente();

  // Journal uniquement quand il s'est passé quelque chose : un passage à
  // vide toutes les quinze minutes noierait les journaux.
  if (bilan.traitees + bilan.reportees + bilan.abandonnees > 0) {
    logger.info(bilan, "Nettoyage du stockage");
  }

  if (bilan.abandonnees > 0) {
    logger.error(
      { abandonnees: bilan.abandonnees },
      "Des pièces n'ont pas pu être supprimées du stockage, intervention manuelle requise",
    );
  }
};