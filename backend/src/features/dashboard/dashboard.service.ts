// ============================================
// features/dashboard/dashboard.service.ts
// Indicateurs du poste agent DGAM.
//
// Chaque chiffre est un count SQL : aucune liste n'est chargée en mémoire
// pour être comptée côté application.
// ============================================
import { prisma } from "../../lib/prisma.js";
import {
  MARIN_STATUS,
  REQUEST_STATUS,
  DOCUMENT_STATUS,
  EMBARKATION_STATUS,
} from "../../domain/status.js";
import { EXPIRY_WARNING_WINDOW_DAYS } from "../../domain/rules.js";

// Début de la journée courante, borne des compteurs quotidiens
const debutDuJour = () => {
  const maintenant = new Date();
  return new Date(
    Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate()),
  );
};

export const syntheseAgent = async (agentId: string) => {
  const maintenant = new Date();
  const limiteAlerte = new Date(
    maintenant.getTime() + EXPIRY_WARNING_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const [
    marinsActifs,
    marinsEnAttente,
    demandesAInstruire,
    mesDossiers,
    documentsAVerifier,
    embarquementsAVerifier,
    certificatsExpires,
    certificatsBientotExpires,
    verificationsDuJour,
    elevesArstmEnAttente,
  ] = await Promise.all([
    prisma.marin.count({ where: { status: MARIN_STATUS.ACTIVE } }),
    prisma.marin.count({ where: { status: MARIN_STATUS.PENDING } }),
    prisma.renewalRequest.count({
      where: {
        status: { in: [REQUEST_STATUS.SUBMITTED, REQUEST_STATUS.ASSIGNED, REQUEST_STATUS.IN_REVIEW] },
      },
    }),
    prisma.renewalRequest.count({
      where: {
        assignedToId: agentId,
        status: { in: [REQUEST_STATUS.ASSIGNED, REQUEST_STATUS.IN_REVIEW, REQUEST_STATUS.INFO_REQUESTED] },
      },
    }),
    prisma.document.count({ where: { status: DOCUMENT_STATUS.SCANNED } }),
    prisma.embarkation.count({ where: { status: EMBARKATION_STATUS.SUBMITTED } }),
    prisma.document.count({
      where: {
        status: { in: [DOCUMENT_STATUS.VERIFIED, DOCUMENT_STATUS.OFFICIAL_DIGITAL] },
        expiryDate: { lt: maintenant },
      },
    }),
    prisma.document.count({
      where: {
        status: { in: [DOCUMENT_STATUS.VERIFIED, DOCUMENT_STATUS.OFFICIAL_DIGITAL] },
        expiryDate: { gte: maintenant, lte: limiteAlerte },
      },
    }),
    prisma.qRVerificationLog.count({ where: { createdAt: { gte: debutDuJour() } } }),
    prisma.marin.count({ where: { status: MARIN_STATUS.PENDING_DGAM_VALIDATION } }),
  ]);

  return {
    marinsActifs,
    marinsEnAttente,
    demandesAInstruire,
    mesDossiers,
    documentsAVerifier,
    embarquementsAVerifier,
    certificatsExpires,
    certificatsBientotExpires,
    verificationsDuJour,
    elevesArstmEnAttente,
  };
};

// Activité récente, affichée en colonne droite du tableau de bord agent
export const activiteRecente = async (limite = 10) => {
  const entrees = await prisma.auditLog.findMany({
    where: { actorType: { in: ["AGENT", "SYSTEM"] } },
    orderBy: { createdAt: "desc" },
    take: limite,
    select: {
      id: true,
      action: true,
      actorLabel: true,
      targetType: true,
      targetId: true,
      createdAt: true,
    },
  });

  return entrees;
};
