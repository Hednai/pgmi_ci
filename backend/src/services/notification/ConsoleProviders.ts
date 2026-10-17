// ============================================
// services/notification/ConsoleProviders.ts
// Implémentations de développement des trois canaux.
//
// Rien n'est envoyé : le message part dans le journal. Cela permet de
// dérouler tout le parcours marin en local sans crédit SMS ni compte
// WhatsApp Business, et de garder les tests déterministes.
// ============================================
import { logger } from "../../lib/logger.js";
import { NOTIFICATION_CHANNEL } from "../../domain/status.js";
import type {
  NotificationProvider,
  MessageSortant,
  ResultatEnvoi,
} from "./NotificationProvider.js";

// Fabrique commune : les trois canaux n'ont que leur libellé qui diffère
const creerProviderConsole = (
  canal: NotificationProvider["canal"],
  nom: string,
): NotificationProvider => ({
  canal,
  nom,
  async envoyer(message: MessageSortant): Promise<ResultatEnvoi> {
    logger.info(
      { canal, destinataire: message.destinataire, evenement: message.evenement },
      `[${nom}] ${message.contenu}`,
    );
    return { succes: true, reference: `console-${Date.now()}` };
  },
});

export const consoleSmsProvider = creerProviderConsole(NOTIFICATION_CHANNEL.SMS, "SMS");
export const consoleWhatsAppProvider = creerProviderConsole(
  NOTIFICATION_CHANNEL.WHATSAPP,
  "WhatsApp",
);
export const consoleEmailProvider = creerProviderConsole(
  NOTIFICATION_CHANNEL.EMAIL,
  "Email",
);
