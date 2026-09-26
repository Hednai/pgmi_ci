// ============================================
// features/documents/documents.service.ts
// Cycle de vie du document : dépôt, vérification, délivrance, remplacement,
// révocation.
//
// Deux invariants structurent ce fichier :
//   R2, un document approuvé ne se modifie plus ;
//   R12, un renouvellement remplace l'ancien document, il ne l'efface pas.
// ============================================
import { prisma } from "../../lib/prisma.js";
import {
  DOCUMENT_STATUS,
  IMMUTABLE_DOCUMENT_STATUSES,
  VERIFIABLE_DOCUMENT_STATUSES,
} from "../../domain/status.js";
import type { DocumentStatus } from "../../domain/status.js";
import {
  generateVerificationCode,
  signQrPayload,
  buildVerificationUrl,
  generateQrDataUrl,
} from "../../lib/qrcode.js";
import { storage } from "../../services/storage/storage.service.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { NotFoundError, BusinessRuleError, ForbiddenError } from "../../utils/errors.js";
import { lirePagination, construireReponse } from "../../utils/pagination.js";
import { ajouterMois, joursAvantExpiration } from "../../utils/dates.js";
import type { Acteur } from "../../middleware/auth.js";
import { z } from "zod";
import type {
  depotDocumentSchema,
  verificationDocumentSchema,
} from "./documents.validation.js";

type DepotDocument = z.infer<typeof depotDocumentSchema>;
type VerificationDocument = z.infer<typeof verificationDocumentSchema>;

const INCLUDE_DOCUMENT = {
  certificateType: true,
  verifiedBy: { select: { firstName: true, lastName: true } },
} as const;

// Un code de vérification unique. La collision est traitée par nouvel essai
// plutôt que par une exception remontée à l'agent.
const attribuerCodeVerification = async (): Promise<string> => {
  for (let essai = 0; essai < 6; essai += 1) {
    const candidat = generateVerificationCode();
    const existant = await prisma.document.findUnique({
      where: { verificationCode: candidat },
      select: { id: true },
    });
    if (!existant) return candidat;
  }
  throw new BusinessRuleError("Impossible de générer un code de vérification.");
};

// Statut effectif d'un document à l'instant de la lecture.
// Un certificat dont la date est dépassée est présenté comme expiré sans
// qu'une tâche planifiée ait eu besoin de le réécrire (R7).
export const statutEffectif = (document: {
  status: string;
  expiryDate: Date | null;
}): DocumentStatus => {
  if (document.status !== DOCUMENT_STATUS.VERIFIED &&
      document.status !== DOCUMENT_STATUS.OFFICIAL_DIGITAL) {
    return document.status as DocumentStatus;
  }
  if (document.expiryDate && document.expiryDate.getTime() < Date.now()) {
    return DOCUMENT_STATUS.EXPIRED;
  }
  return document.status as DocumentStatus;
};

// ---- Lecture ----

export const listerDocumentsMarin = async (marinId: string, filtres: Record<string, unknown>) => {
  const documents = await prisma.document.findMany({
    where: {
      marinId,
      ...(filtres.status ? { status: String(filtres.status) } : {}),
      ...(filtres.category
        ? { certificateType: { category: String(filtres.category) } }
        : {}),
    },
    include: INCLUDE_DOCUMENT,
    orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
  });

  return documents.map((document) => ({
    ...document,
    statutEffectif: statutEffectif(document),
    joursRestants: document.expiryDate ? joursAvantExpiration(document.expiryDate) : null,
  }));
};

export const listerDocumentsAVerifier = async (filtres: Record<string, unknown>) => {
  const pagination = lirePagination(filtres);
  const where = { status: DOCUMENT_STATUS.SCANNED };

  const [items, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        ...INCLUDE_DOCUMENT,
        marin: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      },
      orderBy: { createdAt: "asc" },
      skip: pagination.skip,
      take: pagination.taille,
    }),
    prisma.document.count({ where }),
  ]);

  return construireReponse(items, total, pagination);
};

export const obtenirDocument = async (documentId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      ...INCLUDE_DOCUMENT,
      marin: { select: { id: true, firstName: true, lastName: true, matricule: true } },
    },
  });
  if (!document) throw new NotFoundError("Document introuvable.");
  return document;
};

// ---- Dépôt par le marin ----

// Le document déposé est en SCANNED : il n'a aucune valeur probante tant
// qu'un agent DGAM ne l'a pas contrôlé.
export const deposerDocument = async (marinId: string, donnees: DepotDocument) => {
  const type = await prisma.certificateType.findUnique({
    where: { id: donnees.certificateTypeId },
  });
  if (!type?.isActive) throw new NotFoundError("Type de certificat inconnu.");

  let fileUrl: string | null = null;
  if (donnees.fichier) {
    const stocke = await storage.enregistrer(`marins/${marinId}/documents`, donnees.fichier);
    fileUrl = stocke.url;
  }

  const document = await prisma.document.create({
    data: {
      marinId,
      certificateTypeId: type.id,
      number: donnees.number ?? null,
      issueDate: donnees.issueDate ?? null,
      // Si le marin ne connaît pas la date d'expiration, elle est déduite de
      // la durée de validité du référentiel.
      expiryDate:
        donnees.expiryDate ??
        (donnees.issueDate && type.validityMonths
          ? ajouterMois(donnees.issueDate, type.validityMonths)
          : null),
      issuedPlace: donnees.issuedPlace ?? null,
      status: DOCUMENT_STATUS.SCANNED,
      fileUrl,
    },
    include: INCLUDE_DOCUMENT,
  });

  await logAction({
    actorType: "MARIN",
    actorId: marinId,
    action: AUDIT_ACTION.DOCUMENT_UPLOAD,
    targetType: "Document",
    targetId: document.id,
    metadata: { certificat: type.code },
  });

  return document;
};

// ---- Vérification par un agent DGAM ----

// Passage SCANNED vers VERIFIED. Le QR code n'est généré qu'ici : un
// document non contrôlé ne peut pas produire de preuve vérifiable.
export const verifierDocument = async (
  documentId: string,
  donnees: VerificationDocument,
  acteur: Acteur,
) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { certificateType: true },
  });
  if (!document) throw new NotFoundError("Document introuvable.");

  if (IMMUTABLE_DOCUMENT_STATUSES.includes(document.status as DocumentStatus)) {
    throw new BusinessRuleError("Ce document est déjà traité et ne peut plus être modifié.", "R2");
  }

  const code = document.verificationCode ?? (await attribuerCodeVerification());

  const actualise = await prisma.document.update({
    where: { id: documentId },
    data: {
      status: DOCUMENT_STATUS.VERIFIED,
      number: donnees.number ?? document.number,
      issueDate: donnees.issueDate ?? document.issueDate,
      expiryDate: donnees.expiryDate ?? document.expiryDate,
      verificationCode: code,
      qrToken: signQrPayload({ documentId, code, issuedAt: Date.now() }),
      verifiedById: acteur.id,
      verifiedAt: new Date(),
    },
    include: INCLUDE_DOCUMENT,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.DOCUMENT_VERIFY,
    targetType: "Document",
    targetId: documentId,
    metadata: { methode: donnees.methode, code },
  });

  return actualise;
};

export const rejeterDocument = async (documentId: string, motif: string, acteur: Acteur) => {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new NotFoundError("Document introuvable.");

  if (IMMUTABLE_DOCUMENT_STATUSES.includes(document.status as DocumentStatus)) {
    throw new BusinessRuleError("Ce document ne peut plus être modifié.", "R2");
  }

  const actualise = await prisma.document.update({
    where: { id: documentId },
    data: { status: DOCUMENT_STATUS.REJECTED, revokedReason: motif },
    include: INCLUDE_DOCUMENT,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.DOCUMENT_REJECT,
    targetType: "Document",
    targetId: documentId,
    metadata: { motif },
  });

  return actualise;
};

// Révocation d'un document déjà valide. Le document n'est jamais supprimé :
// son QR code continue de répondre, en annonçant la révocation.
export const revoquerDocument = async (documentId: string, motif: string, acteur: Acteur) => {
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) throw new NotFoundError("Document introuvable.");

  if (!VERIFIABLE_DOCUMENT_STATUSES.includes(document.status as DocumentStatus)) {
    throw new BusinessRuleError("Seul un document valide peut être révoqué.");
  }

  const actualise = await prisma.document.update({
    where: { id: documentId },
    data: { status: DOCUMENT_STATUS.REVOKED, revokedReason: motif },
    include: INCLUDE_DOCUMENT,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.DOCUMENT_REVOKE,
    targetType: "Document",
    targetId: documentId,
    metadata: { motif },
  });

  return actualise;
};

// ---- Délivrance à l'issue d'une demande approuvée ----

// Crée le document officiel numérique et chaîne l'ancien en REPLACED (R12).
// Appelée par le service des demandes, jamais directement par une route.
export const delivrerDocumentOfficiel = async (parametres: {
  marinId: string;
  certificateTypeId: string;
  sourceDocumentId?: string | null;
  acteur: Acteur;
  reference: string;
}) => {
  const type = await prisma.certificateType.findUnique({
    where: { id: parametres.certificateTypeId },
  });
  if (!type) throw new NotFoundError("Type de certificat inconnu.");

  const code = await attribuerCodeVerification();
  const emission = new Date();

  const document = await prisma.document.create({
    data: {
      marinId: parametres.marinId,
      certificateTypeId: type.id,
      issueDate: emission,
      expiryDate: type.validityMonths ? ajouterMois(emission, type.validityMonths) : null,
      issuedPlace: "Abidjan",
      status: DOCUMENT_STATUS.OFFICIAL_DIGITAL,
      verificationCode: code,
      verifiedById: parametres.acteur.id,
      verifiedAt: emission,
    },
    include: INCLUDE_DOCUMENT,
  });

  await prisma.document.update({
    where: { id: document.id },
    data: { qrToken: signQrPayload({ documentId: document.id, code, issuedAt: Date.now() }) },
  });

  // Chaînage de version : l'ancien document reste consultable et son QR
  // annonce qu'il a été remplacé.
  if (parametres.sourceDocumentId) {
    await prisma.document.update({
      where: { id: parametres.sourceDocumentId },
      data: { status: DOCUMENT_STATUS.REPLACED, replacedById: document.id },
    });

    await logAction({
      actorType: "AGENT",
      actorId: parametres.acteur.id,
      actorLabel: parametres.acteur.label,
      action: AUDIT_ACTION.DOCUMENT_REPLACE,
      targetType: "Document",
      targetId: parametres.sourceDocumentId,
      metadata: { remplacePar: document.id },
    });
  }

  await logAction({
    actorType: "AGENT",
    actorId: parametres.acteur.id,
    actorLabel: parametres.acteur.label,
    action: AUDIT_ACTION.DOCUMENT_ISSUE,
    targetType: "Document",
    targetId: document.id,
    metadata: { certificat: type.code, demande: parametres.reference, code },
  });

  return document;
};

// ---- QR code ----

// Données du QR code d'un document, destinées à l'affichage côté marin.
export const obtenirQrDocument = async (documentId: string, marinId: string) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: { certificateType: true },
  });
  if (!document) throw new NotFoundError("Document introuvable.");
  if (document.marinId !== marinId) {
    throw new ForbiddenError("Ce document ne figure pas dans votre dossier.");
  }
  if (!document.verificationCode) {
    throw new BusinessRuleError("Ce document n'a pas encore été vérifié par la DGAM.");
  }

  return {
    code: document.verificationCode,
    url: buildVerificationUrl(document.verificationCode),
    image: await generateQrDataUrl(document.verificationCode),
    certificat: document.certificateType.label,
    statut: statutEffectif(document),
  };
};
