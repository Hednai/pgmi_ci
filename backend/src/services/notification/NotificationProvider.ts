// ============================================
// services/notification/NotificationProvider.ts
// Contrat commun à tous les canaux de notification (pattern Provider).
//
// Le code métier dépend de cette interface, jamais d'Africa's Talking ni de
// Resend : changer d'opérateur SMS revient à écrire une classe de plus
// (principe d'inversion des dépendances).
// ============================================
import type { NotificationChannel } from "../../domain/status.js";

export interface MessageSortant {
  // Numéro au format international (+225...) ou adresse email
  destinataire: string;
  contenu: string;
  // Repris dans le journal, sert à corréler envoi et évènement métier
  evenement: string;
}

export interface ResultatEnvoi {
  succes: boolean;
  reference?: string;
  erreur?: string;
}

export interface NotificationProvider {
  readonly canal: NotificationChannel;
  readonly nom: string;
  envoyer(message: MessageSortant): Promise<ResultatEnvoi>;
}
