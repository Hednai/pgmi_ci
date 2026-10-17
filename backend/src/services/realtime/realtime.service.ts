// ============================================
// services/realtime/realtime.service.ts
// Point d'entrée unique de la diffusion temps réel.
//
// Les services métier appellent diffuser() et rien d'autre : ils ne
// connaissent ni le transport, ni le registre des connexions, ni les
// permissions des abonnés. Changer de transport se fait en changeant la
// seule ligne qui désigne le diffuseur actif.
//
// La diffusion ne doit jamais faire échouer l'action métier qui l'a
// déclenchée : une demande approuvée reste approuvée même si plus aucun
// écran n'écoute. Toute erreur est donc journalisée, pas propagée.
// ============================================
import { logger } from "../../lib/logger.js";
import { sseBroadcaster } from "./sse.broadcaster.js";
import type { MessageTempsReel, RealtimeBroadcaster } from "./RealtimeBroadcaster.js";

// Diffuseur actif. Une instance unique suffit au plan gratuit de
// l'hébergeur ; une montée en charge multi-instances remplacerait cette
// ligne par un diffuseur adossé à un bus partagé.
const diffuseur: RealtimeBroadcaster = sseBroadcaster;

export const diffuser = (message: MessageTempsReel): void => {
  try {
    diffuseur.diffuser(message);
  } catch (err) {
    logger.error({ err, evenement: message.evenement }, "Diffusion temps réel impossible");
  }
};

// Nombre d'abonnés connectés, exposé par la sonde de disponibilité
export const compterAbonnes = (): number => diffuseur.compterAbonnes();

// Pas de ré-export de EVENEMENT ici : les services l'importent depuis
// domain/evenements.js, comme toute autre règle de domaine. Deux chemins
// d'import pour la même constante finissent toujours par diverger.