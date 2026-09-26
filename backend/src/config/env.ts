// ============================================
// config/env.ts
// Validation des variables d'environnement au démarrage.
// Si une variable requise manque ou a un format invalide, le serveur refuse
// de démarrer plutôt que d'échouer plus tard en production.
// ============================================
import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL est requise"),

  // Origines autorisées par CORS, séparées par une virgule
  FRONTEND_URL: z.string().min(1).default("http://localhost:5173"),

  // Base de l'URL courte imprimée sous le QR code
  PUBLIC_VERIFY_URL: z.string().min(1).default("http://localhost:4000/v"),

  // Secrets de signature. 32 caractères minimum, même en développement :
  // un secret court donne une fausse impression de sécurité.
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET doit faire au moins 32 caractères"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET doit faire au moins 32 caractères"),
  QR_SIGNING_SECRET: z.string().min(32, "QR_SIGNING_SECRET doit faire au moins 32 caractères"),

  // Sélection des implémentations de fournisseurs (pattern Provider)
  SMS_PROVIDER: z.enum(["console", "africastalking"]).default("console"),
  WHATSAPP_PROVIDER: z.enum(["console", "meta"]).default("console"),
  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  PAYMENT_PROVIDER: z.enum(["sandbox", "cinetpay"]).default("sandbox"),
  STORAGE_PROVIDER: z.enum(["local", "supabase"]).default("local"),

  AFRICAS_TALKING_API_KEY: z.string().optional(),
  AFRICAS_TALKING_USERNAME: z.string().optional(),
  CINETPAY_API_KEY: z.string().optional(),
  CINETPAY_SITE_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Renvoie le code OTP dans la réponse HTTP. Refusé en production par le
  // raffinement ci-dessous : une erreur de configuration ne doit pas
  // exposer les codes de connexion.
  EXPOSE_OTP_IN_RESPONSE: z
    .string()
    .optional()
    .transform((valeur) => valeur === "true"),
});

const resultat = envSchema.safeParse(process.env);

if (!resultat.success) {
  console.error("Variables d'environnement invalides :");
  console.error(JSON.stringify(resultat.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const donnees = resultat.data;

// Garde-fou de production : aucune exposition du code OTP hors développement
export const env = {
  ...donnees,
  EXPOSE_OTP_IN_RESPONSE:
    donnees.NODE_ENV === "production" ? false : donnees.EXPOSE_OTP_IN_RESPONSE,
};

// Liste des origines autorisées, dérivée de FRONTEND_URL
export const ORIGINES_AUTORISEES = env.FRONTEND_URL.split(",")
  .map((origine) => origine.trim())
  .filter(Boolean);

export const estProduction = env.NODE_ENV === "production";
