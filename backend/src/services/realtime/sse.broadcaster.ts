// ============================================
// services/realtime/sse.broadcaster.ts
// Diffuseur temps réel sur Server-Sent Events.
//
// SSE plutôt que WebSocket : le flux est unidirectionnel (le serveur
// informe, le client ne répond pas), il passe les proxys d'entreprise et les
// réseaux mobiles ivoiriens sans négociation particulière.
//
// Modèle de livraison assumé : au mieux une fois, sans reprise. Un message
// perdu pendant une coupure n'est pas rejoué. C'est volontaire, et le client
// est construit pour : à la reconnexion il rappelle l'API, qui est la seule
// source de vérité. Il n'y a donc ni identifiant de message, ni tampon, ni
// en-tête Last-Event-ID, et il ne faut pas en ajouter sans implémenter la
// reprise complète qui va avec. Promettre une reprise qui n'existe pas est
// pire que de ne rien promettre.
//
// Le filtrage se fait ici, à l'écriture : un abonné ne reçoit que ce que la
// table DIFFUSION lui accorde. Aucun message n'est envoyé « à tout le
// monde », contrairement au schéma habituel d'un SSE de place de marché.
//
// Portée : une seule instance. Les connexions vivent dans la mémoire de ce
// processus. Avec plusieurs instances derrière un répartiteur, un événement
// produit sur l'une n'atteindrait pas les clients de l'autre. Tant qu'il n'y
// a pas de bus partagé, le service doit rester à une instance.
// ============================================
import type { Request, Response } from "express";
import { TEMPS_REEL } from "../../config/constants.js";
import { AUDIENCE, DIFFUSION } from "../../domain/evenements.js";
import { logger } from "../../lib/logger.js";
import type {
  AbonneTempsReel,
  MessageTempsReel,
  RealtimeBroadcaster,
} from "./RealtimeBroadcaster.js";

// Une connexion ouverte : l'identité de l'abonné et la réponse HTTP tenue
// ouverte, plus le minuteur de battement qui la maintient en vie.
interface Connexion {
  abonne: AbonneTempsReel;
  reponse: Response;
  // Posé juste après la création de la connexion, qu'il référence
  battement: NodeJS.Timeout | null;
}

const connexions = new Set<Connexion>();

// Identité complète d'un abonné. Le seul identifiant ne suffit pas : un
// agent et un marin pourraient théoriquement porter le même, et ils ne
// doivent jamais partager un compteur de connexions.
const cle = (abonne: AbonneTempsReel): string => `${abonne.type}:${abonne.id}`;

// Fermer proprement une connexion et libérer son minuteur.
const fermer = (connexion: Connexion): void => {
  if (connexion.battement) {
    clearInterval(connexion.battement);
    connexion.battement = null;
  }

  connexions.delete(connexion);

  // fermer peut être appelée plusieurs fois pour la même connexion : les
  // trois écoutes de fin posées à l'ouverture se déclenchent parfois
  // ensemble. end() sur un flux déjà détruit lève, d'où le double garde.
  if (!connexion.reponse.writableEnded && !connexion.reponse.destroyed) {
    connexion.reponse.end();
  }
};

// Écrire sur une connexion. Une écriture qui échoue signe une connexion
// morte : elle est retirée du registre au lieu de faire tomber la diffusion.
const ecrire = (connexion: Connexion, charge: string): void => {
  if (connexion.reponse.writableEnded || connexion.reponse.destroyed) {
    fermer(connexion);
    return;
  }

  try {
    connexion.reponse.write(charge);
  } catch (err) {
    logger.warn({ err }, "Connexion temps réel fermée pendant l'écriture");
    fermer(connexion);
  }
};

// Un abonné a-t-il droit à ce message ?
// La réponse ne dépend que de la table DIFFUSION et de l'identité établie à
// l'ouverture : rien n'est relu depuis la requête du client.
export const aDroit = (abonne: AbonneTempsReel, message: MessageTempsReel): boolean => {
  const regle = DIFFUSION[message.evenement];
  if (!regle) return false;

  if (abonne.type === "MARIN") {
    if (regle.audience === AUDIENCE.AGENTS) return false;

    // == null couvre undefined et null, mais pas la chaîne vide. Un
    // marinId vide passé par erreur signifierait « tous les marins » avec
    // un test de véracité simple : ce serait une fuite de dossier.
    if (message.marinId == null) return true;
    if (message.marinId.length === 0) return false;

    return message.marinId === abonne.id;
  }

  if (regle.audience === AUDIENCE.MARIN_CONCERNE) return false;
  if (!regle.permissionAgent) return false;

  return abonne.permissions.includes(regle.permissionAgent);
};

export const sseBroadcaster: RealtimeBroadcaster = {
  code: "SSE",

  compterAbonnes: () => connexions.size,

  diffuser(message: MessageTempsReel): void {
    // La charge est sérialisée une seule fois, pas une fois par abonné.
    const charge =
      `event: ${message.evenement}\n` +
      `data: ${JSON.stringify({ evenement: message.evenement, donnees: message.donnees })}\n\n`;

    // Itération sur une copie : ecrire peut fermer une connexion morte, donc
    // retirer un élément du Set pendant le parcours.
    for (const connexion of [...connexions]) {
      if (aDroit(connexion.abonne, message)) {
        ecrire(connexion, charge);
      }
    }
  },
};

// Ouvrir un flux pour un abonné déjà authentifié.
// Appelée par la route du flux, jamais par un service métier.
export const ouvrirFlux = (abonne: AbonneTempsReel, req: Request, reponse: Response): void => {
  const identite = cle(abonne);

  // Plafond par acteur : un onglet oublié ou un client qui boucle ne doit
  // pas accumuler des connexions sur une instance à mémoire limitée.
  const siennes = [...connexions].filter(function (connexion) {
    return cle(connexion.abonne) === identite;
  });

  // La plus ancienne cède la place : le dernier onglet ouvert est celui que
  // l'utilisateur regarde. L'ordre d'insertion d'un Set est garanti par la
  // spécification ECMAScript, cette lecture est donc sûre.
  const aFermer = siennes.length + 1 - TEMPS_REEL.MAX_CONNEXIONS_PAR_ACTEUR;

  if (aFermer > 0) {
    for (const surnumeraire of siennes.slice(0, aFermer)) {
      fermer(surnumeraire);
    }
  }

  reponse.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Désactive la mise en tampon des proxys, sans quoi rien n'arrive
    // avant plusieurs kilo-octets accumulés.
    "X-Accel-Buffering": "no",
    // L'URL d'ouverture porte un ticket. Même consommé et périmé en
    // quelques secondes, il ne doit pas partir dans l'en-tête Referer.
    "Referrer-Policy": "no-referrer",
  });

  // Première écriture, indispensable : writeHead ne met les en-têtes qu'en
  // tampon, ils ne partent qu'au premier octet de corps. Sans cette ligne,
  // le client reste bloqué sur l'ouverture jusqu'au premier battement, soit
  // vingt-cinq secondes d'écran figé. Une ligne de commentaire SSE est
  // ignorée par le client et fait exactement ce qu'il faut.
  reponse.write(": flux ouvert\n\n");

  // La connexion est construite avant son minuteur : le battement référence
  // l'objet, l'objet doit donc exister en premier.
  const connexion: Connexion = { abonne, reponse, battement: null };

  connexion.battement = setInterval(() => {
    // Ligne de commentaire SSE : invisible côté client, elle empêche les
    // intermédiaires de fermer une connexion jugée inactive.
    ecrire(connexion, ":\n\n");
  }, TEMPS_REEL.BATTEMENT_MS);

  connexions.add(connexion);

  // Trois signaux de fin plutôt qu'un seul. « close » suffit dans le cas
  // normal, mais une coupure brutale de réseau mobile peut n'émettre
  // qu'« aborted » ou une erreur de socket.
  const liberer = () => fermer(connexion);

  reponse.on("close", liberer);
  reponse.on("error", liberer);
  req.on("aborted", liberer);
};

// Fermer toutes les connexions. Appelée à l'arrêt du serveur : sans elle,
// server.close() attend indéfiniment des flux qui ne se ferment jamais, et
// le filet de sécurité tue le processus en code 1 à chaque redéploiement.
export const fermerTousLesFlux = (): void => {
  const ouvertes = connexions.size;

  for (const connexion of [...connexions]) {
    fermer(connexion);
  }

  if (ouvertes > 0) {
    logger.info({ ouvertes }, "Flux temps réel fermés avant l'arrêt");
  }
};