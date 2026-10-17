// ============================================
// jobs/expiryScan.job.ts
// Module B du dossier ARSTM : programmation proactive.
//
// Le travail quotidien parcourt les certificats valides et, pour chaque
// palier atteint (J-365, J-270, J-180, J-90, J-30), notifie le marin et,
// au premier palier, crée une proposition de formation.
//
// C'est le renversement de logique demandé par l'ARSTM : le marin n'est plus
// celui qui doit penser à son renouvellement, le système vient à lui, et
// l'institut voit sa charge de formation un an à l'avance.
// ============================================
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";
import { DOCUMENT_STATUS, ENROLLMENT_SOURCE, ENROLLMENT_STATUS } from "../domain/status.js";
import {
  EXPIRY_REMINDER_STEPS,
  EXPIRY_WARNING_WINDOW_DAYS,
  REMINDER_TOLERANCE_DAYS,
} from "../domain/rules.js";
import type { ExpiryReminderStep } from "../domain/rules.js";
import { joursAvantExpiration, formaterDate } from "../utils/dates.js";
import { logAction, AUDIT_ACTION } from "../utils/auditLog.js";
import {
  notifierMarin,
  NOTIFICATION_EVENT,
} from "../services/notification/notification.service.js";
import { inscrireAFormation } from "../features/training/training.service.js";

// Palier correspondant au nombre de jours restants, à la tolérance près.
// Sans tolérance, une journée sans exécution ferait manquer le palier.
const trouverPalier = (joursRestants: number): ExpiryReminderStep | undefined =>
  EXPIRY_REMINDER_STEPS.find(
    (palier) => Math.abs(joursRestants - palier.daysBefore) <= REMINDER_TOLERANCE_DAYS,
  );

// Une notification par palier et par document : le contrôle se fait sur les
// notifications déjà envoyées, aucune colonne supplémentaire n'est requise.
const dejaNotifie = async (marinId: string, empreinte: string): Promise<boolean> => {
  const existante = await prisma.marinNotification.findFirst({
    where: {
      marinId,
      event: NOTIFICATION_EVENT.EXPIRY_WARNING,
      content: { contains: empreinte },
    },
    select: { id: true },
  });
  return Boolean(existante);
};

export interface ResultatScan {
  documentsExamines: number;
  notificationsEnvoyees: number;
  propositionsCreees: number;
  alertesDgam: number;
}

// Exécuter le scan. La fonction est exportée pour être appelable aussi bien
// par le planificateur que par un test ou une commande manuelle.
export const executerScanExpiration = async (): Promise<ResultatScan> => {
  const maintenant = new Date();
  const limite = new Date(
    maintenant.getTime() + (EXPIRY_WARNING_WINDOW_DAYS + REMINDER_TOLERANCE_DAYS) * 24 * 60 * 60 * 1000,
  );

  // Seuls les documents en cours de validité sont concernés : un document
  // remplacé ou révoqué ne déclenche aucune relance.
  const documents = await prisma.document.findMany({
    where: {
      status: { in: [DOCUMENT_STATUS.VERIFIED, DOCUMENT_STATUS.OFFICIAL_DIGITAL] },
      expiryDate: { gte: maintenant, lte: limite },
    },
    include: {
      certificateType: true,
      marin: { select: { id: true, status: true, region: true } },
    },
  });

  const resultat: ResultatScan = {
    documentsExamines: documents.length,
    notificationsEnvoyees: 0,
    propositionsCreees: 0,
    alertesDgam: 0,
  };

  for (const document of documents) {
    if (!document.expiryDate) continue;
    if (document.marin.status === "SUSPENDED") continue;

    const joursRestants = joursAvantExpiration(document.expiryDate, maintenant);
    const palier = trouverPalier(joursRestants);
    if (!palier) continue;

    // Empreinte lisible, retrouvée dans le contenu de la notification
    const empreinte = `[${document.id}:J-${palier.daysBefore}]`;
    if (await dejaNotifie(document.marin.id, empreinte)) continue;

    const message =
      `PGMI : votre ${document.certificateType.label} expire le ${formaterDate(document.expiryDate)} ` +
      `(dans ${joursRestants} jours). ` +
      (document.certificateType.requiresTraining
        ? "Une formation est nécessaire, inscrivez-vous dès maintenant."
        : "Préparez votre demande de renouvellement.") +
      ` ${empreinte}`;

    await notifierMarin({
      marinId: document.marin.id,
      evenement: NOTIFICATION_EVENT.EXPIRY_WARNING,
      contenu: message,
      // R17 : les paliers critiques passent outre les préférences du marin
      forcerSms: palier.forceSms,
    });
    resultat.notificationsEnvoyees += 1;

    // Premier palier et certificat nécessitant une formation : une
    // proposition d'inscription est créée, en attente de réponse du marin.
    if (
      palier.daysBefore === EXPIRY_WARNING_WINDOW_DAYS &&
      document.certificateType.requiresTraining
    ) {
      try {
        await inscrireAFormation({
          marinId: document.marin.id,
          certificateTypeId: document.certificateTypeId,
          source: ENROLLMENT_SOURCE.SYSTEM_EXPIRY_SCAN,
          statutInitial: ENROLLMENT_STATUS.PROPOSED,
        });
        resultat.propositionsCreees += 1;

        await notifierMarin({
          marinId: document.marin.id,
          evenement: NOTIFICATION_EVENT.TRAINING_PROPOSED,
          contenu: `PGMI : une session ${document.certificateType.label} vous est proposée à l'ARSTM. Confirmez votre intérêt dans l'application.`,
        });
      } catch (err) {
        logger.warn({ err, documentId: document.id }, "Proposition de formation non créée");
      }
    }

    // Dernier palier : l'agent DGAM du ressort est alerté pour un
    // accompagnement individuel avant expiration.
    if (palier.alertDgam) {
      resultat.alertesDgam += 1;
      logger.warn(
        {
          marinId: document.marin.id,
          region: document.marin.region,
          certificat: document.certificateType.code,
          expiration: document.expiryDate,
        },
        "Certificat à moins de 30 jours de l'expiration",
      );
    }
  }

  await logAction({
    actorType: "SYSTEM",
    actorLabel: "Scan quotidien d'expiration",
    action: AUDIT_ACTION.EXPIRY_SCAN_RUN,
    metadata: { ...resultat },
  });

  logger.info(resultat, "Scan d'expiration terminé");
  return resultat;
};
