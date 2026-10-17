// ============================================
// features/verification/verification.route.ts
// Route publique de vérification. Aucun compte requis (cahier 2.2.5).
// ============================================
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { RATE_LIMIT } from "../../config/constants.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { verifierCode } from "./verification.service.js";

const verificationRouter = Router();

// Plafond large : un inspecteur d'armement scanne parfois tout un équipage
// en quelques minutes depuis la même connexion.
const verifyLimiter = rateLimit({
  windowMs: RATE_LIMIT.FENETRE_MS,
  limit: RATE_LIMIT.VERIFY_MAX,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Trop de vérifications. Réessayez dans quelques minutes." },
});

// GET /api/verification/:code
verificationRouter.get(
  "/:code",
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const resultat = await verifierCode(String(req.params.code), req);

    // Cache court côté navigateur : un rescan immédiat du même code ne
    // repart pas en base, sans masquer une révocation récente.
    res.setHeader("Cache-Control", "public, max-age=30");
    res.status(200).json({ success: true, data: resultat });
  }),
);

export { verificationRouter };
