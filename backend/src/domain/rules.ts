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

// ---- Gardes de règle, utilisables sans base de données ----

// Paramètres lus par la garde R8. Le type est exporté : les tests et les
// services parlent du même contrat, aucun n'en redéclare une copie.
export interface ContexteInstruction {
  // Montant des frais dus, tel qu'enregistré sur la demande
  feeAmount: number;
  // Vrai si au moins un paiement de la demande porte le statut réglé
  paiementConfirme: boolean;
}

// R8, « Un paiement doit être confirmé avant instruction ».
// La règle vit ici et non dans le service : elle est ainsi testable seule,
// et un seul endroit décide pour toutes les étapes du workflow.
// Un montant nul ou négatif vaut exonération : l'absence de frais ne doit
// jamais bloquer un dossier.
export const instructionAutorisee = (contexte: ContexteInstruction): boolean => {
  // Montant non exploitable (NaN, Infinity) : la règle refuse. Une donnée
  // corrompue ne doit jamais ouvrir un droit, elle doit faire remonter le
  // dossier à un humain.
  if (!Number.isFinite(contexte.feeAmount)) {
    return false;
  }

  // Montant nul ou négatif : démarche exonérée, aucun paiement attendu.
  if (contexte.feeAmount <= 0) {
    return true;
  }

  return contexte.paiementConfirme;
};

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

// Longueur minimale d'un mot de passe, marin comme agent (ENF-002).
// Déclarée ici et nulle part ailleurs : les schémas Zod des deux parcours
// la lisent, aucun n'écrit son propre nombre.
export const MOT_DE_PASSE_LONGUEUR_MIN = 8;

// Longueur maximale acceptée à la saisie. Une phrase de passe reste possible,
// au-delà le coût de hachage ne protège plus personne.
export const MOT_DE_PASSE_LONGUEUR_MAX = 128;

// Durée de validité d'un code à usage unique
export const OTP_TTL_MINUTES = 10;

// Nombre d'essais avant invalidation d'un code OTP
export const OTP_MAX_ATTEMPTS = 5;

// Longueur du code OTP envoyé par SMS
export const OTP_LENGTH = 6;

// Durées de vie des jetons de session (ENF-002)
export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "7d";

// Limites de taille des requêtes (ENF-015).
// Le plafond général vit dans config/constants.ts, couche HTTP ; seules les
// limites qui découlent d'une règle métier sont déclarées ici.
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

// Nombre maximum de pièces jointes par demande
export const MAX_ATTACHMENTS_PER_REQUEST = 6;

// Plafond JSON pour les routes transportant un fichier base64 (ENF-015)
export const MAX_JSON_BODY_UPLOAD = `${Math.ceil(MAX_UPLOAD_BYTES * 1.37)}b`;

// Plafond JSON pour les routes de demande avec pièces jointes multiples
export const MAX_JSON_BODY_DEMANDE = `${Math.ceil(MAX_UPLOAD_BYTES * 1.37 * MAX_ATTACHMENTS_PER_REQUEST)}b`;