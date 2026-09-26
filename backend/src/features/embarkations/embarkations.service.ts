// ============================================
// features/embarkations/embarkations.service.ts
// Sea Service Record : déclaration, soumission de preuve, vérification.
//
// Règle structurante (R4) : seuls les jours vérifiés par un agent DGAM
// comptent. Les jours déclarés sont affichés au marin, mais n'entrent
// jamais dans le calcul de conformité.
// ============================================
import { prisma } from "../../lib/prisma.js";
import { EMBARKATION_STATUS } from "../../domain/status.js";
import { calculerJoursEmbarquement } from "../../utils/dates.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { storage } from "../../services/storage/storage.service.js";
import { NotFoundError, BusinessRuleError, ForbiddenError } from "../../utils/errors.js";
import { lirePagination, construireReponse } from "../../utils/pagination.js";
import type { Acteur } from "../../middleware/auth.js";

const INCLUDE_EMBARQUEMENT = {
  fonction: true,
  verifiedBy: { select: { firstName: true, lastName: true } },
} as const;

// Totaux du dossier de service en mer, exposés au marin et au moteur de
// conformité. Les deux lisent la même fonction, donc le même chiffre.
export const calculerTotaux = async (marinId: string) => {
  const [verifies, enAttente, nombre] = await Promise.all([
    prisma.embarkation.aggregate({
      where: { marinId, status: EMBARKATION_STATUS.VERIFIED },
      _sum: { days: true },
    }),
    prisma.embarkation.aggregate({
      where: {
        marinId,
        status: { in: [EMBARKATION_STATUS.DECLARED, EMBARKATION_STATUS.SUBMITTED] },
      },
      _sum: { days: true },
    }),
    prisma.embarkation.count({ where: { marinId } }),
  ]);

  return {
    joursVerifies: verifies._sum.days ?? 0,
    joursEnAttente: enAttente._sum.days ?? 0,
    embarquements: nombre,
  };
};

export const listerEmbarquements = async (marinId: string, filtres: Record<string, unknown>) => {
  const embarquements = await prisma.embarkation.findMany({
    where: {
      marinId,
      ...(filtres.status ? { status: String(filtres.status) } : {}),
    },
    include: INCLUDE_EMBARQUEMENT,
    orderBy: { startDate: "desc" },
  });

  return { embarquements, totaux: await calculerTotaux(marinId) };
};

// Déclarer un embarquement. Le nombre de jours est recalculé ici et nulle
// part ailleurs.
export const declarerEmbarquement = async (
  marinId: string,
  donnees: {
    vesselName: string;
    imoNumber?: string;
    flag?: string;
    vesselType?: string;
    fonctionId?: string;
    startDate: Date;
    endDate: Date;
  },
) => {
  const embarquement = await prisma.embarkation.create({
    data: {
      marinId,
      vesselName: donnees.vesselName,
      imoNumber: donnees.imoNumber && donnees.imoNumber.length > 0 ? donnees.imoNumber : null,
      flag: donnees.flag ?? null,
      vesselType: donnees.vesselType ?? null,
      fonctionId: donnees.fonctionId ?? null,
      startDate: donnees.startDate,
      endDate: donnees.endDate,
      days: calculerJoursEmbarquement(donnees.startDate, donnees.endDate),
      status: EMBARKATION_STATUS.DECLARED,
    },
    include: INCLUDE_EMBARQUEMENT,
  });

  return embarquement;
};

// Joindre une preuve (attestation d'armateur, page du discharge book) et
// soumettre l'embarquement à vérification.
export const soumettreEmbarquement = async (
  embarquementId: string,
  marinId: string,
  fichier: { nom: string; mimeType: string; contenuBase64: string },
) => {
  const embarquement = await prisma.embarkation.findUnique({ where: { id: embarquementId } });
  if (!embarquement) throw new NotFoundError("Embarquement introuvable.");
  if (embarquement.marinId !== marinId) {
    throw new ForbiddenError("Cet embarquement ne figure pas dans votre dossier.");
  }
  if (embarquement.status === EMBARKATION_STATUS.VERIFIED) {
    throw new BusinessRuleError("Cet embarquement est déjà vérifié.");
  }

  const stocke = await storage.enregistrer(`marins/${marinId}/sea-service`, fichier);

  const actualise = await prisma.embarkation.update({
    where: { id: embarquementId },
    data: { proofUrl: stocke.url, status: EMBARKATION_STATUS.SUBMITTED, rejectReason: null },
    include: INCLUDE_EMBARQUEMENT,
  });

  await logAction({
    actorType: "MARIN",
    actorId: marinId,
    action: AUDIT_ACTION.EMBARKATION_SUBMIT,
    targetType: "Embarkation",
    targetId: embarquementId,
    metadata: { navire: embarquement.vesselName, jours: embarquement.days },
  });

  return actualise;
};

// File des embarquements à contrôler par un agent DGAM
export const listerASoumettre = async (filtres: Record<string, unknown>) => {
  const pagination = lirePagination(filtres);
  const where = { status: EMBARKATION_STATUS.SUBMITTED };

  const [items, total] = await Promise.all([
    prisma.embarkation.findMany({
      where,
      include: {
        ...INCLUDE_EMBARQUEMENT,
        marin: { select: { id: true, firstName: true, lastName: true, matricule: true } },
      },
      orderBy: { createdAt: "asc" },
      skip: pagination.skip,
      take: pagination.taille,
    }),
    prisma.embarkation.count({ where }),
  ]);

  return construireReponse(items, total, pagination);
};

// Vérifier un embarquement : ses jours deviennent comptabilisables (R4)
export const verifierEmbarquement = async (embarquementId: string, acteur: Acteur) => {
  const embarquement = await prisma.embarkation.findUnique({ where: { id: embarquementId } });
  if (!embarquement) throw new NotFoundError("Embarquement introuvable.");

  if (embarquement.status !== EMBARKATION_STATUS.SUBMITTED) {
    throw new BusinessRuleError(
      "Seul un embarquement soumis avec preuve peut être vérifié.",
      "R4",
    );
  }

  const actualise = await prisma.embarkation.update({
    where: { id: embarquementId },
    data: {
      status: EMBARKATION_STATUS.VERIFIED,
      verifiedById: acteur.id,
      verifiedAt: new Date(),
      // Recalcul de sécurité : les dates ont pu être corrigées entre-temps
      days: calculerJoursEmbarquement(embarquement.startDate, embarquement.endDate),
    },
    include: INCLUDE_EMBARQUEMENT,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.EMBARKATION_VERIFY,
    targetType: "Embarkation",
    targetId: embarquementId,
    metadata: { navire: embarquement.vesselName, jours: actualise.days },
  });

  return actualise;
};

export const rejeterEmbarquement = async (
  embarquementId: string,
  motif: string,
  acteur: Acteur,
) => {
  const actualise = await prisma.embarkation.update({
    where: { id: embarquementId },
    data: { status: EMBARKATION_STATUS.REJECTED, rejectReason: motif },
    include: INCLUDE_EMBARQUEMENT,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.EMBARKATION_REJECT,
    targetType: "Embarkation",
    targetId: embarquementId,
    metadata: { motif },
  });

  return actualise;
};
