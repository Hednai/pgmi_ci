// ============================================
// features/navigation/navigation.controller.ts
// Contrôleurs du relevé de navigation.
// ============================================
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { reglerReleve } from "../../services/payment/payment.service.js";
import {
  consulterReleves,
  ouvrirReleve,
  verifierRelevePayable,
  delivrerReleve,
  obtenirQrReleve,
} from "./navigation.service.js";

const acteurCourant = (req: Request) => {
  if (!req.acteur) throw new UnauthorizedError();
  return req.acteur;
};

// GET /api/releves/me
export const mesReleves = asyncHandler(async (req: Request, res: Response) => {
  const donnees = await consulterReleves(acteurCourant(req).id);
  res.status(200).json({ success: true, data: donnees });
});

// POST /api/releves/me
// Ouvre une édition et en fige le contenu. Un relevé gratuit est délivré
// dans la foulée, les autres attendent leur règlement.
export const ouvrir = asyncHandler(async (req: Request, res: Response) => {
  const ouvert = await ouvrirReleve(acteurCourant(req).id);
  const releve = await delivrerReleve(ouvert.id);
  res.status(201).json({ success: true, data: releve });
});

// POST /api/releves/me/:id/paiement
//
// Trois étapes explicites, comme pour un mouvement : le relevé est déclaré
// payable, le règlement est enregistré, puis la délivrance en tire les
// conséquences. Le montant n'est jamais lu dans le corps de la requête.
export const payerReleve = asyncHandler(async (req: Request, res: Response) => {
  const releveId = String(req.params.id);

  const { montant, devise } = await verifierRelevePayable(
    releveId,
    acteurCourant(req).id,
  );

  const { paiement } = await reglerReleve({
    releveId,
    montant,
    devise,
    canal: req.body.canal,
    operateur: req.body.operateur,
    telephonePayeur: req.body.telephonePayeur,
  });

  const releve = await delivrerReleve(releveId);

  res.status(200).json({ success: true, data: { paiement, releve } });
});

// GET /api/releves/me/:id/qr
export const qrReleve = asyncHandler(async (req: Request, res: Response) => {
  const qr = await obtenirQrReleve(String(req.params.id), acteurCourant(req).id);
  res.status(200).json({ success: true, data: qr });
});