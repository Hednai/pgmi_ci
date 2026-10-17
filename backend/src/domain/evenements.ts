// ============================================
// domain/evenements.ts
// Catalogue des événements diffusés en temps réel.
//
// Un seul fichier décrit, pour chaque événement : son nom sur le fil, le
// public qui le reçoit, et la permission qu'un agent doit détenir pour y
// avoir droit. Aucun service n'écrit un nom d'événement en clair et aucune
// route ne décide elle-même qui a le droit d'écouter quoi.
// ============================================
import { PERMISSION } from "./permissions.js";
import type { Permission } from "./permissions.js";

// Publics d'un événement.
//   MARIN_CONCERNE : le seul marin dont le dossier est touché ;
//   AGENTS         : les agents détenant la permission déclarée ;
//   LES_DEUX       : les deux à la fois.
export const AUDIENCE = {
  MARIN_CONCERNE: "MARIN_CONCERNE",
  AGENTS: "AGENTS",
  LES_DEUX: "LES_DEUX",
} as const;

export type Audience = (typeof AUDIENCE)[keyof typeof AUDIENCE];

// Noms des événements, cités par les services et par le client.
// Format : objet.action, cohérent avec le format objet:action des
// permissions, sans jamais s'y substituer.
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

// Règle de diffusion d'un événement.
// permissionAgent absente : aucun agent ne reçoit l'événement, même
// authentifié. C'est le réglage le plus fermé, choisi par défaut à la
// conception de chaque nouvel événement.
export interface RegleDiffusion {
  audience: Audience;
  permissionAgent?: Permission;
}

// Table de diffusion. Elle se lit comme la matrice des habilitations :
// ajouter un événement oblige à déclarer qui le reçoit.
export const DIFFUSION: Record<Evenement, RegleDiffusion> = {
  [EVENEMENT.DEMANDE_CREEE]: {
    audience: AUDIENCE.AGENTS,
    permissionAgent: PERMISSION.DEMANDE_INSTRUIRE,
  },
  [EVENEMENT.DEMANDE_STATUT]: {
    audience: AUDIENCE.LES_DEUX,
    permissionAgent: PERMISSION.DEMANDE_INSTRUIRE,
  },
  [EVENEMENT.PAIEMENT_CONFIRME]: {
    audience: AUDIENCE.LES_DEUX,
    permissionAgent: PERMISSION.DEMANDE_INSTRUIRE,
  },
  [EVENEMENT.DOCUMENT_DEPOSE]: {
    audience: AUDIENCE.AGENTS,
    permissionAgent: PERMISSION.DOCUMENT_VERIFIER,
  },
  [EVENEMENT.DOCUMENT_DELIVRE]: {
    audience: AUDIENCE.LES_DEUX,
    permissionAgent: PERMISSION.DEMANDE_INSTRUIRE,
  },
  [EVENEMENT.DOCUMENT_STATUT]: {
    audience: AUDIENCE.LES_DEUX,
    permissionAgent: PERMISSION.DOCUMENT_VERIFIER,
  },
  [EVENEMENT.EMBARQUEMENT_SOUMIS]: {
    audience: AUDIENCE.AGENTS,
    permissionAgent: PERMISSION.EMBARQUEMENT_VERIFIER,
  },
  [EVENEMENT.EMBARQUEMENT_STATUT]: {
    audience: AUDIENCE.LES_DEUX,
    permissionAgent: PERMISSION.EMBARQUEMENT_VERIFIER,
  },
  // Une session ouverte doit apparaître chez tous les marins sans
  // rechargement : c'est le seul événement dont le public marin n'est pas
  // restreint à un dossier (marinId absent à la diffusion).
  [EVENEMENT.FORMATION_SESSION_OUVERTE]: {
    audience: AUDIENCE.LES_DEUX,
    permissionAgent: PERMISSION.FORMATION_PLANIFIER,
  },
  [EVENEMENT.FORMATION_SESSION_STATUT]: {
    audience: AUDIENCE.LES_DEUX,
    permissionAgent: PERMISSION.FORMATION_PLANIFIER,
  },
};

// Liste des noms d'événements, exposée au client pour qu'il s'abonne sans
// recopier la liste de son côté.
export const TOUS_LES_EVENEMENTS = Object.values(EVENEMENT) as Evenement[];