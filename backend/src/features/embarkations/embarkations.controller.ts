// ============================================
// features/embarkations/embarkations.controller.ts
// Contrôleurs du Sea Service Record.
// ============================================
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import {
  listerEmbarquements,
  declarerEmbarquement,
  soumettreEmbarquement,
  listerASoumettre,
  verifierEmbarquement,
  rejeterEmbarquement,
} from "./embarkations.service.js";

const acteurCourant = (req: Request) => {
  if (!req.acteur) throw new UnauthorizedError();
  return req.acteur;
};

// GET /api/sea-service/me
export const monDossier = asyncHandler(async (req: Request, res: Response) => {
  const dossier = await listerEmbarquements(acteurCourant(req).id, req.filtres ?? {});
  res.status(200).json({ success: true, data: dossier });
});

// POST /api/sea-service/me
export const declarer = asyncHandler(async (req: Request, res: Response) => {
  const embarquement = await declarerEmbarquement(acteurCourant(req).id, req.body);
  res.status(201).json({ success: true, data: embarquement });
});

// POST /api/sea-service/me/:id/preuve
export const soumettrePreuve = asyncHandler(async (req: Request, res: Response) => {
  const embarquement = await soumettreEmbarquement(
    String(req.params.id),
    acteurCourant(req).id,
    req.body.fichier,
  );
  res.status(200).json({ success: true, data: embarquement });
});

// GET /api/sea-service/a-verifier
export const aVerifier = asyncHandler(async (req: Request, res: Response) => {
  const resultat = await listerASoumettre(req.filtres ?? {});
  res.status(200).json({ success: true, data: resultat });
});

// GET /api/sea-service/marin/:marinId
export const dossierDuMarin = asyncHandler(async (req: Request, res: Response) => {
  const dossier = await listerEmbarquements(String(req.params.marinId), req.filtres ?? {});
  res.status(200).json({ success: true, data: dossier });
});

// POST /api/sea-service/:id/verification
export const verifier = asyncHandler(async (req: Request, res: Response) => {
  const embarquement = await verifierEmbarquement(String(req.params.id), acteurCourant(req));
  res.status(200).json({ success: true, data: embarquement });
});

// POST /api/sea-service/:id/rejet
export const rejeter = asyncHandler(async (req: Request, res: Response) => {
  const embarquement = await rejeterEmbarquement(
    String(req.params.id),
    req.body.reason,
    acteurCourant(req),
  );
  res.status(200).json({ success: true, data: embarquement });
});
