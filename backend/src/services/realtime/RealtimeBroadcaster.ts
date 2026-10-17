// ============================================
// services/realtime/RealtimeBroadcaster.ts
// Contrat d'un diffuseur temps réel (pattern Provider, comme le paiement,
// le stockage et les notifications).
//
// Les services métier dépendent de cette interface, jamais de Server-Sent
// Events : le jour où la plateforme passera à WebSocket ou à un bus externe
// pour tenir plusieurs instances, seul le fichier d'implémentation change.
// ============================================
import type { Evenement } from "../../domain/evenements.js";
import type { Permission } from "../../domain/permissions.js";

// Identité d'un abonné, établie à l'ouverture du flux et jamais relue
// depuis la requête ensuite.
export interface AbonneTempsReel {
  type: "AGENT" | "MARIN";
  // Identifiant du marin ou de l'agent
  id: string;
  // Permissions de l'agent, vide pour un marin
  permissions: readonly Permission[];
}

// Message poussé sur le fil
export interface MessageTempsReel {
  evenement: Evenement;
  // Charge utile minimale : de quoi rafraîchir l'écran concerné, jamais le
  // dossier complet. Le client rappelle l'API pour les détails.
  donnees: Record<string, unknown>;
  // Dossier concerné. Absent pour un événement qui s'adresse à tous les
  // marins, par exemple l'ouverture d'une session de formation.
  marinId?: string | null;
}

export interface RealtimeBroadcaster {
  readonly code: string;
  // Nombre d'abonnés actifs, lu par la sonde de santé
  compterAbonnes(): number;
  // Diffuser un message aux seuls abonnés qui y ont droit
  diffuser(message: MessageTempsReel): void;
}