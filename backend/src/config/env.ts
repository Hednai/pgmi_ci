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
  // Meta WhatsApp Cloud API
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  CINETPAY_API_KEY: z.string().optional(),
  CINETPAY_SITE_ID: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Stockage distant Supabase.
  // Ces trois variables sont optionnelles dans le schéma Zod, mais le
  // superRefine ci-dessous les rend obligatoires dès que STORAGE_PROVIDER
  // vaut "supabase". En local (STORAGE_PROVIDER=local) elles peuvent être
  // absentes du .env sans que le serveur refuse de démarrer.
  SUPABASE_URL: z.string().url().optional(),
  // Une clé de service Supabase est un JWT : trois segments base64url
  // séparés par des points. Un min(20) laissait passer une valeur
  // tronquée, qui n'échouait qu'au premier dépôt, côté marin.
  SUPABASE_SERVICE_KEY: z
    .string()
    .regex(/^[\w-]+\.[\w-]+\.[\w-]+$/, "SUPABASE_SERVICE_KEY doit être un JWT valide.")
    .optional(),
  SUPABASE_BUCKET: z.string().min(1).optional(),

  // Renvoie le code OTP dans la réponse HTTP. N'est honoré qu'en dehors de
  // la production, ou sur une instance de production explicitement marquée
  // comme instance de démonstration.
  EXPOSE_OTP_IN_RESPONSE: z
    .string()
    .optional()
    .transform((valeur) => valeur === "true"),

  // Instance de démonstration : la plateforme affiche un bandeau et autorise
  // les facilités de recette. Jamais actif sur l'instance réelle de la DGAM.
  DEMO_MODE: z
    .string()
    .optional()
    .transform((valeur) => valeur === "true"),
})
  .superRefine((valeurs, contexte) => {
    // Un stockage distant sans identifiants partirait en production et
    // n'échouerait qu'au premier dépôt de fichier, côté marin. Mieux vaut
    // refuser de démarrer.
    if (valeurs.STORAGE_PROVIDER === "supabase") {
      const manquantes = (
        [
          ["SUPABASE_URL", valeurs.SUPABASE_URL],
          ["SUPABASE_SERVICE_KEY", valeurs.SUPABASE_SERVICE_KEY],
          ["SUPABASE_BUCKET", valeurs.SUPABASE_BUCKET],
        ] as const
      )
        .filter(function (entree) {
          return !entree[1];
        })
        .map(function (entree) {
          return entree[0];
        });

      if (manquantes.length > 0) {
        // Le bucket est exigé explicitement plutôt que laissé au repli :
        // déployer sur le bucket par défaut sans l'avoir voulu reviendrait
        // à écrire des pièces d'identité dans un emplacement non prévu.
        contexte.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["STORAGE_PROVIDER"],
          message: `STORAGE_PROVIDER=supabase exige : ${manquantes.join(", ")}.`,
        });
      }
    }

    // Une instance de démonstration ne doit jamais utiliser une passerelle
    // SMS réelle, sinon de vrais codes partiraient vers de vrais numéros
    // pendant une présentation.
    if (valeurs.DEMO_MODE && valeurs.SMS_PROVIDER !== "console") {
      contexte.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DEMO_MODE"],
        message:
          "DEMO_MODE=true est incompatible avec un fournisseur SMS réel. Utilisez SMS_PROVIDER=console.",
      });
    }
  });

const resultat = envSchema.safeParse(process.env);

if (!resultat.success) {
  console.error("Variables d'environnement invalides :");
  console.error(JSON.stringify(resultat.error.flatten().fieldErrors, null, 2));
  process.exit(1);
}

const donnees = resultat.data;

// Garde-fou de production. Le code OTP n'accompagne la réponse que si le
// drapeau est explicitement actif ET que l'instance n'est pas une production
// réelle. Une instance de production marquée DEMO_MODE reste autorisée : c'est
// le déploiement de recette, annoncé par un bandeau à l'écran.
const otpExposable =
  donnees.EXPOSE_OTP_IN_RESPONSE &&
  (donnees.NODE_ENV !== "production" || donnees.DEMO_MODE);

export const env = {
  ...donnees,
  EXPOSE_OTP_IN_RESPONSE: otpExposable,
};

// Instance de démonstration, lue par les services qui adaptent leur réponse
export const estModeDemonstration = env.DEMO_MODE;

// Liste des origines autorisées, dérivée de FRONTEND_URL
export const ORIGINES_AUTORISEES = env.FRONTEND_URL.split(",")
  .map((origine) => origine.trim())
  .filter(Boolean);

export const estProduction = env.NODE_ENV === "production";