// ============================================
// features/marins/marins.controller.ts
// Contrôleurs du dossier marin.
// ============================================
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { serialiserMarin, serialiserMarinResume } from "./marin.serializer.js";
import {
  obtenirMarin,
  obtenirSyntheseMarin,
  majProfil,
  majPreferences,
  listerMarins,
  activerMarin,
  suspendreMarin,
  inscrireEleveNavigant,
  listerValidationsEnAttente,
} from "./marins.service.js";

// Identité de l'appelant, refusée si le middleware n'a rien posé
const acteurCourant = (req: Request) => {
  if (!req.acteur) throw new UnauthorizedError();
  return req.acteur;
};

// GET /api/marins/me
export const monProfil = asyncHandler(async (req: Request, res: Response) => {
  const marin = await obtenirMarin(acteurCourant(req).id);
  res.status(200).json({ success: true, data: serialiserMarin(marin) });
});

// GET /api/marins/me/synthese
export const maSynthese = asyncHandler(async (req: Request, res: Response) => {
  const synthese = await obtenirSyntheseMarin(acteurCourant(req).id);
  res.status(200).json({
    success: true,
    data: { ...synthese, marin: serialiserMarin(synthese.marin) },
  });
});

// PATCH /api/marins/me
export const majMonProfil = asyncHandler(async (req: Request, res: Response) => {
  const marin = await majProfil(acteurCourant(req).id, req.body);
  res.status(200).json({ success: true, data: serialiserMarin(marin) });
});

// PATCH /api/marins/me/preferences
export const majMesPreferences = asyncHandler(async (req: Request, res: Response) => {
  const marin = await majPreferences(acteurCourant(req).id, req.body);
  res.status(200).json({ success: true, data: serialiserMarin(marin) });
});

// GET /api/marins
export const rechercher = asyncHandler(async (req: Request, res: Response) => {
  const resultat = await listerMarins(req.filtres ?? {});
  res.status(200).json({
    success: true,
    data: { ...resultat, items: resultat.items.map(serialiserMarinResume) },
  });
});

// GET /api/marins/:id
export const detailMarin = asyncHandler(async (req: Request, res: Response) => {
  const marin = await obtenirMarin(String(req.params.id));
  res.status(200).json({ success: true, data: serialiserMarin(marin) });
});

// POST /api/marins/:id/activation
export const activer = asyncHandler(async (req: Request, res: Response) => {
  const marin = await activerMarin(String(req.params.id), req.body, acteurCourant(req));
  res.status(200).json({ success: true, data: serialiserMarin(marin) });
});

// POST /api/marins/:id/suspension
export const suspendre = asyncHandler(async (req: Request, res: Response) => {
  const marin = await suspendreMarin(
    String(req.params.id),
    req.body.reason,
    acteurCourant(req),
  );
  res.status(200).json({ success: true, data: serialiserMarin(marin) });
});

// POST /api/marins/eleves (ARSTM, module C)
export const inscrireEleve = asyncHandler(async (req: Request, res: Response) => {
  const eleve = await inscrireEleveNavigant(req.body, acteurCourant(req));
  res.status(201).json({ success: true, data: serialiserMarin(eleve) });
});

// GET /api/marins/validations-attente
export const validationsEnAttente = asyncHandler(async (req: Request, res: Response) => {
  const resultat = await listerValidationsEnAttente(req.filtres ?? {});
  res.status(200).json({
    success: true,
    data: { ...resultat, items: resultat.items.map(serialiserMarinResume) },
  });
});
