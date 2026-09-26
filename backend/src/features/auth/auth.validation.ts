// ============================================
// features/auth/auth.validation.ts
// Schémas Zod de l'authentification.
// Les règles de format ivoiriennes sont ici, pas dans le contrôleur.
// ============================================
import { z } from "zod";
import { OTP_LENGTH } from "../../domain/rules.js";

// Numéro ivoirien au format international : +225 suivi de 10 chiffres.
// Les espaces sont tolérés à la saisie puis retirés.
export const telephoneSchema = z
  .string()
  .trim()
  .transform((valeur) => valeur.replace(/[\s.-]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^\+225\d{10}$/, "Numéro ivoirien attendu au format +225XXXXXXXXXX"),
  );

export const demandeOtpSchema = z.object({
  phone: telephoneSchema,
});

export const verificationOtpSchema = z.object({
  phone: telephoneSchema,
  code: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Le code comporte ${OTP_LENGTH} chiffres.`),
});

// Inscription en ligne du marin (étape 2, après vérification du numéro)
export const inscriptionMarinSchema = z.object({
  phone: telephoneSchema,
  code: z.string().trim().min(OTP_LENGTH).max(OTP_LENGTH),
  firstName: z.string().trim().min(2, "Prénom requis").max(80),
  lastName: z.string().trim().min(2, "Nom requis").max(80),
  birthDate: z.coerce.date(),
  birthPlace: z.string().trim().min(2, "Lieu de naissance requis").max(120),
  nationality: z.string().trim().min(2).max(60).default("Ivoirienne"),
  idNumber: z.string().trim().min(4, "Numéro CNI ou passeport requis").max(40),
  email: z.string().trim().email("Adresse email invalide").optional().or(z.literal("")),
  region: z.string().trim().max(80).optional(),
});

export const connexionAgentSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  password: z.string().min(8, "Mot de passe d'au moins 8 caractères"),
});

export const rafraichirSchema = z.object({
  refreshToken: z.string().min(20, "Jeton de rafraîchissement requis"),
});

export type DemandeOtp = z.infer<typeof demandeOtpSchema>;
export type VerificationOtp = z.infer<typeof verificationOtpSchema>;
export type InscriptionMarin = z.infer<typeof inscriptionMarinSchema>;
export type ConnexionAgent = z.infer<typeof connexionAgentSchema>;
