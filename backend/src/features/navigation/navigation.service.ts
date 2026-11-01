// ============================================
// features/navigation/navigation.service.ts
// Relevé de navigation : l'agrégat des mouvements vérifiés d'un marin.
//
// Règle structurante (R24) : un relevé n'expire pas, chaque édition est
// payante, et seule la date de délivrance change d'une édition à l'autre.
// Un relevé retient uniquement les mouvements au statut VERIFIED à
// l'instant de l'édition, et il fige leur contenu : une date corrigée plus
// tard ne modifie pas un relevé déjà délivré.
//
// Le cycle reprend celui du mouvement, pour que le marin ne découvre pas un
// second vocabulaire : on prépare, on règle, on délivre.
// ============================================
import { prisma } from "../../lib/prisma.js";
import {
  EMBARKATION_STATUS,
  NAVIGATION_RECORD_STATUS,
  PAYMENT_STATUS,
} from "../../domain/status.js";
import { SERVICE_TARIFE } from "../../domain/prestations.js";
import { lireMontantPrestation } from "../referentials/referentials.service.js";
import { attribuerCodeVerification } from "../verification/codeVerification.service.js";
import {
  signQrPayload,
  QR_CIBLE,
  buildVerificationUrl,
  generateQrDataUrl,
} from "../../lib/qrcode.js";
import { genererReferenceReleve } from "../../utils/reference.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { NotFoundError, BusinessRuleError, ForbiddenError } from "../../utils/errors.js";
import { notifierMarin, NOTIFICATION_EVENT } from "../../services/notification/notification.service.js";

const INCLUDE_RELEVE = {
  entries: { orderBy: { startDate: "asc" as const } },
} as const;

// Mouvements retenus par une édition faite maintenant. Seul VERIFIED entre
// dans le compte : c'est la même règle que le total du service en mer (R4).
export const mouvementsEligibles = (marinId: string) =>
  prisma.embarkation.findMany({
    where: { marinId, status: EMBARKATION_STATUS.VERIFIED },
    include: { fonction: { select: { label: true } } },
    orderBy: [{ startDate: "asc" }],
  });

// Tarif d'une édition, lu dans la grille administrable. Aucun montant dans
// le code : une grille vide vaut gratuité.
export const montantReleve = () => lireMontantPrestation(SERVICE_TARIFE.NAVIGATION_RECORD);

// Ce que le marin voit avant de décider : ce qu'il a déjà édité, ce qu'une
// nouvelle édition retiendrait, et ce qu'elle coûterait.
export const consulterReleves = async (marinId: string) => {
  const [releves, eligibles, tarif] = await Promise.all([
    prisma.navigationRecord.findMany({
      where: { marinId },
      include: INCLUDE_RELEVE,
      orderBy: { createdAt: "desc" },
    }),
    mouvementsEligibles(marinId),
    montantReleve(),
  ]);

  return {
    releves,
    disponibles: eligibles.map(function (mouvement) {
      return {
        id: mouvement.id,
        vesselName: mouvement.vesselName,
        startDate: mouvement.startDate,
        endDate: mouvement.endDate,
        days: mouvement.days,
        fonction: mouvement.fonction?.label ?? null,
      };
    }),
    totalJours: eligibles.reduce(function (somme, mouvement) {
      return somme + mouvement.days;
    }, 0),
    tarif,
  };
};

// Ouvrir une édition. Le contenu est figé ici, pas au paiement : le marin
// paie ce qu'il a vu, et un mouvement vérifié entre-temps n'entre pas dans
// un relevé déjà ouvert.
export const ouvrirReleve = async (marinId: string) => {
  const eligibles = await mouvementsEligibles(marinId);

  if (eligibles.length === 0) {
    throw new BusinessRuleError(
      "Aucun mouvement vérifié ne figure à votre dossier. Un relevé de navigation " +
        "ne reprend que les embarquements contrôlés par la DGAM.",
      "R24",
    );
  }

  const totalDays = eligibles.reduce(function (somme, mouvement) {
    return somme + mouvement.days;
  }, 0);

  return prisma.navigationRecord.create({
    data: {
      reference: genererReferenceReleve(),
      marinId,
      status: NAVIGATION_RECORD_STATUS.AWAITING_PAYMENT,
      totalDays,
      entries: {
        create: eligibles.map(function (mouvement) {
          return {
            embarkationId: mouvement.id,
            vesselName: mouvement.vesselName,
            imoNumber: mouvement.imoNumber,
            fonctionLabel: mouvement.fonction?.label ?? null,
            startDate: mouvement.startDate,
            endDate: mouvement.endDate,
            days: mouvement.days,
          };
        }),
      },
    },
    include: INCLUDE_RELEVE,
  });
};

// Relevé du marin, contrôlé. Un relevé n'est jamais lisible par un autre.
const releveDuMarin = async (releveId: string, marinId: string) => {
  const releve = await prisma.navigationRecord.findUnique({
    where: { id: releveId },
    include: { ...INCLUDE_RELEVE, payments: true },
  });

  if (!releve) throw new NotFoundError("Relevé de navigation introuvable.");

  if (releve.marinId !== marinId) {
    throw new ForbiddenError("Ce relevé ne figure pas dans votre dossier.");
  }

  return releve;
};

// Relevé prêt à être réglé. Appelé avant d'engager le moindre paiement.
export const verifierRelevePayable = async (releveId: string, marinId: string) => {
  const releve = await releveDuMarin(releveId, marinId);

  if (releve.status === NAVIGATION_RECORD_STATUS.ISSUED) {
    throw new BusinessRuleError(
      "Ce relevé est déjà délivré. Une nouvelle édition s'obtient en demandant " +
        "un nouveau relevé.",
      "R24",
    );
  }

  const dejaPaye = releve.payments.some(function (paiement) {
    return paiement.status === PAYMENT_STATUS.PAID;
  });
  if (dejaPaye) {
    throw new BusinessRuleError("Cette édition est déjà réglée.", "R24");
  }

  const frais = await montantReleve();

  return { releve, ...frais };
};

// Délivrer le relevé : code court, jeton signé, date de délivrance.
// Un relevé gratuit, c'est-à-dire sans ligne de barème active, est délivré
// sans paiement : l'absence de tarif vaut exonération, comme ailleurs.
export const delivrerReleve = async (releveId: string) => {
  const releve = await prisma.navigationRecord.findUnique({
    where: { id: releveId },
    include: { payments: true },
  });
  if (!releve) throw new NotFoundError("Relevé de navigation introuvable.");

  if (releve.status === NAVIGATION_RECORD_STATUS.ISSUED) return releve;

  const frais = await montantReleve();
  const paye = releve.payments.some(function (paiement) {
    return paiement.status === PAYMENT_STATUS.PAID;
  });

  // Paiement engagé mais pas encore confirmé : le relevé attend, il n'est
  // ni délivré ni perdu.
  if (frais.montant > 0 && !paye) return releve;

  const code = releve.verificationCode ?? (await attribuerCodeVerification());

  const delivre = await prisma.navigationRecord.update({
    where: { id: releveId },
    data: {
      status: NAVIGATION_RECORD_STATUS.ISSUED,
      issuedAt: new Date(),
      verificationCode: code,
      qrToken: signQrPayload({
        cible: QR_CIBLE.NAVIGATION_RECORD,
        cibleId: releveId,
        code,
        issuedAt: Date.now(),
      }),
    },
    include: INCLUDE_RELEVE,
  });

  await logAction({
    actorType: "MARIN",
    actorId: releve.marinId,
    action: AUDIT_ACTION.NAVIGATION_RECORD_ISSUED,
    targetType: "NavigationRecord",
    targetId: releveId,
    metadata: { reference: releve.reference, jours: releve.totalDays, code },
  });

  await notifierMarin({
    marinId: releve.marinId,
    evenement: NOTIFICATION_EVENT.DOCUMENT_AVAILABLE,
    contenu:
      `PGMI : votre relevé de navigation ${releve.reference} est délivré. ` +
      `${releve.totalDays} jours de mer vérifiés. Code de vérification : ${code}`,
  });

  return delivre;
};

// QR et code court d'un relevé délivré, servis au marin. Même forme de
// réponse que pour un document ou un mouvement, donc même composant.
export const obtenirQrReleve = async (releveId: string, marinId: string) => {
  const releve = await releveDuMarin(releveId, marinId);

  if (!releve.verificationCode) {
    throw new BusinessRuleError(
      "Ce relevé n'est pas encore délivré. Réglez son édition pour l'obtenir.",
      "R24",
    );
  }

  return {
    code: releve.verificationCode,
    url: buildVerificationUrl(releve.verificationCode),
    image: await generateQrDataUrl(releve.verificationCode),
    reference: releve.reference,
    jours: releve.totalDays,
  };
};