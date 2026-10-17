// ============================================
// features/auth/auth.route.ts
// Routes d'authentification.
// Le rate limiting est posé ici plutôt que dans app.ts : la contrainte
// (5 OTP par heure et par numéro) appartient à cette fonctionnalité.
// ============================================
import { Router } from "express";
import { validateBody } from "../../middleware/validate.js";
import { requireAgent } from "../../middleware/auth.js";
import { otpLimiter, loginLimiter, refreshLimiter } from "../../middleware/limiteurs.js";
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

authRouter.post("/otp/request", otpLimiter, validateBody(demandeOtpSchema), demanderOtp);
authRouter.post("/otp/verify", loginLimiter, validateBody(verificationOtpSchema), verifierOtp);
authRouter.post("/register", loginLimiter, validateBody(inscriptionMarinSchema), inscrire);

authRouter.post("/agent/login", loginLimiter, validateBody(connexionAgentSchema), connexionAgent);
authRouter.post("/agent/logout", requireAgent, deconnexionAgent);

// Le rafraîchissement était le seul point d'entrée non plafonné de
// l'authentification. Le plafond est posé par session présentée, pas par
// adresse : voir middleware/limiteurs.ts.
authRouter.post("/refresh", refreshLimiter, validateBody(rafraichirSchema), rafraichir);

export { authRouter, profilCourant };