// ============================================
// features/requests/requests.controller.ts
// Contrôleurs du workflow de demande.
// ============================================
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { SUBMITTED_BY_ROLE } from "../../domain/status.js";
import { reglerDemande, listerMoyensDePaiement } from "../../services/payment/payment.service.js";
import {
  soumettreDemande,
  soumettreDemandePourEleve,
  confirmerPaiementDemande,
  assignerDemande,
  prendreEnInstruction,
  demanderComplement,
  approuverDemande,
  rejeterDemande,
  listerDemandesMarin,
  listerDemandes,
  obtenirDemande,
  preparerDemandeApresFormation,
} from "./requests.service.js";

const acteurCourant = (req: Request) => {
  if (!req.acteur) throw new UnauthorizedError();
  return req.acteur;
};

// GET /api/demandes/me
export const mesDemandes = asyncHandler(async (req: Request, res: Response) => {
  const demandes = await listerDemandesMarin(acteurCourant(req).id);
  res.status(200).json({ success: true, data: demandes });
});

// POST /api/demandes/me
export const soumettre = asyncHandler(async (req: Request, res: Response) => {
  const demande = await soumettreDemande({
    marinId: acteurCourant(req).id,
    donnees: req.body,
    acteur: null,
    submittedByRole: SUBMITTED_BY_ROLE.MARIN,
  });
  res.status(201).json({ success: true, data: demande });
});

// POST /api/demandes/me/:id/paiement
export const payer = asyncHandler(async (req: Request, res: Response) => {
  const requestId = String(req.params.id);

  const { paiement } = await reglerDemande({
    requestId,
    canal: req.body.canal,
    operateur: req.body.operateur,
    telephonePayeur: req.body.telephonePayeur,
  });

  // Le paiement confirmé fait avancer le workflow de la demande
  const demande = await confirmerPaiementDemande(requestId);

  res.status(200).json({ success: true, data: { paiement, demande } });
});

// GET /api/demandes/moyens-paiement
export const moyensPaiement = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: listerMoyensDePaiement() });
});

// GET /api/demandes/me/pre-remplissage/:certificateTypeId
export const preRemplissage = asyncHandler(async (req: Request, res: Response) => {
  const brouillon = await preparerDemandeApresFormation(
    acteurCourant(req).id,
    String(req.params.certificateTypeId),
  );
  res.status(200).json({ success: true, data: brouillon });
});

// POST /api/demandes/eleves (ARSTM, module D)
export const soumettrePourEleve = asyncHandler(async (req: Request, res: Response) => {
  const { marinId, ...donnees } = req.body;
  const demande = await soumettreDemandePourEleve({
    marinId,
    donnees,
    acteur: acteurCourant(req),
  });
  res.status(201).json({ success: true, data: demande });
});

// GET /api/demandes
export const lister = asyncHandler(async (req: Request, res: Response) => {
  const resultat = await listerDemandes(req.filtres ?? {}, acteurCourant(req));
  res.status(200).json({ success: true, data: resultat });
});

// GET /api/demandes/:id
export const detail = asyncHandler(async (req: Request, res: Response) => {
  const demande = await obtenirDemande(String(req.params.id));
  res.status(200).json({ success: true, data: demande });
});

// POST /api/demandes/:id/assignation
export const assigner = asyncHandler(async (req: Request, res: Response) => {
  const demande = await assignerDemande(
    String(req.params.id),
    req.body.agentId,
    acteurCourant(req),
  );
  res.status(200).json({ success: true, data: demande });
});

// POST /api/demandes/:id/instruction
export const instruire = asyncHandler(async (req: Request, res: Response) => {
  const demande = await prendreEnInstruction(String(req.params.id), acteurCourant(req));
  res.status(200).json({ success: true, data: demande });
});

// POST /api/demandes/:id/complement
export const complement = asyncHandler(async (req: Request, res: Response) => {
  const demande = await demanderComplement(
    String(req.params.id),
    req.body.message,
    acteurCourant(req),
  );
  res.status(200).json({ success: true, data: demande });
});

// POST /api/demandes/:id/approbation
export const approuver = asyncHandler(async (req: Request, res: Response) => {
  const resultat = await approuverDemande(
    String(req.params.id),
    req.body.reason,
    acteurCourant(req),
  );
  res.status(200).json({ success: true, data: resultat });
});

// POST /api/demandes/:id/rejet
export const rejeter = asyncHandler(async (req: Request, res: Response) => {
  const demande = await rejeterDemande(
    String(req.params.id),
    req.body.reason,
    acteurCourant(req),
  );
  res.status(200).json({ success: true, data: demande });
});

// POST /api/demandes/:id/encaissement (guichet)
export const encaisser = asyncHandler(async (req: Request, res: Response) => {
  const requestId = String(req.params.id);
  const acteur = acteurCourant(req);

  const { paiement } = await reglerDemande({
    requestId,
    canal: "CASH",
    agentId: acteur.id,
  });

  const demande = await confirmerPaiementDemande(requestId);
  res.status(200).json({ success: true, data: { paiement, demande } });
});
