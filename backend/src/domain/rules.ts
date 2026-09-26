// ============================================
// domain/rules.ts
// Invariants métier (R1 à R21) et paramètres qui en découlent.
// Un seul endroit à relire pour auditer les règles du système.
// ============================================

// Identifiants des règles, cités dans les messages d'erreur et l'audit log
export const RULES = {
  R1: "Un marin n'est ACTIVE qu'après vérification d'identité en personne",
  R2: "Un document approuvé est immuable",
  R3: "Un matricule est unique et définitif",
  R4: "Seuls les jours d'embarquement vérifiés comptent",
  R5: "L'audit log est immuable",
  R6: "Un agent ne peut pas approuver une demande qu'il a soumise",
  R7: "Un document expiré ne peut pas servir de base à une vérification valide",
  R8: "Un paiement doit être confirmé avant instruction",
  R9: "Un rejet exige un motif",
  R10: "Un QR code ne révèle jamais le nom complet du marin",
  R11: "Une demande est rattachée à un seul marin",
  R12: "Le renouvellement remplace, il ne supprime pas",
  R13: "Le moteur de conformité informe, il ne décide pas",
  R14: "Toute action sensible est tracée",
  R15: "Une session ARSTM ne démarre pas sous le seuil de quorum",
  R16: "Un marin entre en fenêtre de rappel à 365 jours de l'expiration",
  R17: "Les alertes SMS de dernière année ne sont pas désactivables",
  R18: "Une réussite de formation ARSTM prépare une demande pré-remplie",
  R19: "Une inscription ARSTM vaut vérification d'identité en personne",
  R20: "L'attribution du matricule reste soumise à validation DGAM",
  R21: "L'ARSTM soumet une demande mais ne l'approuve jamais",
} as const;
export type RuleId = keyof typeof RULES;

// ---- Paramètres dérivés des règles ----

// Quorum par défaut d'une session de formation (R15).
// Valeur par défaut seulement : chaque session porte son propre minQuorum,
// réglable par l'ARSTM.
export const DEFAULT_SESSION_QUORUM = 5;

// Fenêtre d'entrée en rappel avant expiration, en jours (R16)
export const EXPIRY_WARNING_WINDOW_DAYS = 365;

// Paliers de relance avant expiration, du plus lointain au plus proche.
// forceSms = true : le palier ignore les préférences du marin (R17).
export interface ExpiryReminderStep {
  daysBefore: number;
  forceSms: boolean;
  whatsapp: boolean;
  email: boolean;
  // Alerte en plus l'agent DGAM régional
  alertDgam: boolean;
  severity: "INFO" | "STANDARD" | "MODERATE" | "HIGH" | "CRITICAL";
}

export const EXPIRY_REMINDER_STEPS: ExpiryReminderStep[] = [
  { daysBefore: 365, forceSms: true, whatsapp: true, email: true, alertDgam: false, severity: "INFO" },
  { daysBefore: 270, forceSms: false, whatsapp: true, email: true, alertDgam: false, severity: "STANDARD" },
  { daysBefore: 180, forceSms: true, whatsapp: true, email: true, alertDgam: false, severity: "MODERATE" },
  { daysBefore: 90, forceSms: true, whatsapp: true, email: true, alertDgam: false, severity: "HIGH" },
  { daysBefore: 30, forceSms: true, whatsapp: true, email: true, alertDgam: true, severity: "CRITICAL" },
];

// Tolérance du scan quotidien : un palier est déclenché si l'écart au jour
// théorique est inférieur à cette valeur. Évite de rater un palier si le
// travail planifié n'a pas tourné un jour donné.
export const REMINDER_TOLERANCE_DAYS = 2;

// Durée de validité d'un code OTP
export const OTP_TTL_MINUTES = 10;

// Nombre d'essais avant invalidation d'un code OTP
export const OTP_MAX_ATTEMPTS = 5;

// Longueur du code OTP envoyé par SMS
export const OTP_LENGTH = 6;

// Durées de vie des jetons de session (ENF-002)
export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "7d";

// Limites de taille des requêtes (ENF-015)
export const MAX_JSON_BODY = "10kb";
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

// Taille d'un morceau d'upload, alignée sur le client (ENF-009)
export const UPLOAD_CHUNK_BYTES = 256 * 1024;
