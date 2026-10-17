// Route publique de vérification. Aucun compte requis (cahier 2.2.5).
// ============================================
import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { verifyLimiter } from "../../middleware/limiteurs.js";
import { verifierCode } from "./verification.service.js";

const verificationRouter = Router();

// GET /api/verification/:code
verificationRouter.get(
  "/:code",
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const resultat = await verifierCode(String(req.params.code), req);
    res.status(200).json({ success: true, data: resultat });
  }),
);

export { verificationRouter };