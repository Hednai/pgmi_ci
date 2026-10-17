// ============================================
// features/training/training.route.ts
// Routes du module formation ARSTM.
//
// Aucune route de ce module ne permet d'approuver un document : l'ARSTM
// organise la formation, la DGAM décide (R21).
// ============================================
import { Router } from "express";
import { requireMarin, requireAgent } from "../../middleware/auth.js";
import { requireRole, requireTrainingInstitution } from "../../middleware/rbac.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { ARSTM_TRAINING_ROLES, ARSTM_ROLES } from "../../domain/roles.js";
import {
  creationSessionSchema,
  planificationSessionSchema,
  inscriptionFormationSchema,
  inscriptionParArstmSchema,
  reponsePropositionSchema,
  resultatsSessionSchema,
  filtreSessionsSchema,
} from "./training.validation.js";
import {
  sessionsOuvertes,
  mesInscriptions,
  mInscrire,
  repondre,
  sessions,
  ouvrirSession,
  planifier,
  saisirResultats,
  inscrireMarinParArstm,
  fileAttente,
  synthese,
} from "./training.controller.js";

const formationsRouter = Router();

// ---- Espace marin ----
formationsRouter.get("/sessions-ouvertes", requireMarin, sessionsOuvertes);
formationsRouter.get("/me", requireMarin, mesInscriptions);
formationsRouter.post("/me", requireMarin, validateBody(inscriptionFormationSchema), mInscrire);
formationsRouter.post(
  "/me/:id/reponse",
  requireMarin,
  validateBody(reponsePropositionSchema),
  repondre,
);

// ---- Espace ARSTM ----
const arstm = [requireAgent, requireRole(...ARSTM_ROLES), requireTrainingInstitution];
const arstmFormation = [
  requireAgent,
  requireRole(...ARSTM_TRAINING_ROLES),
  requireTrainingInstitution,
];

formationsRouter.get("/synthese", ...arstm, synthese);
formationsRouter.get("/file-attente", ...arstm, fileAttente);
formationsRouter.get("/sessions", ...arstm, validateQuery(filtreSessionsSchema), sessions);

formationsRouter.post(
  "/sessions",
  ...arstmFormation,
  validateBody(creationSessionSchema),
  ouvrirSession,
);
formationsRouter.post(
  "/sessions/:id/planification",
  ...arstmFormation,
  validateBody(planificationSessionSchema),
  planifier,
);
formationsRouter.post(
  "/sessions/:id/resultats",
  ...arstmFormation,
  validateBody(resultatsSessionSchema),
  saisirResultats,
);
formationsRouter.post(
  "/inscriptions",
  ...arstm,
  validateBody(inscriptionParArstmSchema),
  inscrireMarinParArstm,
);

export { formationsRouter };
