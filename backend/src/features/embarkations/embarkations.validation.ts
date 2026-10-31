// ============================================
// features/embarkations/embarkations.validation.ts
// Schémas Zod du Sea Service Record.
// ============================================
import { z } from "zod";
import { EMBARKATION_STATUS } from "../../domain/status.js";
import { CODES_PIECES_SERVICE_MER } from "../../domain/piecesServiceMer.js";

// Le champ days est absent : il est calculé côté serveur à partir des dates.
// Laisser le client fournir un nombre de jours reviendrait à lui laisser
// écrire son propre service en mer.
export const declarationEmbarquementSchema = z
  .object({
    vesselName: z.string().trim().min(2, "Nom du navire requis").max(120),
    imoNumber: z
      .string()
      .trim()
      .regex(/^\d{7}$/, "Le numéro IMO comporte 7 chiffres")
      .optional()
      .or(z.literal("")),
    flag: z.string().trim().max(60).optional(),
    vesselType: z.string().trim().max(80).optional(),
    fonctionId: z.string().trim().min(1).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((donnees) => donnees.endDate >= donnees.startDate, {
    message: "La date de débarquement doit suivre la date d'embarquement.",
    path: ["endDate"],
  })
  .refine((donnees) => donnees.startDate.getTime() <= Date.now(), {
    message: "La date d'embarquement ne peut pas être dans le futur.",
    path: ["startDate"],
  });

// Dépôt d'une pièce justificative. Le type de pièce est contraint au
// référentiel du domaine : la liste n'est pas recopiée ici, elle en est
// dérivée, et ajouter une pièce au catalogue suffit.
export const depotPieceSchema = z.object({
  kind: z.enum(CODES_PIECES_SERVICE_MER as [string, ...string[]], {
    errorMap: () => ({ message: "Type de pièce justificative inconnu." }),
  }),
  fichier: z.object({
    nom: z.string().trim().min(1).max(160),
    mimeType: z.string().trim().min(3).max(80),
    contenuBase64: z.string().min(1),
  }),
});

export const rejetEmbarquementSchema = z.object({
  reason: z.string().trim().min(5, "Motif obligatoire").max(300),
});

// Demande de pièces complémentaires. Le message est adressé au marin et
// doit lui dire quoi déposer : un motif de cinq caractères ne l'aiderait
// pas, la longueur minimale est donc plus exigeante que pour un rejet.
export const complementEmbarquementSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Indiquez au marin les pièces attendues.")
    .max(500),
});

export const filtreEmbarquementsSchema = z.object({
  status: z
    .enum([
      EMBARKATION_STATUS.DECLARED,
      EMBARKATION_STATUS.AWAITING_PAYMENT,
      EMBARKATION_STATUS.SUBMITTED,
      EMBARKATION_STATUS.INFO_REQUESTED,
      EMBARKATION_STATUS.VERIFIED,
      EMBARKATION_STATUS.REJECTED,
    ])
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  taille: z.coerce.number().int().positive().optional(),
});