// ============================================
// features/embarkations/embarkations.service.ts
// Sea Service Record : déclaration, soumission de preuve, vérification.
//
// Règle structurante (R4) : seuls les jours vérifiés par un agent DGAM
// comptent. Les jours déclarés sont affichés au marin, mais n'entrent
// jamais dans le calcul de conformité.
// ============================================
import { prisma } from "../../lib/prisma.js";
import {
  EMBARKATION_STATUS,
  EMBARKATION_EDITABLE_STATUSES,
  EMBARKATION_PENDING_STATUSES,
  EMBARKATION_TRANSITIONS,
  PAYMENT_STATUS,
} from "../../domain/status.js";
import type { EmbarkationStatus } from "../../domain/status.js";
import { soumissionMouvementAutorisee } from "../../domain/rules.js";
import { SERVICE_TARIFE } from "../../domain/prestations.js";
import { lireMontantPrestation } from "../referentials/referentials.service.js";
import { calculerJoursEmbarquement, formaterDate } from "../../utils/dates.js";
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
    // Un dossier en attente de paiement n'est pas compté : la DGAM n'attend
    // rien tant que les frais ne sont pas réglés, et afficher ces jours
    // comme en instance laisserait croire à un contrôle en cours.
    prisma.embarkation.aggregate({
      where: {
        marinId,
        status: { in: EMBARKATION_PENDING_STATUSES },
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
    // Trois critères : à dates d'embarquement égales, le débarquement le plus
    // récent passe devant, puis la déclaration la plus récente. Sans eux, deux
    // embarquements commençant le même jour sortaient dans un ordre arbitraire.
    orderBy: [{ startDate: "desc" }, { endDate: "desc" }, { createdAt: "desc" }],
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
  // R22 : un marin ne sert que sur un navire à la fois. Le chevauchement est
  // strict : débarquer le 12 et embarquer le 13 reste accepté, c'est le cas
  // courant d'une promotion ou d'une relève. Sans ce contrôle, les mêmes
  // journées étaient comptées deux fois dans le service en mer.
  //
  // Un dossier rejeté ne bloque rien : ses jours ne sont comptés dans aucun
  // total, la période reste donc libre. La ligne demeure visible au marin
  // avec son motif de refus.
  const chevauchement = await prisma.embarkation.findFirst({
    where: {
      marinId,
      status: { not: EMBARKATION_STATUS.REJECTED },
      startDate: { lte: donnees.endDate },
      endDate: { gte: donnees.startDate },
    },
    select: { vesselName: true, startDate: true, endDate: true },
  });

  if (chevauchement) {
    throw new BusinessRuleError(
      `Vous avez déjà un embarquement sur ${chevauchement.vesselName}, du ` +
        `${formaterDate(chevauchement.startDate)} au ${formaterDate(chevauchement.endDate)}. ` +
        "Un marin ne peut pas servir sur deux navires en même temps. " +
        "Le jour de débarquement compte : un nouvel embarquement commence " +
        "le lendemain au plus tôt.",
      "R22",
    );
  }

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

// Transition de statut, contrôlée par la matrice du domaine. Le cycle de
// vie ne peut pas être court-circuité par un appel direct à l'API : une
// soumission sans paiement ou une vérification d'un dossier déjà vérifié
// sont refusées ici, avant toute écriture.
const exigerTransition = (actuel: string, cible: EmbarkationStatus): void => {
  const autorisees = EMBARKATION_TRANSITIONS[actuel as EmbarkationStatus] ?? [];

  if (!autorisees.includes(cible)) {
    throw new BusinessRuleError(
      `Ce dossier est au statut ${actuel}, cette action n'y est pas possible.`,
      "R4",
    );
  }
};

// Vrai si un paiement confirmé est rattaché à ce mouvement. C'est la seule
// condition de R23 : le nombre de passages par INFO_REQUESTED ou par un
// rejet n'entre pas en compte, un mouvement payé reste payé.
const paiementConfirmeSur = async (embarquementId: string): Promise<boolean> => {
  const regles = await prisma.payment.count({
    where: { embarkationId: embarquementId, status: PAYMENT_STATUS.PAID },
  });
  return regles > 0;
};

// Frais de validation d'un mouvement, lus dans la grille tarifaire
// administrable. Aucun montant n'existe dans le code : une grille vide vaut
// gratuité, et la DGAM change le tarif sans redéploiement.
export const montantValidationMouvement = () =>
  lireMontantPrestation(SERVICE_TARIFE.EMBARKATION_VALIDATION);

// Contrôle des pièces obligatoires. Extrait de la soumission : le règlement
// des frais en a besoin à l'identique, et il serait malvenu d'encaisser un
// paiement sur un dossier que la soumission refusera ensuite.
const exigerDossierComplet = (embarquement: {
  proofUrl: string | null;
  proofs: { kind: string }[];
}): void => {
  // Les pièces historiques n'ont pas de type : un embarquement déclaré
  // avant la gestion multi-pièces et déjà pourvu d'un proofUrl reste
  // soumissible, sinon la correction casserait des dossiers en cours.
  const heritee = Boolean(embarquement.proofUrl) && embarquement.proofs.length === 0;
  const manquantes = heritee ? [] : piecesObligatoiresManquantes(embarquement.proofs);

  if (manquantes.length === 0) return;

  const libelles = manquantes
    .map(function (code) {
      return definitionPiece(code)?.libelle ?? code;
    })
    .join(" ; ");

  throw new BusinessRuleError(
    `Dossier incomplet. Pièces obligatoires manquantes : ${libelles}.`,
    "R11",
  );
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

  // La liste des statuts modifiables est déclarée dans le domaine : un
  // statut ajouté plus tard n'y entre pas par défaut.
  if (!EMBARKATION_EDITABLE_STATUSES.includes(embarquement.status as EmbarkationStatus)) {
    // Un dossier transmis à la DGAM n'est plus modifiable : ni dépôt, ni
    // retrait, ni nouvelle soumission tant que l'instruction n'est pas close.
    if (embarquement.status === EMBARKATION_STATUS.SUBMITTED) {
      throw new BusinessRuleError(
        "Ce dossier est en cours de vérification à la DGAM et ne peut plus être modifié.",
        "R4",
      );
    }

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

// Dossier prêt à être réglé : pièces complètes, frais dus, rien d'encaissé.
// Appelé avant d'engager le moindre paiement, pour ne jamais prendre
// d'argent sur un dossier que la soumission refusera ensuite.
export const verifierDossierPayable = async (embarquementId: string, marinId: string) => {
  const embarquement = await embarquementModifiable(embarquementId, marinId);
  exigerDossierComplet(embarquement);

  if (await paiementConfirmeSur(embarquementId)) {
    throw new BusinessRuleError(
      "Les frais de validation de ce mouvement sont déjà réglés. " +
        "Un mouvement ne se paie qu'une fois.",
      "R23",
    );
  }

  const frais = await montantValidationMouvement();

  if (frais.montant <= 0) {
    throw new BusinessRuleError(
      "Aucun frais n'est dû pour ce mouvement. Soumettez directement votre dossier.",
    );
  }

  return { embarquement, ...frais };
};

// Suite d'un règlement. Un paiement confirmé fait partir le dossier en
// vérification ; un paiement encore en attente, cas d'un opérateur Mobile
// Money asynchrone, laisse le dossier en attente de confirmation.
export const confirmerPaiementMouvement = async (embarquementId: string) => {
  const embarquement = await prisma.embarkation.findUnique({
    where: { id: embarquementId },
  });
  if (!embarquement) throw new NotFoundError("Embarquement introuvable.");

  if (await paiementConfirmeSur(embarquementId)) {
    return soumettreEmbarquement(embarquementId, embarquement.marinId);
  }

  exigerTransition(embarquement.status, EMBARKATION_STATUS.AWAITING_PAYMENT);

  const actualise = await prisma.embarkation.update({
    where: { id: embarquementId },
    data: { status: EMBARKATION_STATUS.AWAITING_PAYMENT },
    include: INCLUDE_EMBARQUEMENT,
  });

  await consignerEvenement({
    embarkationId: embarquementId,
    status: EMBARKATION_STATUS.AWAITING_PAYMENT,
  });

  diffuser({
    evenement: EVENEMENT.EMBARQUEMENT_STATUT,
    donnees: { embarquementId, statut: EMBARKATION_STATUS.AWAITING_PAYMENT },
    marinId: embarquement.marinId,
  });

  return actualise;
};

// Soumettre l'embarquement à vérification, une fois les pièces déposées et
// les frais réglés. Un dossier déjà payé repasse ici autant de fois que
// l'instruction l'exige, sans nouveau règlement (R23).
export const soumettreEmbarquement = async (embarquementId: string, marinId: string) => {
  const embarquement = await embarquementModifiable(embarquementId, marinId);
  exigerDossierComplet(embarquement);

  // R23 : le paiement conditionne la soumission, et un montant nul vaut
  // exonération. La condition est portée par le domaine, pas par ce service.
  const frais = await montantValidationMouvement();
  const paiementConfirme = await paiementConfirmeSur(embarquementId);

  if (!soumissionMouvementAutorisee({ feeAmount: frais.montant, paiementConfirme })) {
    throw new BusinessRuleError(
      "Les frais de validation de ce mouvement doivent être réglés avant la soumission.",
      "R23",
    );
  }

  exigerTransition(embarquement.status, EMBARKATION_STATUS.SUBMITTED);

  const actualise = await prisma.embarkation.update({
    where: { id: embarquementId },
    data: {
      status: EMBARKATION_STATUS.SUBMITTED,
      rejectReason: null,
      // Le message de complément porte sur la soumission précédente : le
      // laisser affiché après un nouvel envoi désignerait des pièces qui
      // viennent d'être fournies.
      additionalInfo: null,
    },
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

  // Le marin est averti que son dossier est parti et qu'il est désormais
  // verrouillé : sans cette trace, il découvre le blocage en tentant de
  // déposer une pièce de plus.
  await notifierMarin({
    marinId,
    evenement: NOTIFICATION_EVENT.REQUEST_STATUS_CHANGED,
    contenu: `PGMI : votre dossier d'embarquement sur ${embarquement.vesselName} est transmis à la DGAM. Il ne peut plus être modifié pendant la vérification.`,
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

  exigerTransition(embarquement.status, EMBARKATION_STATUS.VERIFIED);

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

// Demander des pièces complémentaires. Le dossier revient au marin sans
// être refusé, et sans nouveau paiement : R23 n'admet qu'un seul règlement
// par mouvement. C'est aussi la voie de réouverture d'un dossier rejeté
// prévue par R25.
export const demanderComplementEmbarquement = async (
  embarquementId: string,
  motif: string,
  acteur: Acteur,
) => {
  const embarquement = await prisma.embarkation.findUnique({
    where: { id: embarquementId },
  });
  if (!embarquement) throw new NotFoundError("Embarquement introuvable.");

  exigerTransition(embarquement.status, EMBARKATION_STATUS.INFO_REQUESTED);

  const actualise = await prisma.embarkation.update({
    where: { id: embarquementId },
    data: {
      status: EMBARKATION_STATUS.INFO_REQUESTED,
      additionalInfo: motif,
      // Le dossier n'est plus refusé : le motif de rejet précédent n'a plus
      // lieu d'être affiché au marin.
      rejectReason: null,
    },
    include: INCLUDE_EMBARQUEMENT,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.EMBARKATION_INFO_REQUESTED,
    targetType: "Embarkation",
    targetId: embarquementId,
    metadata: { motif, statutPrecedent: embarquement.status },
  });

  await consignerEvenement({
    embarkationId: embarquementId,
    status: EMBARKATION_STATUS.INFO_REQUESTED,
    reason: motif,
    acteur,
  });

  diffuser({
    evenement: EVENEMENT.EMBARQUEMENT_STATUT,
    donnees: { embarquementId, statut: EMBARKATION_STATUS.INFO_REQUESTED },
    marinId: actualise.marinId,
  });

  await notifierMarin({
    marinId: actualise.marinId,
    evenement: NOTIFICATION_EVENT.REQUEST_STATUS_CHANGED,
    contenu:
      `PGMI : la DGAM attend des pièces complémentaires pour votre embarquement sur ` +
      `${actualise.vesselName}. ${motif} Le dépôt est gratuit, vos frais restent acquis.`,
  });

  return actualise;
};

export const rejeterEmbarquement = async (
  embarquementId: string,
  motif: string,
  acteur: Acteur,
) => {
  const existant = await prisma.embarkation.findUnique({
    where: { id: embarquementId },
    select: { status: true },
  });
  if (!existant) throw new NotFoundError("Embarquement introuvable.");

  exigerTransition(existant.status, EMBARKATION_STATUS.REJECTED);

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
    // R25 : le motif seul laisse le marin sans recours. Le message indique
    // donc la démarche possible, au guichet, avec ses justificatifs.
    contenu:
      `PGMI : votre preuve d'embarquement sur ${actualise.vesselName} n'a pas été acceptée. ` +
      `Motif : ${motif} Vous pouvez corriger vos pièces et soumettre de nouveau, sans ` +
      `nouveaux frais, ou vous présenter au bureau de la DGAM avec vos justificatifs.`,
  });

  return actualise;
};