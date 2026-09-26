// ============================================
// features/auth/auth.route.ts
// Routes d'authentification.
// Le rate limiting est posé ici plutôt que dans app.ts : la contrainte
// (5 OTP par heure et par numéro) appartient à cette fonctionnalité.
// ============================================
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RATE_LIMIT } from "../../config/constants.js";
import { validateBody } from "../../middleware/validate.js";
import { requireAgent } from "../../middleware/auth.js";
import {
  demandeOtpSchema,
  verificationOtpSchema,
  inscriptionMarinSchema,
  connexionAgentSchema,
  rafraichirSchema,
} from "./auth.validation.js";
import {
  demanderOtp,
  verifierOtp,
  inscrire,
  connexionAgent,
  deconnexionAgent,
  rafraichir,
  profilCourant,
} from "./auth.controller.js";

const authRouter = Router();

// Limite par numéro de téléphone et non par adresse IP : dans un cybercafé
// d'Abidjan, plusieurs marins partagent la même IP.
const otpLimiter = rateLimit({
  windowMs: RATE_LIMIT.OTP_FENETRE_MS,
  limit: RATE_LIMIT.OTP_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.phone ?? req.ip),
  message: {
    success: false,
    message: "Trop de demandes de code pour ce numéro. Réessayez dans une heure.",
  },
});

const loginLimiter = rateLimit({
  windowMs: RATE_LIMIT.FENETRE_MS,
  limit: RATE_LIMIT.LOGIN_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Trop de tentatives de connexion." },
});

authRouter.post("/otp/request", otpLimiter, validateBody(demandeOtpSchema), demanderOtp);
authRouter.post("/otp/verify", loginLimiter, validateBody(verificationOtpSchema), verifierOtp);
authRouter.post("/register", loginLimiter, validateBody(inscriptionMarinSchema), inscrire);

authRouter.post("/agent/login", loginLimiter, validateBody(connexionAgentSchema), connexionAgent);
authRouter.post("/agent/logout", requireAgent, deconnexionAgent);

authRouter.post("/refresh", validateBody(rafraichirSchema), rafraichir);

export { authRouter, profilCourant };
