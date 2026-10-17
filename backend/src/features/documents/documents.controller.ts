// ============================================
// features/documents/documents.controller.ts
// Contrôleurs de la gestion documentaire.
// ============================================
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import {
  listerDocumentsMarin,
  listerDocumentsAVerifier,
  obtenirDocument,
  deposerDocument,
  verifierDocument,
  rejeterDocument,
  revoquerDocument,
  obtenirQrDocument,
} from "./documents.service.js";

const acteurCourant = (req: Request) => {
  if (!req.acteur) throw new UnauthorizedError();
  return req.acteur;
};

// GET /api/documents/me
export const mesDocuments = asyncHandler(async (req: Request, res: Response) => {
  const documents = await listerDocumentsMarin(acteurCourant(req).id, req.filtres ?? {});
  res.status(200).json({ success: true, data: documents });
});

// POST /api/documents/me
export const deposer = asyncHandler(async (req: Request, res: Response) => {
  const document = await deposerDocument(acteurCourant(req).id, req.body);
  res.status(201).json({ success: true, data: document });
});

// GET /api/documents/me/:id/qr
export const qrCode = asyncHandler(async (req: Request, res: Response) => {
  const qr = await obtenirQrDocument(String(req.params.id), acteurCourant(req).id);
  res.status(200).json({ success: true, data: qr });
});

// GET /api/documents/a-verifier
export const aVerifier = asyncHandler(async (req: Request, res: Response) => {
  const resultat = await listerDocumentsAVerifier(req.filtres ?? {});
  res.status(200).json({ success: true, data: resultat });
});

// GET /api/documents/marin/:marinId
export const documentsDuMarin = asyncHandler(async (req: Request, res: Response) => {
  const documents = await listerDocumentsMarin(String(req.params.marinId), req.filtres ?? {});
  res.status(200).json({ success: true, data: documents });
});

// GET /api/documents/:id
export const detail = asyncHandler(async (req: Request, res: Response) => {
  const document = await obtenirDocument(String(req.params.id));
  res.status(200).json({ success: true, data: document });
});

// POST /api/documents/:id/verification
export const verifier = asyncHandler(async (req: Request, res: Response) => {
  const document = await verifierDocument(String(req.params.id), req.body, acteurCourant(req));
  res.status(200).json({ success: true, data: document });
});

// POST /api/documents/:id/rejet
export const rejeter = asyncHandler(async (req: Request, res: Response) => {
  const document = await rejeterDocument(
    String(req.params.id),
    req.body.reason,
    acteurCourant(req),
  );
  res.status(200).json({ success: true, data: document });
});

// POST /api/documents/:id/revocation
export const revoquer = asyncHandler(async (req: Request, res: Response) => {
  const document = await revoquerDocument(
    String(req.params.id),
    req.body.reason,
    acteurCourant(req),
  );
  res.status(200).json({ success: true, data: document });
});
