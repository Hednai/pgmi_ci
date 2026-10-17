// ============================================
// domain/permissions.ts
// Matrice des habilitations fines (remarque de recette PGMI-01).
//
// Un rôle dit qui est l'agent, une permission dit ce qu'il a le droit de
// faire. Les routes déclarent une permission, jamais une liste de rôles :
// rattacher une tâche à un rôle se fait ici, dans un seul fichier.
//
// Ce fichier se lit de haut en bas comme le manuel des habilitations
// demandé par la remarque PGMI-05.
// ============================================
import { AGENT_ROLE } from "./roles.js";
import type { AgentRole } from "./roles.js";

// Chaque permission nomme une tâche métier dans le vocabulaire du cahier
// des charges. Format : objet:action.
export const PERMISSION = {
  MARIN_CONSULTER: "marin:consulter",
  MARIN_RECHERCHER: "marin:rechercher",
  MARIN_ACTIVER: "marin:activer",
  MARIN_SUSPENDRE: "marin:suspendre",
  ELEVE_INSCRIRE: "eleve:inscrire",
  DEMANDE_INSTRUIRE: "demande:instruire",
  DEMANDE_DECIDER: "demande:decider",
  DOCUMENT_VERIFIER: "document:verifier",
  EMBARQUEMENT_VERIFIER: "embarquement:verifier",
  FORMATION_PLANIFIER: "formation:planifier",
  FORMATION_EMARGER: "formation:emarger",
  REFERENTIEL_GERER: "referentiel:gerer",
  AGENT_GERER: "agent:gerer",
  AUDIT_CONSULTER: "audit:consulter",
  TABLEAU_BORD_NATIONAL: "tableau-bord:national",
} as const;

export type Permission = (typeof PERMISSION)[keyof typeof PERMISSION];

export const ALL_PERMISSIONS = Object.values(PERMISSION) as Permission[];

// Périmètre de visibilité des données attaché à un rôle.
//   NATIONAL : l'ensemble du registre des gens de mer ;
//   AUTORITE : les seuls dossiers rattachés à l'autorité de l'agent.
export const PORTEE = {
  NATIONAL: "NATIONAL",
  AUTORITE: "AUTORITE",
} as const;

export type Portee = (typeof PORTEE)[keyof typeof PORTEE];

// Matrice rôle vers permissions.
export const PERMISSIONS_PAR_ROLE: Record<AgentRole, readonly Permission[]> = {
  // Guichet DGAM : instruit et décide, ne touche ni aux référentiels ni aux comptes
  [AGENT_ROLE.DGAM_AGENT]: [
    PERMISSION.MARIN_CONSULTER,
    PERMISSION.MARIN_RECHERCHER,
    PERMISSION.MARIN_ACTIVER,
    PERMISSION.DEMANDE_INSTRUIRE,
    PERMISSION.DEMANDE_DECIDER,
    PERMISSION.DOCUMENT_VERIFIER,
    PERMISSION.EMBARQUEMENT_VERIFIER,
  ],

  // Supervision DGAM : tout le guichet, plus la suspension et le journal
  [AGENT_ROLE.DGAM_SUPERVISOR]: [
    PERMISSION.MARIN_CONSULTER,
    PERMISSION.MARIN_RECHERCHER,
    PERMISSION.MARIN_ACTIVER,
    PERMISSION.MARIN_SUSPENDRE,
    PERMISSION.DEMANDE_INSTRUIRE,
    PERMISSION.DEMANDE_DECIDER,
    PERMISSION.DOCUMENT_VERIFIER,
    PERMISSION.EMBARQUEMENT_VERIFIER,
    PERMISSION.AUDIT_CONSULTER,
    PERMISSION.TABLEAU_BORD_NATIONAL,
  ],

  // Administrateur plateforme : exploitation et comptes, sans pouvoir
  // d'instruction. Il n'approuve aucune demande : séparation des pouvoirs.
  [AGENT_ROLE.PLATFORM_ADMIN]: [
    PERMISSION.MARIN_CONSULTER,
    PERMISSION.MARIN_RECHERCHER,
    PERMISSION.MARIN_SUSPENDRE,
    PERMISSION.AGENT_GERER,
    PERMISSION.REFERENTIEL_GERER,
    PERMISSION.AUDIT_CONSULTER,
    PERMISSION.TABLEAU_BORD_NATIONAL,
  ],

  // Administrateur métier : référentiels uniquement, types de certificats,
  // fonctions, barèmes. Aucun accès nominatif au registre.
  [AGENT_ROLE.BUSINESS_ADMIN]: [PERMISSION.REFERENTIEL_GERER],

  // ARSTM formation : sessions de recyclage et émargement, rien d'autre
  [AGENT_ROLE.ARSTM_TRAINING]: [
    PERMISSION.FORMATION_PLANIFIER,
    PERMISSION.FORMATION_EMARGER,
  ],

  // ARSTM scolarité : inscription des élèves navigants (R19)
  [AGENT_ROLE.ARSTM_REGISTRAR]: [
    PERMISSION.ELEVE_INSCRIRE,
    PERMISSION.MARIN_CONSULTER,
  ],

  // Responsable ARSTM : cumul des deux rôles ARSTM, sans vue nationale
  [AGENT_ROLE.ARSTM_MANAGER]: [
    PERMISSION.FORMATION_PLANIFIER,
    PERMISSION.FORMATION_EMARGER,
    PERMISSION.ELEVE_INSCRIRE,
    PERMISSION.MARIN_CONSULTER,
  ],
};

// Portée des données par rôle. Seule la DGAM a la vue nationale ; l'ARSTM
// est bornée à sa propre autorité (dossier de présentation ARSTM, 3.1).
export const PORTEE_PAR_ROLE: Record<AgentRole, Portee> = {
  [AGENT_ROLE.DGAM_AGENT]: PORTEE.NATIONAL,
  [AGENT_ROLE.DGAM_SUPERVISOR]: PORTEE.NATIONAL,
  [AGENT_ROLE.PLATFORM_ADMIN]: PORTEE.NATIONAL,
  [AGENT_ROLE.BUSINESS_ADMIN]: PORTEE.AUTORITE,
  [AGENT_ROLE.ARSTM_TRAINING]: PORTEE.AUTORITE,
  [AGENT_ROLE.ARSTM_REGISTRAR]: PORTEE.AUTORITE,
  [AGENT_ROLE.ARSTM_MANAGER]: PORTEE.AUTORITE,
};

// Permissions d'un rôle. Un rôle inconnu ne reçoit rien : une donnée de base
// corrompue ne doit jamais ouvrir de droits.
export const permissionsDuRole = (role: string | null | undefined): Permission[] => {
  if (!role) return [];
  return [...(PERMISSIONS_PAR_ROLE[role as AgentRole] ?? [])];
};

export const aPermission = (
  role: string | null | undefined,
  permission: Permission,
): boolean => permissionsDuRole(role).includes(permission);

// Portée d'un rôle. Un rôle inconnu retombe sur AUTORITE, jamais sur NATIONAL.
export const porteeDuRole = (role: string | null | undefined): Portee =>
  PORTEE_PAR_ROLE[role as AgentRole] ?? PORTEE.AUTORITE;

// Filtre Prisma de portée. Un rôle national ne restreint rien, tout autre
// rôle est borné à son autorité de rattachement.
export const filtrePortee = (
  role: string | null | undefined,
  authorityId: string,
): { authorityId?: string } =>
  porteeDuRole(role) === PORTEE.NATIONAL ? {} : { authorityId };