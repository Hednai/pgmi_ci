// ============================================
// features/referentials/referentials.route.ts
// Routes des référentiels.
// La lecture est ouverte à tout utilisateur authentifié (les formulaires en
// ont besoin) ; l'écriture est réservée à l'administrateur métier.
// ============================================
import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { requireAgent } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateBody } from "../../middleware/validate.js";
import { REFERENTIAL_ADMIN_ROLES } from "../../domain/roles.js";
import { MAX_UPLOAD_BYTES } from "../../domain/rules.js";
import { FORMATS_LIBELLE, MIME_AUTORISES } from "../../services/storage/signature.js";
import {
  fonctionSchema,
  certificateTypeSchema,
  feeScheduleSchema,
} from "./referentials.validation.js";
import {
  chargerReferentiels,
  creerFonction,
  majFonction,
  creerCertificat,
  majCertificat,
  definirBareme,
} from "./referentials.service.js";

const referentielsRouter = Router();

const acteurCourant = (req: Request) => {
  if (!req.acteur) throw new UnauthorizedError();
  return req.acteur;
};

// GET /api/referentiels
// Route publique : la page de vérification et les écrans d'inscription en
// ont besoin avant toute authentification.
referentielsRouter.get(
  "/",
  asyncHandler(async (_req: Request, res: Response) => {
    const donnees = await chargerReferentiels();
    // Référentiel peu mouvant : cache navigateur de cinq minutes
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).json({ success: true, data: donnees });
  }),
);

// GET /api/referentiels/contraintes-depot
// Contraintes appliquées aux pièces jointes, servies au client pour qu'il
// les annonce avant l'envoi. Le marin apprenait la limite de taille au
// moment du rejet, après avoir attendu la montée d'un fichier sur une
// connexion mobile.
//
// Le serveur reste la seule autorité : ces valeurs informent, elles ne
// dispensent d'aucun contrôle. Elles sont dérivées des mêmes constantes que
// la validation, donc elles ne peuvent pas en diverger.
referentielsRouter.get(
  "/contraintes-depot",
  asyncHandler(async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.status(200).json({
      success: true,
      data: {
        typesAcceptes: MIME_AUTORISES,
        formats: FORMATS_LIBELLE,
        tailleMaxOctets: MAX_UPLOAD_BYTES,
      },
    });
  }),
);

// ---- Administration métier ----
const admin = [requireAgent, requireRole(...REFERENTIAL_ADMIN_ROLES)];

referentielsRouter.post(
  "/fonctions",
  ...admin,
  validateBody(fonctionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const fonction = await creerFonction(req.body, acteurCourant(req));
    res.status(201).json({ success: true, data: fonction });
  }),
);

referentielsRouter.patch(
  "/fonctions/:id",
  ...admin,
  asyncHandler(async (req: Request, res: Response) => {
    const fonction = await majFonction(String(req.params.id), req.body, acteurCourant(req));
    res.status(200).json({ success: true, data: fonction });
  }),
);

referentielsRouter.post(
  "/certificats",
  ...admin,
  validateBody(certificateTypeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const certificat = await creerCertificat(req.body, acteurCourant(req));
    res.status(201).json({ success: true, data: certificat });
  }),
);

referentielsRouter.patch(
  "/certificats/:id",
  ...admin,
  asyncHandler(async (req: Request, res: Response) => {
    const certificat = await majCertificat(String(req.params.id), req.body, acteurCourant(req));
    res.status(200).json({ success: true, data: certificat });
  }),
);

referentielsRouter.post(
  "/baremes",
  ...admin,
  validateBody(feeScheduleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bareme = await definirBareme(req.body, acteurCourant(req));
    res.status(200).json({ success: true, data: bareme });
  }),
);

export { referentielsRouter };