// ============================================
// features/auth/auth.validation.ts
// Schémas Zod de l'authentification.
// Les règles de format ivoiriennes sont ici, pas dans le contrôleur.
// ============================================
import { z } from "zod";
import { OTP_LENGTH, MOT_DE_PASSE_LONGUEUR_MIN, MOT_DE_PASSE_LONGUEUR_MAX } from "../../domain/rules.js";

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

// Code à usage unique : 6 chiffres
export const codeUsageUniqueSchema = z
  .string()
  .trim()
  .regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), `Le code comporte ${OTP_LENGTH} chiffres.`);

// Mot de passe : longueur validée depuis les constantes du domaine
export const motDePasseSchema = z
  .string()
  .min(MOT_DE_PASSE_LONGUEUR_MIN, `Le mot de passe doit comporter au moins ${MOT_DE_PASSE_LONGUEUR_MIN} caractères.`)
  .max(MOT_DE_PASSE_LONGUEUR_MAX);

// Connexion du marin par numéro et mot de passe
export const connexionMarinSchema = z.object({
  phone: telephoneSchema,
  password: motDePasseSchema,
});

// Inscription en ligne du marin
export const inscriptionMarinSchema = z.object({
  phone: telephoneSchema,
  password: motDePasseSchema,
  firstName: z.string().trim().min(2, "Prénom requis").max(80),
  lastName: z.string().trim().min(2, "Nom requis").max(80),
  birthDate: z.coerce.date(),
  birthPlace: z.string().trim().min(2, "Lieu de naissance requis").max(120),
  nationality: z.string().trim().min(2).max(60).default("Ivoirienne"),
  idNumber: z.string().trim().min(4, "Numéro CNI ou passeport requis").max(40),
  email: z.string().trim().email("Adresse email invalide").optional().or(z.literal("")),
  region: z.string().trim().max(80).optional(),
});

// Demande d'un code de réinitialisation. Le canal reste choisi par le marin :
// WhatsApp par défaut, le SMS restant le plus coûteux.
export const demandeCodeMotDePasseSchema = z.object({
  phone: telephoneSchema,
  canal: z.enum(["SMS", "WHATSAPP"]).default("WHATSAPP"),
});

// Définition d'un nouveau mot de passe contre un code valide
export const reinitialisationMotDePasseSchema = z.object({
  phone: telephoneSchema,
  code: codeUsageUniqueSchema,
  password: motDePasseSchema,
});

export const connexionAgentSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide"),
  password: motDePasseSchema,
});

export const rafraichirSchema = z.object({
  refreshToken: z.string().min(20, "Jeton de rafraîchissement requis"),
});

export type ConnexionMarin = z.infer<typeof connexionMarinSchema>;
export type InscriptionMarin = z.infer<typeof inscriptionMarinSchema>;
export type DemandeCodeMotDePasse = z.infer<typeof demandeCodeMotDePasseSchema>;
export type ReinitialisationMotDePasse = z.infer<typeof reinitialisationMotDePasseSchema>;
export type ConnexionAgent = z.infer<typeof connexionAgentSchema>;