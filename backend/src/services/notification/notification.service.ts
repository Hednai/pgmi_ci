// ============================================
// services/notification/notification.service.ts
// Service de notification multicanal.
//
// Responsabilités :
//   1. choisir les canaux selon les préférences du marin ;
//   2. forcer le SMS quand la règle R17 l'exige (alertes critiques) ;
//   3. tracer chaque envoi dans MarinNotification.
//
// Le service ne connaît aucun opérateur : il reçoit ses fournisseurs au
// démarrage et les appelle à travers l'interface NotificationProvider.
// ============================================
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { NOTIFICATION_CHANNEL } from "../../domain/status.js";
import type { NotificationChannel } from "../../domain/status.js";
import type { NotificationProvider } from "./NotificationProvider.js";
import {
  consoleSmsProvider,
  consoleWhatsAppProvider,
  consoleEmailProvider,
} from "./ConsoleProviders.js";

// Catalogue des évènements notifiables. Le libellé sert au journal et au
// centre de notifications du marin.
export const NOTIFICATION_EVENT = {
  OTP_CODE: "OTP_CODE",
  ACCOUNT_ACTIVATED: "ACCOUNT_ACTIVATED",
  CADET_REGISTERED: "CADET_REGISTERED",
  MATRICULE_ASSIGNED: "MATRICULE_ASSIGNED",
  REQUEST_SUBMITTED: "REQUEST_SUBMITTED",
  REQUEST_STATUS_CHANGED: "REQUEST_STATUS_CHANGED",
  REQUEST_APPROVED: "REQUEST_APPROVED",
  REQUEST_REJECTED: "REQUEST_REJECTED",
  DOCUMENT_AVAILABLE: "DOCUMENT_AVAILABLE",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  EXPIRY_WARNING: "EXPIRY_WARNING",
  TRAINING_PROPOSED: "TRAINING_PROPOSED",
  TRAINING_WAITING_QUORUM: "TRAINING_WAITING_QUORUM",
  TRAINING_SCHEDULED: "TRAINING_SCHEDULED",
  TRAINING_RESULT: "TRAINING_RESULT",
} as const;
export type NotificationEvent =
  (typeof NOTIFICATION_EVENT)[keyof typeof NOTIFICATION_EVENT];

// Fournisseurs actifs, choisis par la configuration.
// Les implémentations réseau seront ajoutées ici sans toucher au service.
const fournisseurs: Record<NotificationChannel, NotificationProvider> = {
  SMS: consoleSmsProvider,
  WHATSAPP: consoleWhatsAppProvider,
  EMAIL: consoleEmailProvider,
};

logger.debug(
  {
    sms: env.SMS_PROVIDER,
    whatsapp: env.WHATSAPP_PROVIDER,
    email: env.EMAIL_PROVIDER,
  },
  "Fournisseurs de notification chargés",
);

export interface DemandeNotification {
  marinId: string;
  evenement: NotificationEvent;
  contenu: string;
  // Ignore les préférences du marin pour le SMS (R17)
  forcerSms?: boolean;
  // Restreint l'envoi à certains canaux, en plus des préférences
  canaux?: NotificationChannel[];
}

// Déterminer les canaux effectifs pour un marin donné
const choisirCanaux = (
  marin: { notifySms: boolean; notifyWhatsapp: boolean; notifyEmail: boolean; email: string | null },
  demande: DemandeNotification,
): NotificationChannel[] => {
  const canaux: NotificationChannel[] = [];

  // Le SMS reste le canal de référence : toujours actif, et non désactivable
  // sur les alertes critiques.
  if (marin.notifySms || demande.forcerSms) canaux.push(NOTIFICATION_CHANNEL.SMS);
  if (marin.notifyWhatsapp) canaux.push(NOTIFICATION_CHANNEL.WHATSAPP);
  if (marin.notifyEmail && marin.email) canaux.push(NOTIFICATION_CHANNEL.EMAIL);

  if (!demande.canaux) return canaux;
  return canaux.filter((canal) => demande.canaux?.includes(canal));
};

// Notifier un marin sur tous ses canaux actifs.
// Un échec d'envoi n'interrompt jamais l'action métier en cours.
export const notifierMarin = async (demande: DemandeNotification): Promise<void> => {
  const marin = await prisma.marin.findUnique({
    where: { id: demande.marinId },
    select: {
      phone: true,
      email: true,
      notifySms: true,
      notifyWhatsapp: true,
      notifyEmail: true,
    },
  });

  if (!marin) {
    logger.warn({ marinId: demande.marinId }, "Notification impossible, marin introuvable");
    return;
  }

  const canaux = choisirCanaux(marin, demande);

  for (const canal of canaux) {
    const fournisseur = fournisseurs[canal];
    const destinataire = canal === NOTIFICATION_CHANNEL.EMAIL ? marin.email : marin.phone;
    if (!destinataire) continue;

    try {
      const resultat = await fournisseur.envoyer({
        destinataire,
        contenu: demande.contenu,
        evenement: demande.evenement,
      });

      await prisma.marinNotification.create({
        data: {
          marinId: demande.marinId,
          channel: canal,
          event: demande.evenement,
          content: demande.contenu,
          status: resultat.succes ? "SENT" : "FAILED",
        },
      });
    } catch (err) {
      logger.error({ err, canal }, "Échec d'envoi de notification");
    }
  }
};

// Envoyer un code OTP. Cas particulier : le destinataire n'est pas encore
// forcément un marin en base, l'envoi se fait donc directement par SMS.
export const envoyerOtp = async (telephone: string, code: string): Promise<void> => {
  await fournisseurs.SMS.envoyer({
    destinataire: telephone,
    contenu: `PGMI : votre code de connexion est ${code}. Il expire dans 10 minutes. Ne le communiquez à personne.`,
    evenement: NOTIFICATION_EVENT.OTP_CODE,
  });
};
