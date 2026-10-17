// ============================================
// features/marins/marins.route.ts
// Routes du dossier marin.
//
// Deux sous-ensembles montés sur le même préfixe :
//   - /me* : accessible au marin authentifié ;
//   - le reste : réservé aux agents, avec un RBAC par intention métier.
// ============================================
import { Router } from "express";
import { requireMarin, requireAgent } from "../../middleware/auth.js";
import {
  requireRole,
  requirePermission,
  requireTrainingInstitution,
} from "../../middleware/rbac.js";
import { PERMISSION } from "../../domain/permissions.js";
import { validateBody, validateQuery } from "../../middleware/validate.js";
import { DGAM_DECISION_ROLES, ARSTM_REGISTRAR_ROLES, AGENT_ROLE } from "../../domain/roles.js";
import {
  majProfilSchema,
  majPreferencesSchema,
  rechercheMarinsSchema,
  activationSchema,
  inscriptionEleveSchema,
  suspensionSchema,
  photoProfilSchema,
} from "./marins.validation.js";
import {
  monProfil,
  maSynthese,
  majMonProfil,
  majMesPreferences,
  deposerMaPhoto,
  supprimerMaPhoto,
  rechercher,
  detailMarin,
  activer,
  suspendre,
  inscrireEleve,
  validationsEnAttente,
} from "./marins.controller.js";

const marinsRouter = Router();

// ---- Espace marin ----
marinsRouter.get("/me", requireMarin, monProfil);
marinsRouter.get("/me/synthese", requireMarin, maSynthese);
marinsRouter.patch("/me", requireMarin, validateBody(majProfilSchema), majMonProfil);
marinsRouter.patch(
  "/me/preferences",
  requireMarin,
  validateBody(majPreferencesSchema),
  majMesPreferences,
);

// Photo de profil (remarque PGMI-02). Déclarées avant /:id pour ne pas être
// captées par la route paramétrée des agents.
marinsRouter.post(
  "/me/photo",
  requireMarin,
  validateBody(photoProfilSchema),
  deposerMaPhoto,
);
marinsRouter.delete("/me/photo", requireMarin, supprimerMaPhoto);

// ---- Module C : inscription d'un élève navigant par l'ARSTM ----
// Déclaré avant /:id pour ne pas être capté par la route paramétrée.
marinsRouter.post(
  "/eleves",
  requireAgent,
  requireRole(...ARSTM_REGISTRAR_ROLES),
  requireTrainingInstitution,
  validateBody(inscriptionEleveSchema),
  inscrireEleve,
);

// File d'attente de validation DGAM des inscriptions ARSTM (R20)
marinsRouter.get(
  "/validations-attente",
  requireAgent,
  requireRole(...DGAM_DECISION_ROLES, AGENT_ROLE.PLATFORM_ADMIN),
  validateQuery(rechercheMarinsSchema),
  validationsEnAttente,
);

// ---- Guichet DGAM ----
marinsRouter.get(
  "/",
  requireAgent,
  requirePermission(PERMISSION.MARIN_RECHERCHER),
  validateQuery(rechercheMarinsSchema),
  rechercher,
);
marinsRouter.get(
  "/:id",
  requireAgent,
  requirePermission(PERMISSION.MARIN_CONSULTER),
  detailMarin,
);

// L'activation et l'attribution du matricule restent DGAM (R1, R20) :
// aucun rôle ARSTM n'est admis ici.
marinsRouter.post(
  "/:id/activation",
  requireAgent,
  requirePermission(PERMISSION.MARIN_ACTIVER),
  validateBody(activationSchema),
  activer,
);

marinsRouter.post(
  "/:id/suspension",
  requireAgent,
  requirePermission(PERMISSION.MARIN_SUSPENDRE),
  validateBody(suspensionSchema),
  suspendre,
);

export { marinsRouter };