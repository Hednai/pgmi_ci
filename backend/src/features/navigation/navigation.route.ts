// ============================================
// features/navigation/navigation.route.ts
// Routes du relevé de navigation.
// Espace marin uniquement : un relevé n'est ni instruit ni décidé par un
// agent, il agrège des mouvements que la DGAM a déjà vérifiés (R24).
// ============================================
import { Router } from "express";
import { requireMarin, requireActiveMarin } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { reglementSchema } from "../../services/payment/payment.validation.js";
import { mesReleves, ouvrir, payerReleve, qrReleve } from "./navigation.controller.js";

const relevesRouter = Router();

relevesRouter.get("/me", requireMarin, mesReleves);
relevesRouter.post("/me", requireMarin, requireActiveMarin, ouvrir);
relevesRouter.post(
  "/me/:id/paiement",
  requireMarin,
  requireActiveMarin,
  validateBody(reglementSchema),
  payerReleve,
);
relevesRouter.get("/me/:id/qr", requireMarin, qrReleve);

export { relevesRouter };