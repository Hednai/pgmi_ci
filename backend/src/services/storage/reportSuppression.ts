// ============================================
// services/storage/reportSuppression.ts
// Règle de report entre deux tentatives de suppression.
//
// Isolée de suppressionDifferee.ts, qui dépend de la base de données : cette
// règle décide si une panne de stockage d'une matinée épuise les tentatives
// en quelques minutes ou tient plusieurs heures. Elle doit donc être
// vérifiable sans base ni réseau, à chaque commit.
// ============================================
import { STOCKAGE } from "../../config/constants.js";

// Croissance géométrique bornée : un stockage en difficulté ne doit pas être
// martelé, et une panne longue ne doit pas consommer toutes les tentatives
// avant qu'un humain ait pu réagir.
export const calculerReportMs = (tentatives: number): number =>
  Math.min(
    STOCKAGE.SUPPRESSION_REPORT_BASE_MS * 2 ** tentatives,
    STOCKAGE.SUPPRESSION_REPORT_MAX_MS,
  );