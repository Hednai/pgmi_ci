// ============================================
// features/embarkations/embarkations.controller.ts
// Contrôleurs du Sea Service Record.
// ============================================
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { PIECES_SERVICE_MER } from "../../domain/piecesServiceMer.js";
import { reglerMouvement } from "../../services/payment/payment.service.js";
import {
  listerEmbarquements,
  declarerEmbarquement,
  deposerPieceEmbarquement,
  retirerPieceEmbarquement,
  soumettreEmbarquement,
  verifierDossierPayable,
  confirmerPaiementMouvement,
  demanderComplementEmbarquement,
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

// POST /api/sea-service/me/:id/pieces
export const deposerPiece = asyncHandler(async (req: Request, res: Response) => {
  const embarquement = await deposerPieceEmbarquement(
    String(req.params.id),
    acteurCourant(req).id,
    String(req.body.kind),
    req.body.fichier,
  );
  res.status(201).json({ success: true, data: embarquement });
});

// DELETE /api/sea-service/me/:id/pieces/:pieceId
export const retirerPiece = asyncHandler(async (req: Request, res: Response) => {
  const embarquement = await retirerPieceEmbarquement(
    String(req.params.id),
    String(req.params.pieceId),
    acteurCourant(req).id,
  );
  res.status(200).json({ success: true, data: embarquement });
});

// POST /api/sea-service/me/:id/soumission
export const soumettrePreuve = asyncHandler(async (req: Request, res: Response) => {
  const embarquement = await soumettreEmbarquement(
    String(req.params.id),
    acteurCourant(req).id,
  );
  res.status(200).json({ success: true, data: embarquement });
});

// POST /api/sea-service/me/:id/paiement
//
// Trois étapes explicites, dans cet ordre : le dossier est déclaré payable,
// le règlement est enregistré, puis le statut en tire les conséquences.
// Le montant n'est jamais lu dans le corps de la requête.
export const payerMouvement = asyncHandler(async (req: Request, res: Response) => {
  const embarquementId = String(req.params.id);

  const { montant, devise } = await verifierDossierPayable(
    embarquementId,
    acteurCourant(req).id,
  );

  const { paiement } = await reglerMouvement({
    embarquementId,
    montant,
    devise,
    canal: req.body.canal,
    operateur: req.body.operateur,
    telephonePayeur: req.body.telephonePayeur,
  });

  const embarquement = await confirmerPaiementMouvement(embarquementId);

  res.status(200).json({ success: true, data: { paiement, embarquement } });
});

// GET /api/sea-service/pieces-attendues
// Le référentiel est servi par l'API : l'écran ne recopie ni les libellés
// ni le caractère obligatoire des pièces.
export const piecesAttendues = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: PIECES_SERVICE_MER });
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

// POST /api/sea-service/:id/complement
export const demanderComplement = asyncHandler(async (req: Request, res: Response) => {
  const embarquement = await demanderComplementEmbarquement(
    String(req.params.id),
    req.body.reason,
    acteurCourant(req),
  );
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