// ============================================
// features/embarkations/embarkations.route.ts
// Routes du Sea Service Record.
// ============================================
import { Router } from "express";
import { requireMarin, requireActiveMarin, requireAgent } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { DGAM_DECISION_ROLES } from "../../domain/roles.js";
import { reglementSchema } from "../../services/payment/payment.validation.js";
import {
  declarationEmbarquementSchema,
  depotPieceSchema,
  rejetEmbarquementSchema,
  complementEmbarquementSchema,
  filtreEmbarquementsSchema,
} from "./embarkations.validation.js";
import {
  monDossier,
  declarer,
  deposerPiece,
  retirerPiece,
  soumettrePreuve,
  payerMouvement,
  piecesAttendues,
  aVerifier,
  dossierDuMarin,
  verifier,
  demanderComplement,
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

// Référentiel des pièces attendues. Lecture seule, ouverte à tout marin
// authentifié : c'est la source unique de la note affichée avant dépôt.
seaServiceRouter.get("/pieces-attendues", requireMarin, piecesAttendues);

// Dépôt et retrait d'une pièce, puis soumission du dossier. Les trois
// étapes sont distinctes : le marin constitue son dossier, puis l'envoie.
seaServiceRouter.post(
  "/me/:id/pieces",
  requireMarin,
  requireActiveMarin,
  validateBody(depotPieceSchema),
  deposerPiece,
);
seaServiceRouter.delete(
  "/me/:id/pieces/:pieceId",
  requireMarin,
  requireActiveMarin,
  retirerPiece,
);
seaServiceRouter.post("/me/:id/soumission", requireMarin, requireActiveMarin, soumettrePreuve);

// Règlement des frais de validation du mouvement, avant soumission (R23).
seaServiceRouter.post(
  "/me/:id/paiement",
  requireMarin,
  requireActiveMarin,
  validateBody(reglementSchema),
  payerMouvement,
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
// Demande de pièces complémentaires, gratuite pour le marin (R23). Sert
// aussi à rouvrir un dossier rejeté (R25).
seaServiceRouter.post(
  "/:id/complement",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  validateBody(complementEmbarquementSchema),
  demanderComplement,
);
seaServiceRouter.post(
  "/:id/rejet",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES),
  validateBody(rejetEmbarquementSchema),
  rejeter,
);

export { seaServiceRouter };