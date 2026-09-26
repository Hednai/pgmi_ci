// ============================================
// features/referentials/referentials.validation.ts
// Schémas Zod des référentiels administrables (EF-015).
// ============================================
import { z } from "zod";
import { CERTIFICATE_CATEGORY, REQUEST_TYPE } from "../../domain/status.js";

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

export const feeScheduleSchema = z.object({
  certificateTypeId: z.string().trim().min(1),
  requestType: z.enum([
    REQUEST_TYPE.FIRST_ISSUANCE,
    REQUEST_TYPE.RENEWAL,
    REQUEST_TYPE.DUPLICATE,
    REQUEST_TYPE.UPGRADE,
  ]),
  amount: z.coerce.number().int().min(0).max(10_000_000),
  currency: z.string().trim().length(3).default("XOF"),
  isActive: z.boolean().default(true),
});
