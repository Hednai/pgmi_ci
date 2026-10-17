// ============================================
// domain/status.ts
// Source unique de vérité des statuts métier.
//
// Le schéma Prisma stocke des chaînes pour rester portable et administrable.
// Ce fichier apporte le typage et la validation qui manqueraient sinon :
// tout statut écrit en base passe par ces constantes.
// ============================================

// ---- Marin ----
export const MARIN_STATUS = {
  // Inscrit en ligne, en attente de validation physique au guichet
  PENDING: "PENDING",
  // Créé par l'ARSTM, en attente de validation DGAM du matricule (R20)
  PENDING_DGAM_VALIDATION: "PENDING_DGAM_VALIDATION",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
} as const;
export type MarinStatus = (typeof MARIN_STATUS)[keyof typeof MARIN_STATUS];

// Origine de l'inscription, tracée pour l'audit (R19)
export const REGISTRATION_SOURCE = {
  SELF_ONLINE: "SELF_ONLINE",
  DGAM_DESK: "DGAM_DESK",
  ARSTM_ENROLLMENT: "ARSTM_ENROLLMENT",
} as const;
export type RegistrationSource =
  (typeof REGISTRATION_SOURCE)[keyof typeof REGISTRATION_SOURCE];

// ---- Document ----
export const DOCUMENT_STATUS = {
  // Déposé par le marin, pas encore contrôlé
  SCANNED: "SCANNED",
  // Contrôlé par un agent DGAM, QR code généré
  VERIFIED: "VERIFIED",
  // Produit par la plateforme à l'issue d'une demande approuvée
  OFFICIAL_DIGITAL: "OFFICIAL_DIGITAL",
  EXPIRED: "EXPIRED",
  REPLACED: "REPLACED",
  REJECTED: "REJECTED",
  REVOKED: "REVOKED",
  SUSPENDED: "SUSPENDED",
} as const;
export type DocumentStatus =
  (typeof DOCUMENT_STATUS)[keyof typeof DOCUMENT_STATUS];

// Statuts considérés comme définitifs : le document devient immuable (R2)
export const IMMUTABLE_DOCUMENT_STATUSES: DocumentStatus[] = [
  DOCUMENT_STATUS.VERIFIED,
  DOCUMENT_STATUS.OFFICIAL_DIGITAL,
  DOCUMENT_STATUS.REPLACED,
  DOCUMENT_STATUS.REVOKED,
];

// Statuts qui portent un QR code vérifiable publiquement
export const VERIFIABLE_DOCUMENT_STATUSES: DocumentStatus[] = [
  DOCUMENT_STATUS.VERIFIED,
  DOCUMENT_STATUS.OFFICIAL_DIGITAL,
];

// ---- Sea Service ----
export const EMBARKATION_STATUS = {
  DECLARED: "DECLARED",
  SUBMITTED: "SUBMITTED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;
export type EmbarkationStatus =
  (typeof EMBARKATION_STATUS)[keyof typeof EMBARKATION_STATUS];

// ---- Demandes ----
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
export type RequestStatus =
  (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];

// Matrice des transitions autorisées. Toute transition absente est refusée
// par le service : le workflow ne peut pas être court-circuité par le client.
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
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

export const REQUEST_TYPE = {
  FIRST_ISSUANCE: "FIRST_ISSUANCE",
  RENEWAL: "RENEWAL",
  DUPLICATE: "DUPLICATE",
  UPGRADE: "UPGRADE",
} as const;
export type RequestType = (typeof REQUEST_TYPE)[keyof typeof REQUEST_TYPE];

// Qui a soumis la demande. ARSTM_ENROLLMENT_AGENT ne peut jamais approuver (R21).
export const SUBMITTED_BY_ROLE = {
  MARIN: "MARIN",
  DGAM_AGENT: "DGAM_AGENT",
  ARSTM_ENROLLMENT_AGENT: "ARSTM_ENROLLMENT_AGENT",
} as const;
export type SubmittedByRole =
  (typeof SUBMITTED_BY_ROLE)[keyof typeof SUBMITTED_BY_ROLE];

// ---- Paiement ----
export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;
export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_CHANNEL = {
  MOBILE_MONEY: "MOBILE_MONEY",
  CASH: "CASH",
} as const;
export type PaymentChannel =
  (typeof PAYMENT_CHANNEL)[keyof typeof PAYMENT_CHANNEL];

// Opérateurs Mobile Money disponibles en Côte d'Ivoire
export const MOBILE_MONEY_OPERATORS = [
  "ORANGE_MONEY",
  "MTN_MOMO",
  "WAVE",
  "MOOV_MONEY",
] as const;
export type MobileMoneyOperator = (typeof MOBILE_MONEY_OPERATORS)[number];

// ---- Formation ARSTM ----
export const SESSION_STATUS = {
  // Inscriptions ouvertes, quorum non atteint (R15)
  WAITING_FOR_QUORUM: "WAITING_FOR_QUORUM",
  // Quorum atteint, dates et formateur fixés
  SCHEDULED: "SCHEDULED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;
export type SessionStatus =
  (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

export const ENROLLMENT_STATUS = {
  // Proposée automatiquement par le scan d'expiration (module B)
  PROPOSED: "PROPOSED",
  // Le marin a accepté, en attente de quorum
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  COMPLETED: "COMPLETED",
  DECLINED: "DECLINED",
  CANCELLED: "CANCELLED",
} as const;
export type EnrollmentStatus =
  (typeof ENROLLMENT_STATUS)[keyof typeof ENROLLMENT_STATUS];

export const ENROLLMENT_SOURCE = {
  MARIN: "MARIN",
  ARSTM: "ARSTM",
  SYSTEM_EXPIRY_SCAN: "SYSTEM_EXPIRY_SCAN",
} as const;
export type EnrollmentSource =
  (typeof ENROLLMENT_SOURCE)[keyof typeof ENROLLMENT_SOURCE];

// ---- Notifications ----
export const NOTIFICATION_CHANNEL = {
  SMS: "SMS",
  WHATSAPP: "WHATSAPP",
  EMAIL: "EMAIL",
} as const;
export type NotificationChannel =
  (typeof NOTIFICATION_CHANNEL)[keyof typeof NOTIFICATION_CHANNEL];

// ---- Catégories de certificats ----
export const CERTIFICATE_CATEGORY = {
  STCW: "STCW",
  MEDICAL: "MEDICAL",
  SEAMAN_BOOK: "SEAMAN_BOOK",
  OTHER: "OTHER",
} as const;
export type CertificateCategory =
  (typeof CERTIFICATE_CATEGORY)[keyof typeof CERTIFICATE_CATEGORY];
