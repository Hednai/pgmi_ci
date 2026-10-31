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
  SUBMITTED: "SUBMITTED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;

// Le dossier reste modifiable tant qu'il n'est pas parti en instruction.
// Un rejet le rouvre : le marin doit pouvoir corriger les pièces en cause.
export const dossierModifiable = (statut: string): boolean =>
  statut === EMBARQUEMENT_STATUT.DECLARED || statut === EMBARQUEMENT_STATUT.REJECTED;