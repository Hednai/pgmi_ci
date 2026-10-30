// ============================================
// domain/notificationsMarin.ts
// Regroupement des notifications d'un marin en messages lisibles.
//
// notifierMarin écrit une ligne MarinNotification par canal effectivement
// sollicité : un même événement parti par WhatsApp et par SMS laisse deux
// lignes au contenu identique. Le marin, lui, n'a reçu qu'un message et n'a
// pas à connaître la mécanique d'acheminement.
//
// La règle de regroupement vit ici et non dans le service, comme les autres
// invariants du domaine : elle est ainsi testable sans base de données, et
// un seul endroit décide de ce qui constitue un message.
// ============================================

// Ligne telle que lue en base, réduite aux champs qui comptent ici.
export interface LigneNotification {
  id: string;
  event: string;
  content: string;
  channel: string;
  readAt: Date | null;
  createdAt: Date;
}

export interface MessageMarin {
  // Identifiant de la ligne la plus récente du groupe, celle que le client
  // renvoie pour marquer le message lu
  id: string;
  evenement: string;
  contenu: string;
  // Canaux par lesquels ce message est parti, sans doublon
  canaux: string[];
  // Faux tant qu'aucune ligne du groupe n'a été lue
  lu: boolean;
  creeLe: Date;
}

// Fenêtre de regroupement, en millisecondes. La boucle d'envoi de
// notifierMarin parcourt les canaux sans attente : deux lignes du même
// message tombent dans la même seconde. Deux envois réellement distincts,
// par exemple un rappel, sont séparés de bien davantage.
export const FENETRE_REGROUPEMENT_MS = 1000;

// Début de la fenêtre qui contient une date, utilisé par le regroupement
// comme par la mise à jour « lu » : les deux doivent découper le temps de
// la même façon, sinon un message marqué lu resterait affiché non lu.
export const debutFenetre = (date: Date): Date =>
  new Date(Math.floor(date.getTime() / FENETRE_REGROUPEMENT_MS) * FENETRE_REGROUPEMENT_MS);

const cleDeGroupe = (ligne: LigneNotification): string =>
  `${ligne.event}|${ligne.content}|${debutFenetre(ligne.createdAt).getTime()}`;

// Les lignes sont attendues triées du plus récent au plus ancien : l'ordre
// d'entrée est conservé en sortie, et l'identifiant retenu pour un message
// est celui de sa ligne la plus récente.
export const regrouperNotifications = (lignes: LigneNotification[]): MessageMarin[] => {
  const groupes = new Map<string, MessageMarin>();

  for (const ligne of lignes) {
    const cle = cleDeGroupe(ligne);
    const existant = groupes.get(cle);

    if (!existant) {
      groupes.set(cle, {
        id: ligne.id,
        evenement: ligne.event,
        contenu: ligne.content,
        canaux: [ligne.channel],
        lu: ligne.readAt !== null,
        creeLe: ligne.createdAt,
      });
      continue;
    }

    if (!existant.canaux.includes(ligne.channel)) existant.canaux.push(ligne.channel);
    // Une seule ligne lue suffit : le marin a vu le message.
    if (ligne.readAt !== null) existant.lu = true;
  }

  return Array.from(groupes.values());
};

export const compterNonLus = (messages: MessageMarin[]): number =>
  messages.filter((message) => !message.lu).length;