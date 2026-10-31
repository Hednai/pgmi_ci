// ============================================
// features/referentials/referentials.validation.ts
// Schémas Zod des référentiels administrables (EF-015).
// ============================================
import { z } from "zod";
import { CERTIFICATE_CATEGORY, REQUEST_TYPE } from "../../domain/status.js";
import { SERVICE_TARIFE, TYPE_PRESTATION_SERVICE } from "../../domain/prestations.js";

export const fonctionSchema = z.object({
  code: z.string().trim().min(2).max(20).toUpperCase(),
  label: z.string().trim().min(2).max(120),
  category: z.enum(["PONT", "MACHINE", "GENERAL"]).default("PONT"),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const certificateTypeSchema = z.object({
  code: z.string().trim().min(2).max(20).toUpperCase(),
  label: z.string().trim().min(2).max(160),
  category: z.enum([
    CERTIFICATE_CATEGORY.STCW,
    CERTIFICATE_CATEGORY.MEDICAL,
    CERTIFICATE_CATEGORY.SEAMAN_BOOK,
    CERTIFICATE_CATEGORY.OTHER,
  ]),
  validityMonths: z.coerce.number().int().positive().max(600).optional(),
  requiresTraining: z.boolean().default(false),
  trainingDays: z.coerce.number().int().positive().max(365).optional(),
  description: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

// Partie commune aux deux formes de barème.
const montantSchema = {
  amount: z.coerce.number().int().min(0).max(10_000_000),
  currency: z.string().trim().length(3).default("XOF"),
  isActive: z.boolean().default(true),
};

// Barème d'un type de certificat, tarifé par type de demande.
const baremeCertificatSchema = z.object({
  certificateTypeId: z.string().trim().min(1),
  requestType: z.enum([
    REQUEST_TYPE.FIRST_ISSUANCE,
    REQUEST_TYPE.RENEWAL,
    REQUEST_TYPE.DUPLICATE,
    REQUEST_TYPE.UPGRADE,
  ]),
  ...montantSchema,
});

// Barème d'une prestation de la plateforme, tarifée par code de service.
const baremeServiceSchema = z.object({
  serviceCode: z.enum([
    SERVICE_TARIFE.EMBARKATION_VALIDATION,
    SERVICE_TARIFE.NAVIGATION_RECORD,
  ]),
  requestType: z.literal(TYPE_PRESTATION_SERVICE).default(TYPE_PRESTATION_SERVICE),
  ...montantSchema,
});

// Une ligne de barème tarife soit un certificat, soit un service, jamais
// les deux : l'union discriminée interdit la ligne ambiguë dès la validation.
export const feeScheduleSchema = z.union([
  baremeCertificatSchema,
  baremeServiceSchema,
]);