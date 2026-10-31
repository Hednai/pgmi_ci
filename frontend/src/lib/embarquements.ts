// ============================================
// lib/embarquements.ts
// Statuts d'un embarquement et règle de modification.
//
// Miroir de backend/src/domain/status.ts. Le serveur refuse toute
// modification d'un dossier transmis à la DGAM ; l'écran applique la même
// règle pour ne pas proposer un geste qui serait rejeté.
// ============================================

export const EMBARQUEMENT_STATUT = {
  DECLARED: "DECLARED",
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  SUBMITTED: "SUBMITTED",
  INFO_REQUESTED: "INFO_REQUESTED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;

// Le dossier reste modifiable tant qu'il n'est pas parti en instruction.
// Un rejet le rouvre, une demande de pièces complémentaires aussi, et un
// dossier dont les frais ne sont pas encore confirmés n'a rien quitté.
export const STATUTS_MODIFIABLES: string[] = [
  EMBARQUEMENT_STATUT.DECLARED,
  EMBARQUEMENT_STATUT.AWAITING_PAYMENT,
  EMBARQUEMENT_STATUT.INFO_REQUESTED,
  EMBARQUEMENT_STATUT.REJECTED,
];

export const dossierModifiable = (statut: string): boolean =>
  STATUTS_MODIFIABLES.includes(statut);

// Un mouvement déjà passé en instruction porte un paiement confirmé : le
// retour du marin après un rejet ou une demande de complément est gratuit
// (R23). Seul un dossier qui n'est jamais parti appelle un règlement.
export const reglementAttendu = (statut: string, montantDu: number): boolean =>
  montantDu > 0 &&
  (statut === EMBARQUEMENT_STATUT.DECLARED ||
    statut === EMBARQUEMENT_STATUT.AWAITING_PAYMENT);