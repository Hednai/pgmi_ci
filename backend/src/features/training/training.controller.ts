// ============================================
// features/training/training.controller.ts
// Contrôleurs du module formation ARSTM.
// ============================================
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { ENROLLMENT_SOURCE } from "../../domain/status.js";
import {
  listerSessions,
  listerSessionsOuvertes,
  creerSession,
  planifierSession,
  inscrireAFormation,
  repondreProposition,
  listerInscriptionsMarin,
  listerFileAttenteParModule,
  enregistrerResultats,
  syntheseArstm,
} from "./training.service.js";

const acteurCourant = (req: Request) => {
  if (!req.acteur) throw new UnauthorizedError();
  return req.acteur;
};

// ---- Espace marin ----

// GET /api/formations/sessions-ouvertes
export const sessionsOuvertes = asyncHandler(async (req: Request, res: Response) => {
  const certificateTypeId = req.query.certificateTypeId
    ? String(req.query.certificateTypeId)
    : undefined;
  const sessions = await listerSessionsOuvertes(certificateTypeId);
  res.status(200).json({ success: true, data: sessions });
});

// GET /api/formations/me
export const mesInscriptions = asyncHandler(async (req: Request, res: Response) => {
  const inscriptions = await listerInscriptionsMarin(acteurCourant(req).id);
  res.status(200).json({ success: true, data: inscriptions });
});

// POST /api/formations/me
export const mInscrire = asyncHandler(async (req: Request, res: Response) => {
  const inscription = await inscrireAFormation({
    marinId: acteurCourant(req).id,
    certificateTypeId: req.body.certificateTypeId,
    sessionId: req.body.sessionId,
    source: ENROLLMENT_SOURCE.MARIN,
  });
  res.status(201).json({ success: true, data: inscription });
});

// POST /api/formations/me/:id/reponse
export const repondre = asyncHandler(async (req: Request, res: Response) => {
  const inscription = await repondreProposition(
    String(req.params.id),
    acteurCourant(req).id,
    req.body.accepte,
  );
  res.status(200).json({ success: true, data: inscription });
});

// ---- Espace ARSTM ----

// GET /api/formations/sessions
export const sessions = asyncHandler(async (req: Request, res: Response) => {
  const acteur = acteurCourant(req);
  const resultat = await listerSessions(req.filtres ?? {}, acteur.authorityId);
  res.status(200).json({ success: true, data: resultat });
});

// POST /api/formations/sessions
export const ouvrirSession = asyncHandler(async (req: Request, res: Response) => {
  const session = await creerSession(req.body, acteurCourant(req));
  res.status(201).json({ success: true, data: session });
});

// POST /api/formations/sessions/:id/planification
export const planifier = asyncHandler(async (req: Request, res: Response) => {
  const session = await planifierSession(String(req.params.id), req.body, acteurCourant(req));
  res.status(200).json({ success: true, data: session });
});

// POST /api/formations/sessions/:id/resultats
export const saisirResultats = asyncHandler(async (req: Request, res: Response) => {
  const session = await enregistrerResultats(
    String(req.params.id),
    req.body.resultats,
    acteurCourant(req),
  );
  res.status(200).json({ success: true, data: session });
});

// POST /api/formations/inscriptions
export const inscrireMarinParArstm = asyncHandler(async (req: Request, res: Response) => {
  const acteur = acteurCourant(req);
  const inscription = await inscrireAFormation({
    marinId: req.body.marinId,
    certificateTypeId: req.body.certificateTypeId,
    sessionId: req.body.sessionId,
    source: ENROLLMENT_SOURCE.ARSTM,
    acteur,
  });
  res.status(201).json({ success: true, data: inscription });
});

// GET /api/formations/file-attente
export const fileAttente = asyncHandler(async (req: Request, res: Response) => {
  const acteur = acteurCourant(req);
  const file = await listerFileAttenteParModule(acteur.authorityId ?? "");
  res.status(200).json({ success: true, data: file });
});

// GET /api/formations/synthese
export const synthese = asyncHandler(async (req: Request, res: Response) => {
  const acteur = acteurCourant(req);
  const donnees = await syntheseArstm(acteur.authorityId ?? "");
  res.status(200).json({ success: true, data: donnees });
});
