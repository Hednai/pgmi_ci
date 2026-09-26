// ============================================
// features/dashboard/dashboard.route.ts
// Routes du tableau de bord agent.
// ============================================
import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { requireAgent } from "../../middleware/auth.js";
import { syntheseAgent, activiteRecente } from "./dashboard.service.js";

const dashboardRouter = Router();

// GET /api/dashboard
dashboardRouter.get(
  "/",
  requireAgent,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.acteur) throw new UnauthorizedError();

    const [statistiques, activite] = await Promise.all([
      syntheseAgent(req.acteur.id),
      activiteRecente(),
    ]);

    res.status(200).json({ success: true, data: { statistiques, activite } });
  }),
);

export { dashboardRouter };
