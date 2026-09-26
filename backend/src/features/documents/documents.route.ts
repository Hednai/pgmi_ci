// ============================================
// features/documents/documents.route.ts
// Routes de la gestion documentaire.
// Les routes marin sont préfixées /me pour ne jamais croiser les routes agent.
// ============================================
import { Router } from "express";
import { requireMarin, requireActiveMarin, requireAgent } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { DGAM_DECISION_ROLES, AGENT_ROLE } from "../../domain/roles.js";
import {
  depotDocumentSchema,
  verificationDocumentSchema,
  rejetDocumentSchema,
  revocationDocumentSchema,
  filtreDocumentsSchema,
} from "./documents.validation.js";
import {
  mesDocuments,
  deposer,
  qrCode,
  aVerifier,
  documentsDuMarin,
  detail,
  verifier,
  rejeter,
  revoquer,
} from "./documents.controller.js";

const documentsRouter = Router();

// ---- Espace marin ----
documentsRouter.get("/me", requireMarin, validateQuery(filtreDocumentsSchema), mesDocuments);
documentsRouter.post(
  "/me",
  requireMarin,
  requireActiveMarin,
  validateBody(depotDocumentSchema),
  deposer,
);
documentsRouter.get("/me/:id/qr", requireMarin, qrCode);

// ---- Agents DGAM ----
documentsRouter.get(
  "/a-verifier",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  validateQuery(filtreDocumentsSchema),
  aVerifier,
);
documentsRouter.get(
  "/marin/:marinId",
  requireAgent,
  validateQuery(filtreDocumentsSchema),
  documentsDuMarin,
);
documentsRouter.get("/:id", requireAgent, detail);

documentsRouter.post(
  "/:id/verification",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  validateBody(verificationDocumentSchema),
  verifier,
);
documentsRouter.post(
  "/:id/rejet",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  validateBody(rejetDocumentSchema),
  rejeter,
);
documentsRouter.post(
  "/:id/revocation",
  requireAgent,
  requireRole(AGENT_ROLE.DGAM_SUPERVISOR, AGENT_ROLE.PLATFORM_ADMIN),
  validateBody(revocationDocumentSchema),
  revoquer,
);

export { documentsRouter };
