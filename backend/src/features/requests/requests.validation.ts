// ============================================
// features/requests/requests.validation.ts
// Schémas Zod du workflow de demande.
// ============================================
import { z } from "zod";
import { REQUEST_TYPE, REQUEST_STATUS } from "../../domain/status.js";
import { reglementSchema } from "../../services/payment/payment.validation.js";
import { fichierSchema } from "../documents/documents.validation.js";
import { MAX_ATTACHMENTS_PER_REQUEST } from "../../domain/rules.js";

// Ni le montant ni le statut ne figurent ici : le montant vient du barème,
// le statut du moteur de workflow.
export const soumissionDemandeSchema = z.object({
  certificateTypeId: z.string().trim().min(1, "Type de certificat requis"),
  type: z.enum([
    REQUEST_TYPE.FIRST_ISSUANCE,
    REQUEST_TYPE.RENEWAL,
    REQUEST_TYPE.DUPLICATE,
    REQUEST_TYPE.UPGRADE,
  ]),
  sourceDocumentId: z.string().trim().min(1).optional(),
  reason: z.string().trim().max(500).optional(),
  attachments: z
    .array(fichierSchema)
    .max(
      MAX_ATTACHMENTS_PER_REQUEST,
      `${MAX_ATTACHMENTS_PER_REQUEST} pièces jointes au maximum`,
    )
    .optional(),
});

// Module D : l'ARSTM ouvre une demande au nom d'un élève.
// Le marin cible est explicite, la demande reste instruite par la DGAM (R21).
export const demandePourEleveSchema = soumissionDemandeSchema.extend({
  marinId: z.string().trim().min(1, "Élève concerné requis"),
});

// Le règlement d'une demande suit le schéma commun du service de paiement.
// Le nom local est conservé pour les routes qui l'importent déjà.
export const paiementSchema = reglementSchema;

export const assignationSchema = z.object({
  agentId: z.string().trim().min(1, "Agent destinataire requis"),
});

export const decisionSchema = z.object({
  // Motif obligatoire pour un rejet (R9), facultatif pour une approbation
  reason: z.string().trim().max(500).optional(),
});

export const rejetDemandeSchema = z.object({
  reason: z.string().trim().min(5, "Le motif de rejet est obligatoire").max(500),
});

export const complementSchema = z.object({
  message: z.string().trim().min(5, "Précisez les pièces attendues").max(500),
});

export const filtreDemandesSchema = z.object({
  status: z
    .enum([
      REQUEST_STATUS.SUBMITTED,
      REQUEST_STATUS.AWAITING_PAYMENT,
      REQUEST_STATUS.ASSIGNED,
      REQUEST_STATUS.IN_REVIEW,
      REQUEST_STATUS.INFO_REQUESTED,
      REQUEST_STATUS.APPROVED,
      REQUEST_STATUS.DOCUMENT_AVAILABLE,
      REQUEST_STATUS.REJECTED,
      REQUEST_STATUS.CANCELLED,
    ])
    .optional(),
  // Restreint la liste aux demandes assignées à l'agent connecté
  mesDossiers: z.coerce.boolean().optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().positive().optional(),
  taille: z.coerce.number().int().positive().optional(),
});