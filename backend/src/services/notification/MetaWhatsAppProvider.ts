// ============================================
// services/notification/MetaWhatsAppProvider.ts
// Fournisseur WhatsApp via la Cloud API de Meta.
//
// Meta exige un modèle de message pré-approuvé pour initier une
// conversation. Le modèle "otp_code" doit être créé dans le Meta
// Business Manager avec un paramètre {{1}} qui reçoit le code.
//
// Pour les notifications textuelles (alertes, statuts), un second
// modèle "notification_texte" avec un paramètre {{1}} est attendu.
// ============================================
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import { NOTIFICATION_CHANNEL } from "../../domain/status.js";
import type {
  NotificationProvider,
  MessageSortant,
  ResultatEnvoi,
} from "./NotificationProvider.js";

// Version de l'API Graph de Meta (mise à jour tous les 3 mois)
const META_API_VERSION = "v21.0";

// Endpoint REST propre au numéro WhatsApp Business configuré
function urlApi(): string {
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  return `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`;
}

// Corps JSON pour un template OTP (paramètre {{1}} = le code)
function corpsOtp(destinataire: string, code: string) {
  return {
    messaging_product: "whatsapp",
    to: destinataire.replace(/\+/g, ""),
    type: "template",
    template: {
      name: "otp_code",
      language: { code: "fr" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: code }],
        },
      ],
    },
  };
}

// Corps JSON pour un template texte libre (notifications, alertes)
function corpsTexte(destinataire: string, contenu: string) {
  return {
    messaging_product: "whatsapp",
    to: destinataire.replace(/\+/g, ""),
    type: "template",
    template: {
      name: "notification_texte",
      language: { code: "fr" },
      components: [
        {
          type: "body",
          parameters: [{ type: "text", text: contenu }],
        },
      ],
    },
  };
}

// Isole le code OTP depuis le message formaté ("... est 123456 ...")
function extraireCode(contenu: string): string | null {
  const correspondance = contenu.match(/est (\d{4,8})/);
  return correspondance ? correspondance[1] : null;
}

export const metaWhatsAppProvider: NotificationProvider = {
  canal: NOTIFICATION_CHANNEL.WHATSAPP,
  nom: "Meta WhatsApp",

  async envoyer(message: MessageSortant): Promise<ResultatEnvoi> {
    const accessToken = env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      logger.error("Meta WhatsApp : WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID manquant");
      return { succes: false, erreur: "Configuration WhatsApp incomplète" };
    }

    // Détecter si c'est un OTP pour choisir le bon template
    const codeOtp = extraireCode(message.contenu);
    const corps = codeOtp
      ? corpsOtp(message.destinataire, codeOtp)
      : corpsTexte(message.destinataire, message.contenu);

    try {
      const reponse = await fetch(urlApi(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(corps),
      });

      const resultat = await reponse.json() as {
        messages?: Array<{ id: string }>;
        error?: { message: string; code: number };
      };

      // Meta renvoie un tableau messages[] en cas de succès
      if (resultat.messages && resultat.messages.length > 0) {
        const messageId = resultat.messages[0].id;
        logger.info(
          { destinataire: message.destinataire, messageId },
          "WhatsApp envoyé via Meta Cloud API",
        );
        return { succes: true, reference: messageId };
      }

      const motif = resultat.error?.message ?? "Erreur inconnue Meta WhatsApp";
      logger.warn(
        { destinataire: message.destinataire, code: resultat.error?.code, motif },
        "WhatsApp non délivré via Meta",
      );
      return { succes: false, erreur: motif };
    } catch (err) {
      logger.error({ err, destinataire: message.destinataire }, "Erreur réseau Meta WhatsApp");
      return { succes: false, erreur: "Erreur de communication avec le fournisseur WhatsApp" };
    }
  },
};