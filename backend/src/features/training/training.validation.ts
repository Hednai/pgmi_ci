// ============================================
// features/training/training.validation.ts
// Schémas Zod du module formation ARSTM.
// ============================================
import { z } from "zod";
import { DEFAULT_SESSION_QUORUM } from "../../domain/rules.js";
import { ENROLLMENT_STATUS, SESSION_STATUS } from "../../domain/status.js";

// Ouverture d'une session. Les dates sont facultatives : une session naît
// souvent sans calendrier, en attente de quorum (R15).
export const creationSessionSchema = z.object({
  certificateTypeId: z.string().trim().min(1, "Module de formation requis"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  location: z.string().trim().max(160).optional(),
  trainer: z.string().trim().max(120).optional(),
  capacity: z.coerce.number().int().positive().max(200).default(20),
  minQuorum: z.coerce.number().int().positive().max(100).default(DEFAULT_SESSION_QUORUM),
});

// Programmation effective : là, les dates deviennent obligatoires.
export const planificationSessionSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    location: z.string().trim().min(2, "Lieu requis").max(160),
    trainer: z.string().trim().min(2, "Formateur requis").max(120),
  })
  .refine((donnees) => donnees.endDate >= donnees.startDate, {
    message: "La date de fin doit suivre la date de début.",
    path: ["endDate"],
  });

export const inscriptionFormationSchema = z.object({
  certificateTypeId: z.string().trim().min(1, "Module de formation requis"),
  sessionId: z.string().trim().min(1).optional(),
});

// Inscription d'un marin à une session par l'ARSTM
export const inscriptionParArstmSchema = z.object({
  marinId: z.string().trim().min(1, "Marin requis"),
  certificateTypeId: z.string().trim().min(1, "Module requis"),
  sessionId: z.string().trim().min(1).optional(),
});

export const reponsePropositionSchema = z.object({
  accepte: z.boolean(),
});

// Saisie des résultats en fin de session
export const resultatsSessionSchema = z.object({
  resultats: z
    .array(
      z.object({
        enrollmentId: z.string().trim().min(1),
        present: z.boolean(),
        resultat: z.enum(["PASSED", "FAILED"]),
      }),
    )
    .min(1, "Au moins un résultat attendu"),
});

export const filtreSessionsSchema = z.object({
  status: z
    .enum([
      SESSION_STATUS.WAITING_FOR_QUORUM,
      SESSION_STATUS.SCHEDULED,
      SESSION_STATUS.IN_PROGRESS,
      SESSION_STATUS.COMPLETED,
      SESSION_STATUS.CANCELLED,
    ])
    .optional(),
  certificateTypeId: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().positive().optional(),
  taille: z.coerce.number().int().positive().optional(),
});

export const filtreInscriptionsSchema = z.object({
  status: z
    .enum([
      ENROLLMENT_STATUS.PROPOSED,
      ENROLLMENT_STATUS.PENDING,
      ENROLLMENT_STATUS.CONFIRMED,
      ENROLLMENT_STATUS.COMPLETED,
      ENROLLMENT_STATUS.DECLINED,
      ENROLLMENT_STATUS.CANCELLED,
    ])
    .optional(),
  page: z.coerce.number().int().positive().optional(),
  taille: z.coerce.number().int().positive().optional(),
});
