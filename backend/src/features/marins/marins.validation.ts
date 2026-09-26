// ============================================
// features/marins/marins.validation.ts
// Schémas Zod du dossier marin.
// ============================================
import { z } from "zod";
import { telephoneSchema } from "../auth/auth.validation.js";
import { MARIN_STATUS } from "../../domain/status.js";

// Mise à jour du profil par le marin lui-même.
// Ni le matricule ni le statut ne figurent ici : ils relèvent de la DGAM (R3).
export const majProfilSchema = z.object({
  email: z.string().trim().email("Adresse email invalide").optional().or(z.literal("")),
  region: z.string().trim().max(80).optional(),
  shipCategory: z.string().trim().max(80).optional(),
  fonctionId: z.string().trim().min(1).optional(),
  photoUrl: z.string().trim().max(300).optional(),
});

// Préférences de notification. Le SMS est absent : il n'est pas
// désactivable par le marin (R17).
export const majPreferencesSchema = z.object({
  whatsapp: z.boolean(),
  email: z.boolean(),
});

// Recherche de marins au guichet
export const rechercheMarinsSchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum([
    MARIN_STATUS.PENDING,
    MARIN_STATUS.PENDING_DGAM_VALIDATION,
    MARIN_STATUS.ACTIVE,
    MARIN_STATUS.SUSPENDED,
  ]).optional(),
  source: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().positive().optional(),
  taille: z.coerce.number().int().positive().optional(),
});

// Activation au guichet : l'agent confirme la vérification d'identité
export const activationSchema = z.object({
  // Renseigné si l'antenne applique une numérotation manuelle
  matricule: z.string().trim().max(30).optional(),
  fonctionId: z.string().trim().min(1).optional(),
  region: z.string().trim().max(80).optional(),
  // Trace de la pièce présentée au guichet, conservée dans l'audit
  identityCheck: z.string().trim().min(3, "Précisez la pièce vérifiée").max(120),
});

// Inscription d'un élève navigant par l'ARSTM (module C).
// Le téléphone reste obligatoire : c'est l'identifiant de connexion du marin.
export const inscriptionEleveSchema = z.object({
  phone: telephoneSchema,
  firstName: z.string().trim().min(2, "Prénom requis").max(80),
  lastName: z.string().trim().min(2, "Nom requis").max(80),
  birthDate: z.coerce.date(),
  birthPlace: z.string().trim().min(2).max(120),
  nationality: z.string().trim().min(2).max(60).default("Ivoirienne"),
  idNumber: z.string().trim().min(4, "Numéro CNI requis").max(40),
  email: z.string().trim().email().optional().or(z.literal("")),
  region: z.string().trim().max(80).optional(),
  fonctionId: z.string().trim().min(1).optional(),
  // Attestation que l'élève a été vu physiquement à l'ARSTM (R19)
  identityCheck: z.string().trim().min(3, "Précisez la pièce vérifiée").max(120),
});

export const suspensionSchema = z.object({
  reason: z.string().trim().min(5, "Motif obligatoire").max(300),
});

export type MajProfil = z.infer<typeof majProfilSchema>;
export type Activation = z.infer<typeof activationSchema>;
export type InscriptionEleve = z.infer<typeof inscriptionEleveSchema>;
