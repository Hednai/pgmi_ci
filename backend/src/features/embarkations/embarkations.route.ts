// ============================================
// features/embarkations/embarkations.route.ts
// Routes du Sea Service Record.
// ============================================
import { Router } from "express";
import { requireMarin, requireActiveMarin, requireAgent } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { DGAM_DECISION_ROLES } from "../../domain/roles.js";
import {
  declarationEmbarquementSchema,
  soumissionPreuveSchema,
  rejetEmbarquementSchema,
  filtreEmbarquementsSchema,
} from "./embarkations.validation.js";
import {
  monDossier,
  declarer,
  soumettrePreuve,
  aVerifier,
  dossierDuMarin,
  verifier,
  rejeter,
} from "./embarkations.controller.js";

const seaServiceRouter = Router();

// ---- Espace marin ----
seaServiceRouter.get("/me", requireMarin, validateQuery(filtreEmbarquementsSchema), monDossier);
seaServiceRouter.post(
  "/me",
  requireMarin,
  requireActiveMarin,
  validateBody(declarationEmbarquementSchema),
  declarer,
);
seaServiceRouter.post(
  "/me/:id/preuve",
  requireMarin,
  requireActiveMarin,
  validateBody(soumissionPreuveSchema),
  soumettrePreuve,
);

// ---- Agents DGAM ----
seaServiceRouter.get(
  "/a-verifier",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  validateQuery(filtreEmbarquementsSchema),
  aVerifier,
);
seaServiceRouter.get(
  "/marin/:marinId",
  requireAgent,
  validateQuery(filtreEmbarquementsSchema),
  dossierDuMarin,
);
seaServiceRouter.post(
  "/:id/verification",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  verifier,
);
seaServiceRouter.post(
  "/:id/rejet",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  validateBody(rejetEmbarquementSchema),
  rejeter,
);

export { seaServiceRouter };
