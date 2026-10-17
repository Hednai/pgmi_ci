// ============================================
// features/compliance/compliance.route.ts
// Routes du moteur de conformité.
// ============================================
import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { requireMarin, requireAgent } from "../../middleware/auth.js";
import { evaluerConformite, evaluerToutesConformites } from "./compliance.service.js";

const conformiteRouter = Router();

const acteurCourant = (req: Request) => {
  if (!req.acteur) throw new UnauthorizedError();
  return req.acteur;
};

// GET /api/conformite/me
conformiteRouter.get(
  "/me",
  requireMarin,
  asyncHandler(async (req: Request, res: Response) => {
    const rapports = await evaluerToutesConformites(acteurCourant(req).id);
    res.status(200).json({ success: true, data: rapports });
  }),
);

// GET /api/conformite/me/:certificateTypeId
conformiteRouter.get(
  "/me/:certificateTypeId",
  requireMarin,
  asyncHandler(async (req: Request, res: Response) => {
    const rapport = await evaluerConformite(
      acteurCourant(req).id,
      String(req.params.certificateTypeId),
    );
    res.status(200).json({ success: true, data: rapport });
  }),
);

// GET /api/conformite/marin/:marinId
// Un agent consulte la conformité d'un marin pendant l'instruction.
conformiteRouter.get(
  "/marin/:marinId",
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    const rapports = await evaluerToutesConformites(String(req.params.marinId));
    res.status(200).json({ success: true, data: rapports });
  }),
);

export { conformiteRouter };
