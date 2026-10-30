// ============================================
// lib/demandes.ts
// Actions ouvertes à un agent sur une demande, selon son état.
//
// Miroir de REQUEST_TRANSITIONS de backend/src/domain/status.ts, sur le
// même principe que lib/evenements.ts. Les trois listes de statuts qui
// vivaient dans l'écran avaient divergé de la matrice : un dossier en
// attente de pièces complémentaires n'ouvrait plus aucun bouton, alors que
// le serveur accepte d'en reprendre l'instruction ou de le rejeter.
//
// Le serveur reste seul juge : ce fichier ne sert qu'à ne pas proposer un
// geste qui serait refusé, et à ne pas cacher un geste qui serait accepté.
// ============================================
import type { Demande } from "../types/api.js";

// Statuts d'une demande, recopiés du domaine serveur.
export const REQUEST_STATUS = {
  SUBMITTED: "SUBMITTED",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  ASSIGNED: "ASSIGNED",
  IN_REVIEW: "IN_REVIEW",
  INFO_REQUESTED: "INFO_REQUESTED",
  APPROVED: "APPROVED",
  DOCUMENT_AVAILABLE: "DOCUMENT_AVAILABLE",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

// Matrice des transitions autorisées, recopiée du domaine serveur.
export const TRANSITIONS_DEMANDE: Record<string, string[]> = {
  SUBMITTED: ["AWAITING_PAYMENT", "ASSIGNED", "CANCELLED"],
  AWAITING_PAYMENT: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_REVIEW", "INFO_REQUESTED", "REJECTED"],
  IN_REVIEW: ["INFO_REQUESTED", "APPROVED", "REJECTED"],
  INFO_REQUESTED: ["IN_REVIEW", "REJECTED", "CANCELLED"],
  APPROVED: ["DOCUMENT_AVAILABLE"],
  DOCUMENT_AVAILABLE: [],
  REJECTED: [],
  CANCELLED: [],
};

// Statuts depuis lesquels le serveur accepte d'entrer ou de revenir en
// instruction. SUBMITTED et AWAITING_PAYMENT passent d'abord par ASSIGNED,
// le serveur parcourt l'étape manquante lui-même.
const STATUTS_VERS_INSTRUCTION: string[] = [
  REQUEST_STATUS.SUBMITTED,
  REQUEST_STATUS.AWAITING_PAYMENT,
  REQUEST_STATUS.ASSIGNED,
  REQUEST_STATUS.INFO_REQUESTED,
];

// Statuts depuis lesquels une décision finale est proposée. Le dossier a
// été ouvert par un agent, les pièces ont pu être examinées.
const STATUTS_DECISION: string[] = [
  REQUEST_STATUS.ASSIGNED,
  REQUEST_STATUS.IN_REVIEW,
  REQUEST_STATUS.INFO_REQUESTED,
];

export interface ActionsAgent {
  // Prendre en charge le dossier, ou reprendre son examen
  instruire: boolean;
  // Demander des pièces complémentaires au marin
  demanderComplement: boolean;
  // Rejeter le dossier, motif obligatoire
  rejeter: boolean;
  // Approuver et délivrer le document
  approuver: boolean;
  // Encaisser les frais au guichet
  encaisser: boolean;
  // Aucun geste possible : le dossier est définitivement traité
  clos: boolean;
}

// Les frais dus bloquent l'instruction et la décision (R8). Une demande
// gratuite n'est jamais bloquée.
export const fraisRegles = (demande: Demande): boolean =>
  demande.feeAmount <= 0 ||
  demande.payments.some((paiement) => paiement.status === "PAID");

const peutAller = (statut: string, cible: string): boolean =>
  (TRANSITIONS_DEMANDE[statut] ?? []).includes(cible);

export const actionsAgent = (demande: Demande): ActionsAgent => {
  const statut = demande.status;
  const regle = fraisRegles(demande);
  const cibles = TRANSITIONS_DEMANDE[statut] ?? [];

  // Un dossier dont aucune transition ne dépend encore d'un agent est clos.
  // APPROVED n'ouvre que sur DOCUMENT_AVAILABLE, produit par la plateforme.
  const clos =
    cibles.length === 0 || statut === REQUEST_STATUS.APPROVED;

  return {
    instruire: !clos && regle && STATUTS_VERS_INSTRUCTION.includes(statut),
    demanderComplement:
      !clos && regle && peutAller(statut, REQUEST_STATUS.INFO_REQUESTED),
    rejeter: !clos && peutAller(statut, REQUEST_STATUS.REJECTED),
    // L'approbation reste réservée aux dossiers déjà pris en charge. Le
    // serveur l'accepterait dès SUBMITTED, en parcourant les étapes
    // manquantes, mais délivrer un document officiel sans avoir ouvert le
    // dossier n'est pas un geste que l'écran doit proposer.
    approuver: !clos && regle && STATUTS_DECISION.includes(statut),
    encaisser: !clos && !regle,
    clos,
  };
};