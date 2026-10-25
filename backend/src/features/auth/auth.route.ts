// ============================================
// features/auth/auth.route.ts
// Routes d'authentification.
// Le rate limiting est posé ici plutôt que dans app.ts : la contrainte
// appartient à cette fonctionnalité.
// ============================================
import { Router } from "express";
import { validateBody } from "../../middleware/validate.js";
import { requireAgent } from "../../middleware/auth.js";
import { otpLimiter, loginLimiter, refreshLimiter } from "../../middleware/limiteurs.js";
import {
  connexionMarinSchema,
  inscriptionMarinSchema,
  demandeCodeMotDePasseSchema,
  reinitialisationMotDePasseSchema,
  connexionAgentSchema,
  rafraichirSchema,
} from "./auth.validation.js";
import {
  connexionMarin,
  inscrire,
  demanderCodeMotDePasse,
  reinitialiserMotDePasse,
  connexionAgent,
  deconnexionAgent,
  rafraichir,
  profilCourant,
} from "./auth.controller.js";

const authRouter = Router();

// Connexion du marin par numéro et mot de passe
authRouter.post("/marin/login", loginLimiter, validateBody(connexionMarinSchema), connexionMarin);

// Inscription en ligne : le marin choisit son mot de passe à l'inscription
authRouter.post("/register", loginLimiter, validateBody(inscriptionMarinSchema), inscrire);

// Mot de passe oublié : demande du code, puis définition du nouveau mot de passe
authRouter.post("/marin/mot-de-passe/code", otpLimiter, validateBody(demandeCodeMotDePasseSchema), demanderCodeMotDePasse);
authRouter.post("/marin/mot-de-passe", loginLimiter, validateBody(reinitialisationMotDePasseSchema), reinitialiserMotDePasse);

authRouter.post("/agent/login", loginLimiter, validateBody(connexionAgentSchema), connexionAgent);
authRouter.post("/agent/logout", requireAgent, deconnexionAgent);

// Le rafraîchissement était le seul point d'entrée non plafonné de
// l'authentification. Le plafond est posé par session présentée, pas par
// adresse : voir middleware/limiteurs.ts.
authRouter.post("/refresh", refreshLimiter, validateBody(rafraichirSchema), rafraichir);

export { authRouter, profilCourant };