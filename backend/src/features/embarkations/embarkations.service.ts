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
import {
  NotFoundError,
  BusinessRuleError,
  ForbiddenError,
  ValidationError,
} from "../../utils/errors.js";
import { lirePagination, construireReponse } from "../../utils/pagination.js";
import { logger } from "../../lib/logger.js";
import { notifierMarin, NOTIFICATION_EVENT } from "../../services/notification/notification.service.js";
import { diffuser } from "../../services/realtime/realtime.service.js";
import { EVENEMENT } from "../../domain/evenements.js";
import {
  definitionPiece,
  piecesObligatoiresManquantes,
} from "../../domain/piecesServiceMer.js";
import {
  planifierSuppression,
  supprimerMaintenant,
  MOTIF_SUPPRESSION,
} from "../../services/storage/suppressionDifferee.js";
import type { ClientSuppression } from "../../services/storage/suppressionDifferee.js";
import type { Acteur } from "../../middleware/auth.js";

const INCLUDE_EMBARQUEMENT = {
  fonction: true,
  verifiedBy: { select: { firstName: true, lastName: true } },
  // Pièces justificatives, de la plus ancienne à la plus récente.
  proofs: { orderBy: { uploadedAt: "asc" as const } },
  // Historique des soumissions et des décisions, du plus ancien au plus
  // récent : l'écran du marin peut ainsi montrer le motif d'un rejet
  // précédent à côté de la preuve qu'il vient de redéposer.
  events: { orderBy: { createdAt: "asc" as const } },
} as const;

// Consigner un événement d'embarquement. Appelé à chaque changement de
// statut : l'historique se construit au fil de l'eau, il n'est jamais
// reconstitué après coup. Un échec d'écriture ne doit pas annuler l'action
// métier, il est donc avalé et journalisé.
const consignerEvenement = async (parametres: {
  embarkationId: string;
  status: string;
  reason?: string | null;
  acteur?: Acteur;
}): Promise<void> => {
  try {
    await prisma.embarkationEvent.create({
      data: {
        embarkationId: parametres.embarkationId,
        status: parametres.status,
        reason: parametres.reason ?? null,
        actorType: parametres.acteur?.type ?? "MARIN",
        actorId: parametres.acteur?.id ?? null,
        actorLabel: parametres.acteur?.label ?? null,
      },
    });
  } catch (err) {
    logger.warn({ err, embarkationId: parametres.embarkationId }, "Evenement d'embarquement non consigne");
  }
};

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

  await consignerEvenement({
    embarkationId: embarquement.id,
    status: EMBARKATION_STATUS.DECLARED,
  });

  // La déclaration est journalisée et diffusée : les écrans ouverts sur le
  // dossier voient la ligne apparaître sans rechargement.
  await logAction({
    actorType: "MARIN",
    actorId: marinId,
    action: AUDIT_ACTION.EMBARKATION_DECLARE,
    targetType: "Embarkation",
    targetId: embarquement.id,
    metadata: { navire: embarquement.vesselName, jours: embarquement.days },
  });

  diffuser({
    evenement: EVENEMENT.EMBARQUEMENT_STATUT,
    donnees: {
      embarquementId: embarquement.id,
      statut: EMBARKATION_STATUS.DECLARED,
      navire: embarquement.vesselName,
    },
    marinId,
  });

  return embarquement;
};

// Embarquement du marin, contrôlé : existence, appartenance au dossier,
// et possibilité de le modifier encore. Les trois contrôles étaient écrits
// dans la soumission ; le dépôt de pièce en a besoin à l'identique.
const embarquementModifiable = async (embarquementId: string, marinId: string) => {
  const embarquement = await prisma.embarkation.findUnique({
    where: { id: embarquementId },
    include: { proofs: true },
  });

  if (!embarquement) throw new NotFoundError("Embarquement introuvable.");

  if (embarquement.marinId !== marinId) {
    throw new ForbiddenError("Cet embarquement ne figure pas dans votre dossier.");
  }

  if (embarquement.status === EMBARKATION_STATUS.VERIFIED) {
    throw new BusinessRuleError("Cet embarquement est déjà vérifié.");
  }

  return embarquement;
};

// Déposer une pièce justificative. Le dépôt ne soumet rien : le marin
// constitue son dossier pièce par pièce, puis le soumet quand il est
// complet. Séparer les deux permet d'annoncer précisément ce qui manque.
export const deposerPieceEmbarquement = async (
  embarquementId: string,
  marinId: string,
  kind: string,
  fichier: { nom: string; mimeType: string; contenuBase64: string },
) => {
  const embarquement = await embarquementModifiable(embarquementId, marinId);

  const definition = definitionPiece(kind);
  if (!definition) {
    throw new ValidationError("Type de pièce justificative inconnu.");
  }

  // Pièce à exemplaire unique déjà déposée : elle sera remplacée. Laisser
  // s'accumuler des pièces d'identité remplacées serait une conservation
  // sans motif.
  const remplacee = definition.multiple
    ? undefined
    : embarquement.proofs.find(function (piece) {
        return piece.kind === kind;
      });

  // ORDRE CRITIQUE, à ne pas inverser.
  //
  // Le nouveau fichier est stocké AVANT que l'ancien ne soit retiré. La
  // base et le stockage objet ne partagent pas de transaction : supprimer
  // d'abord laissait le marin sans aucune pièce si le dépôt échouait
  // ensuite. Sur un remplacement de page de livret maritime, c'est une
  // perte de pièce justificative, pas un désagrément.
  const stocke = await storage.enregistrer(`marins/${marinId}/sea-service`, fichier);

  try {
    // La création de la nouvelle ligne et la suppression de l'ancienne sont
    // atomiques, ainsi que l'inscription du fichier remplacé à la file de
    // suppression : soit les trois, soit aucune.
    await prisma.$transaction(async function (tx) {
      await tx.embarkationProof.create({
        data: {
          embarkationId: embarquementId,
          kind,
          fileUrl: stocke.url,
          fileName: stocke.nom,
          mimeType: stocke.mimeType,
          size: stocke.taille,
        },
      });

      if (remplacee) {
        await tx.embarkationProof.delete({ where: { id: remplacee.id } });
        await planifierSuppression(
          remplacee.fileUrl,
          MOTIF_SUPPRESSION.REMPLACEMENT,
          tx as unknown as ClientSuppression,
        );
      }
    });
  } catch (err) {
    // Compensation : le fichier vient d'être déposé alors que la base a
    // refusé. Sans ce rattrapage, il resterait orphelin dans le bucket.
    await supprimerMaintenant(stocke.url, MOTIF_SUPPRESSION.COMPENSATION);
    throw err;
  }

  return prisma.embarkation.findUniqueOrThrow({
    where: { id: embarquementId },
    include: INCLUDE_EMBARQUEMENT,
  });
};

// Retirer une pièce avant soumission.
export const retirerPieceEmbarquement = async (
  embarquementId: string,
  pieceId: string,
  marinId: string,
) => {
  const embarquement = await embarquementModifiable(embarquementId, marinId);

  const piece = embarquement.proofs.find(function (valeur) {
    return valeur.id === pieceId;
  });

  if (!piece) throw new NotFoundError("Pièce justificative introuvable.");

  // La ligne est retirée et le fichier inscrit à la file de suppression
  // dans la même transaction. Le retrait ne doit pas échouer parce que le
  // stockage est momentanément injoignable : le travail de nettoyage
  // rattrapera, et la base fait foi entre-temps.
  await prisma.$transaction(async function (tx) {
    await tx.embarkationProof.delete({ where: { id: piece.id } });
    await planifierSuppression(
      piece.fileUrl,
      MOTIF_SUPPRESSION.RETRAIT,
      tx as unknown as ClientSuppression,
    );
  });

  return prisma.embarkation.findUniqueOrThrow({
    where: { id: embarquementId },
    include: INCLUDE_EMBARQUEMENT,
  });
};

// Soumettre l'embarquement à vérification, une fois les pièces déposées.
export const soumettreEmbarquement = async (embarquementId: string, marinId: string) => {
  const embarquement = await embarquementModifiable(embarquementId, marinId);

  // Les pièces historiques n'ont pas de type : un embarquement déclaré
  // avant la gestion multi-pièces et déjà pourvu d'un proofUrl reste
  // soumissible, sinon la correction casserait des dossiers en cours.
  const heritee = Boolean(embarquement.proofUrl) && embarquement.proofs.length === 0;
  const manquantes = heritee ? [] : piecesObligatoiresManquantes(embarquement.proofs);

  if (manquantes.length > 0) {
    const libelles = manquantes
      .map(function (code) {
        return definitionPiece(code)?.libelle ?? code;
      })
      .join(" ; ");

    throw new BusinessRuleError(
      `Dossier incomplet. Pièces obligatoires manquantes : ${libelles}.`,
      "R11",
    );
  }

  const actualise = await prisma.embarkation.update({
    where: { id: embarquementId },
    data: { status: EMBARKATION_STATUS.SUBMITTED, rejectReason: null },
    include: INCLUDE_EMBARQUEMENT,
  });

  await consignerEvenement({
    embarkationId: embarquementId,
    status: EMBARKATION_STATUS.SUBMITTED,
  });

  await logAction({
    actorType: "MARIN",
    actorId: marinId,
    action: AUDIT_ACTION.EMBARKATION_SUBMIT,
    targetType: "Embarkation",
    targetId: embarquementId,
    metadata: {
      navire: embarquement.vesselName,
      jours: embarquement.days,
      pieces: embarquement.proofs.length,
    },
  });

  // La file de vérification des agents se remplit en direct.
  diffuser({
    evenement: EVENEMENT.EMBARQUEMENT_SOUMIS,
    donnees: { embarquementId, navire: embarquement.vesselName },
    marinId,
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

  await consignerEvenement({
    embarkationId: embarquementId,
    status: EMBARKATION_STATUS.VERIFIED,
    acteur,
  });

  diffuser({
    evenement: EVENEMENT.EMBARQUEMENT_STATUT,
    donnees: {
      embarquementId,
      statut: EMBARKATION_STATUS.VERIFIED,
      jours: actualise.days,
    },
    marinId: embarquement.marinId,
  });

  // Le marin doit savoir que ses jours sont désormais comptabilisables :
  // c'est la donnée qui conditionne ses demandes de renouvellement.
  await notifierMarin({
    marinId: embarquement.marinId,
    evenement: NOTIFICATION_EVENT.REQUEST_STATUS_CHANGED,
    contenu: `PGMI : votre embarquement sur ${embarquement.vesselName} est vérifié. ${actualise.days} jours comptabilisés.`,
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

  await consignerEvenement({
    embarkationId: embarquementId,
    status: EMBARKATION_STATUS.REJECTED,
    reason: motif,
    acteur,
  });

  diffuser({
    evenement: EVENEMENT.EMBARQUEMENT_STATUT,
    donnees: { embarquementId, statut: EMBARKATION_STATUS.REJECTED },
    marinId: actualise.marinId,
  });

  // Remarque PGMI-12 : le motif était enregistré en base sans que personne
  // ne le transmette. Le marin apprenait le rejet en ouvrant l'application,
  // sans savoir quoi corriger.
  await notifierMarin({
    marinId: actualise.marinId,
    evenement: NOTIFICATION_EVENT.REQUEST_STATUS_CHANGED,
    contenu: `PGMI : votre preuve d'embarquement sur ${actualise.vesselName} n'a pas été acceptée. Motif : ${motif}`,
  });

  return actualise;
};