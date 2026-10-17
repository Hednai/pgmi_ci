// ============================================
// features/requests/requests.route.ts
// Routes du workflow de demande.
// ============================================
import { Router } from "express";
import { requireMarin, requireActiveMarin, requireAgent } from "../../middleware/auth.js";
import { requireRole, requireTrainingInstitution } from "../../middleware/rbac.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import {
  DGAM_DECISION_ROLES,
  ARSTM_REGISTRAR_ROLES,
  AGENT_ROLE,
} from "../../domain/roles.js";
import {
  soumissionDemandeSchema,
  demandePourEleveSchema,
  paiementSchema,
  assignationSchema,
  decisionSchema,
  rejetDemandeSchema,
  complementSchema,
  filtreDemandesSchema,
} from "./requests.validation.js";
import {
  mesDemandes,
  soumettre,
  payer,
  moyensPaiement,
  preRemplissage,
  soumettrePourEleve,
  lister,
  detail,
  assigner,
  instruire,
  complement,
  approuver,
  rejeter,
  encaisser,
} from "./requests.controller.js";

const demandesRouter = Router();

// Référentiel des moyens de paiement, lu par l'écran de règlement
demandesRouter.get("/moyens-paiement", requireMarin, moyensPaiement);

// ---- Espace marin ----
demandesRouter.get("/me", requireMarin, mesDemandes);
demandesRouter.post(
  "/me",
  requireMarin,
  requireActiveMarin,
  validateBody(soumissionDemandeSchema),
  soumettre,
);
demandesRouter.post(
  "/me/:id/paiement",
  requireMarin,
  requireActiveMarin,
  validateBody(paiementSchema),
  payer,
);
demandesRouter.get("/me/pre-remplissage/:certificateTypeId", requireMarin, preRemplissage);

// ---- Module D : demande ouverte par l'ARSTM pour un élève ----
demandesRouter.post(
  "/eleves",
  requireAgent,
  requireRole(...ARSTM_REGISTRAR_ROLES),
  requireTrainingInstitution,
  validateBody(demandePourEleveSchema),
  soumettrePourEleve,
);

// ---- Instruction DGAM ----
demandesRouter.get("/", requireAgent, validateQuery(filtreDemandesSchema), lister);
demandesRouter.get("/:id", requireAgent, detail);

demandesRouter.post(
  "/:id/assignation",
  requireAgent,
  requireRole(AGENT_ROLE.DGAM_SUPERVISOR, AGENT_ROLE.PLATFORM_ADMIN),
  validateBody(assignationSchema),
  assigner,
);
demandesRouter.post(
  "/:id/instruction",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  instruire,
);
demandesRouter.post(
  "/:id/complement",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  validateBody(complementSchema),
  complement,
);
demandesRouter.post(
  "/:id/approbation",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  validateBody(decisionSchema),
  approuver,
);
demandesRouter.post(
  "/:id/rejet",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  validateBody(rejetDemandeSchema),
  rejeter,
);
demandesRouter.post(
  "/:id/encaissement",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  encaisser,
);

export { demandesRouter };
