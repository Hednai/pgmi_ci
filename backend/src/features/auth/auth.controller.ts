// ============================================
// features/auth/auth.controller.ts
// Contrôleurs d'authentification. Ils coordonnent, ils ne décident pas :
// toute la logique est dans auth.service.ts.
// ============================================
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  emettreOtp,
  connecterMarin,
  inscrireMarin,
  connecterAgent,
  deconnecterAgent,
  rafraichirJeton,
} from "./auth.service.js";
import { serialiserMarin } from "../marins/marin.serializer.js";

// POST /api/auth/otp/request
export const demanderOtp = asyncHandler(async (req: Request, res: Response) => {
  const resultat = await emettreOtp(req.body.phone);
  res.status(200).json({ success: true, data: resultat });
});

// POST /api/auth/otp/verify
export const verifierOtp = asyncHandler(async (req: Request, res: Response) => {
  const { marin, accessToken, refreshToken } = await connecterMarin(
    req.body.phone,
    req.body.code,
  );

  res.status(200).json({
    success: true,
    data: { marin: serialiserMarin(marin), accessToken, refreshToken },
  });
});

// POST /api/auth/register
export const inscrire = asyncHandler(async (req: Request, res: Response) => {
  const { marin, accessToken, refreshToken } = await inscrireMarin(req.body);

  res.status(201).json({
    success: true,
    data: { marin: serialiserMarin(marin), accessToken, refreshToken },
  });
});

// POST /api/auth/agent/login
export const connexionAgent = asyncHandler(async (req: Request, res: Response) => {
  const resultat = await connecterAgent(req.body.email, req.body.password);
  res.status(200).json({ success: true, data: resultat });
});

// POST /api/auth/agent/logout
export const deconnexionAgent = asyncHandler(async (req: Request, res: Response) => {
  await deconnecterAgent(req.acteur?.id ?? "");
  res.status(200).json({ success: true, message: "Déconnexion effectuée." });
});

// POST /api/auth/refresh
export const rafraichir = asyncHandler(async (req: Request, res: Response) => {
  const resultat = await rafraichirJeton(req.body.refreshToken);
  res.status(200).json({ success: true, data: resultat });
});

// GET /api/auth/me
// Renvoie l'identité de l'appelant, quel que soit son type. Le frontend
// s'en sert au rechargement de page pour restaurer la session.
export const profilCourant = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ success: true, data: req.acteur });
});
