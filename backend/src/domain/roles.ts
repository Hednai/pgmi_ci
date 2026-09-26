// ============================================
// domain/roles.ts
// Rôles et niveaux d'autorité. Le RBAC s'appuie uniquement sur ce fichier :
// ajouter un rôle ne demande de toucher à aucune route.
// ============================================

// Niveau d'une autorité dans la hiérarchie
export const AUTHORITY_LEVEL = {
  NATIONAL: "NATIONAL", // DGAM
  REGIONAL_OFFICE: "REGIONAL_OFFICE", // antenne régionale
  TRAINING_INSTITUTION: "TRAINING_INSTITUTION", // ARSTM
} as const;
export type AuthorityLevel =
  (typeof AUTHORITY_LEVEL)[keyof typeof AUTHORITY_LEVEL];

// Rôles agents. Les rôles ARSTM sont rattachés à une autorité de niveau
// TRAINING_INSTITUTION : ils n'ont jamais de vue nationale.
export const AGENT_ROLE = {
  DGAM_AGENT: "DGAM_AGENT",
  DGAM_SUPERVISOR: "DGAM_SUPERVISOR",
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
  BUSINESS_ADMIN: "BUSINESS_ADMIN",
  ARSTM_TRAINING: "ARSTM_TRAINING",
  ARSTM_REGISTRAR: "ARSTM_REGISTRAR",
  ARSTM_MANAGER: "ARSTM_MANAGER",
} as const;
export type AgentRole = (typeof AGENT_ROLE)[keyof typeof AGENT_ROLE];

export const ALL_AGENT_ROLES = Object.values(AGENT_ROLE) as AgentRole[];

// Rôles habilités à instruire et décider sur une demande.
// L'ARSTM en est volontairement absente (R21).
export const DGAM_DECISION_ROLES: AgentRole[] = [
  AGENT_ROLE.DGAM_AGENT,
  AGENT_ROLE.DGAM_SUPERVISOR,
];

// Rôles ayant la vue nationale et les rapports
export const DGAM_SUPERVISION_ROLES: AgentRole[] = [
  AGENT_ROLE.DGAM_SUPERVISOR,
  AGENT_ROLE.PLATFORM_ADMIN,
];

// Rôles ARSTM, tous périmètres confondus
export const ARSTM_ROLES: AgentRole[] = [
  AGENT_ROLE.ARSTM_TRAINING,
  AGENT_ROLE.ARSTM_REGISTRAR,
  AGENT_ROLE.ARSTM_MANAGER,
];

// Rôles ARSTM autorisés à planifier une session de formation
export const ARSTM_TRAINING_ROLES: AgentRole[] = [
  AGENT_ROLE.ARSTM_TRAINING,
  AGENT_ROLE.ARSTM_MANAGER,
];

// Rôles ARSTM autorisés à inscrire un élève navigant et à ouvrir une
// demande de livret maritime en son nom (modules C et D)
export const ARSTM_REGISTRAR_ROLES: AgentRole[] = [
  AGENT_ROLE.ARSTM_REGISTRAR,
  AGENT_ROLE.ARSTM_MANAGER,
];

// Rôles administrant les référentiels
export const REFERENTIAL_ADMIN_ROLES: AgentRole[] = [
  AGENT_ROLE.BUSINESS_ADMIN,
  AGENT_ROLE.PLATFORM_ADMIN,
];

// Libellé affichable d'un rôle, utilisé par les journaux et le frontend
export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  DGAM_AGENT: "Agent DGAM",
  DGAM_SUPERVISOR: "Superviseur DGAM",
  PLATFORM_ADMIN: "Administrateur plateforme",
  BUSINESS_ADMIN: "Administrateur métier",
  ARSTM_TRAINING: "ARSTM, Formation",
  ARSTM_REGISTRAR: "ARSTM, Scolarité",
  ARSTM_MANAGER: "ARSTM, Responsable",
};

// Vérifie qu'une chaîne quelconque correspond à un rôle connu
export const isAgentRole = (value: string): value is AgentRole =>
  ALL_AGENT_ROLES.includes(value as AgentRole);
