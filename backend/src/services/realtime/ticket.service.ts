// ============================================
// services/realtime/ticket.service.ts
// Tickets d'ouverture de flux, à usage unique et à durée très courte.
//
// Pourquoi un ticket plutôt que le jeton d'accès : l'API EventSource du
// navigateur n'accepte pas d'en-tête Authorization. Le seul moyen de
// transmettre une identité serait de mettre le JWT dans l'URL, où il
// finirait dans les journaux d'accès de l'hébergeur, dans l'historique du
// navigateur et dans l'en-tête Referer. Un ticket opaque, valable quelques
// secondes et consommé à la première ouverture, ne présente pas ce risque.
//
// Le ticket est délivré par une route authentifiée classique, qui elle
// dispose bien de l'en-tête Authorization.
// ============================================
import { randomBytes } from "node:crypto";
import { TEMPS_REEL } from "../../config/constants.js";
import { logger } from "../../lib/logger.js";
import { ServiceUnavailableError } from "../../utils/errors.js";
import type { AbonneTempsReel } from "./RealtimeBroadcaster.js";

interface TicketEnregistre {
  abonne: AbonneTempsReel;
  expireLe: number;
}

// Les tickets vivent en mémoire : ils expirent en quelques secondes, les
// persister n'aurait aucun intérêt et créerait des écritures inutiles.
const tickets = new Map<string, TicketEnregistre>();

// Purge des tickets périmés. Appelée à chaque délivrance : la table reste
// petite sans travail planifié dédié.
const purger = (maintenant: number): void => {
  for (const [valeur, ticket] of tickets) {
    if (ticket.expireLe <= maintenant) tickets.delete(valeur);
  }
};

// Délivrer un ticket pour un acteur authentifié.
// L'identité est figée ici : elle ne sera plus relue à l'ouverture du flux.
export const delivrerTicket = (abonne: AbonneTempsReel): { ticket: string; expireDans: number } => {
  const maintenant = Date.now();
  purger(maintenant);

  // Plafond global, en plus du plafond par appelant posé par le limiteur de
  // la route. Le limiteur compte par adresse : un grand nombre d'adresses
  // authentifiées pourrait faire grossir cette table sans borne.
  if (tickets.size >= TEMPS_REEL.MAX_TICKETS_EN_VOL) {
    logger.error({ enVol: tickets.size }, "Plafond de tickets de flux atteint");
    throw new ServiceUnavailableError("Flux temps réel momentanément indisponible.");
  }

  const valeur = randomBytes(TEMPS_REEL.TICKET_OCTETS).toString("base64url");
  tickets.set(valeur, { abonne, expireLe: maintenant + TEMPS_REEL.TICKET_DUREE_MS });

  return { ticket: valeur, expireDans: TEMPS_REEL.TICKET_DUREE_MS };
};

// Consommer un ticket. Retourne null si le ticket est inconnu, périmé ou
// déjà utilisé : les trois cas se traitent de la même façon côté route,
// rien ne distingue un ticket rejoué d'un ticket inventé.
export const consommerTicket = (valeur: string): AbonneTempsReel | null => {
  if (valeur.length === 0 || valeur.length > TEMPS_REEL.TICKET_LONGUEUR_MAX) {
    return null;
  }

  const ticket = tickets.get(valeur);
  if (!ticket) return null;

  // Le ticket est retiré avant toute autre vérification : un ticket périmé
  // est consommé au même titre qu'un ticket valide, donc jamais rejouable.
  tickets.delete(valeur);

  if (ticket.expireLe <= Date.now()) return null;

  return ticket.abonne;
};

// Nombre de tickets en attente, exposé pour les tests et la supervision.
export const compterTicketsEnVol = (): number => tickets.size;

// Vider la table. Utilisée par les tests pour repartir d'un état connu, et
// à l'arrêt du serveur : un ticket survivant n'aurait de toute façon plus
// de flux à ouvrir.
export const viderTickets = (): void => tickets.clear();