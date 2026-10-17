// ============================================
// lib/evenements.ts
// Noms des événements temps réel, côté client.
//
// Miroir de backend/src/domain/evenements.ts. Les deux listes doivent rester
// identiques : c'est le seul endroit du frontend où ces chaînes
// apparaissent, aucun écran n'en écrit une à la main.
// ============================================

export const EVENEMENT = {
  DEMANDE_CREEE: "demande.creee",
  DEMANDE_STATUT: "demande.statut",
  PAIEMENT_CONFIRME: "paiement.confirme",
  DOCUMENT_DEPOSE: "document.depose",
  DOCUMENT_DELIVRE: "document.delivre",
  DOCUMENT_STATUT: "document.statut",
  EMBARQUEMENT_SOUMIS: "embarquement.soumis",
  EMBARQUEMENT_STATUT: "embarquement.statut",
  FORMATION_SESSION_OUVERTE: "formation.session.ouverte",
  FORMATION_SESSION_STATUT: "formation.session.statut",
} as const;

export type Evenement = (typeof EVENEMENT)[keyof typeof EVENEMENT];

// Groupes d'événements par écran. Un écran déclare le groupe qui le
// concerne au lieu d'énumérer des noms : ajouter un événement à un écran se
// fait ici, pas dans le composant.
export const EVENEMENTS_ECRAN = {
  DOCUMENTS_MARIN: [EVENEMENT.DOCUMENT_STATUT, EVENEMENT.DOCUMENT_DELIVRE],
  DEMANDES_MARIN: [
    EVENEMENT.DEMANDE_STATUT,
    EVENEMENT.PAIEMENT_CONFIRME,
    EVENEMENT.DOCUMENT_DELIVRE,
  ],
  SERVICE_MER_MARIN: [EVENEMENT.EMBARQUEMENT_STATUT],
  FORMATIONS_MARIN: [
    EVENEMENT.FORMATION_SESSION_OUVERTE,
    EVENEMENT.FORMATION_SESSION_STATUT,
  ],
  DEMANDES_AGENT: [
    EVENEMENT.DEMANDE_CREEE,
    EVENEMENT.DEMANDE_STATUT,
    EVENEMENT.PAIEMENT_CONFIRME,
  ],
  VERIFICATIONS_AGENT: [EVENEMENT.DOCUMENT_DEPOSE, EVENEMENT.EMBARQUEMENT_SOUMIS],
  ARSTM: [EVENEMENT.FORMATION_SESSION_OUVERTE, EVENEMENT.FORMATION_SESSION_STATUT],
  TABLEAU_BORD_AGENT: [
    EVENEMENT.DEMANDE_CREEE,
    EVENEMENT.DEMANDE_STATUT,
    EVENEMENT.DOCUMENT_DEPOSE,
    EVENEMENT.EMBARQUEMENT_SOUMIS,
  ],
} as const;