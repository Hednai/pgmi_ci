// ============================================
// features/marins/notifications.service.ts
// Centre de notifications du marin (remarque PGMI-07).
//
// Les messages existent déjà en base : notifierMarin écrit une ligne
// MarinNotification à chaque envoi, depuis la mise en service. Seule leur
// lecture manquait, aucune route ne les exposait.
//
// La règle de regroupement vit dans domain/notificationsMarin.ts : ce
// service ne fait que lire, paginer et marquer.
// ============================================
import { prisma } from "../../lib/prisma.js";
import { lirePagination, construireReponse } from "../../utils/pagination.js";
import { NotFoundError } from "../../utils/errors.js";
import {
  regrouperNotifications,
  compterNonLus,
  debutFenetre,
  FENETRE_REGROUPEMENT_MS,
} from "../../domain/notificationsMarin.js";

// Profondeur d'historique lue avant regroupement. Un marin reçoit quelques
// dizaines de messages par an : ce plafond couvre plusieurs années tout en
// bornant la requête. Le regroupement doit précéder la pagination, sinon
// une page afficherait un nombre variable de messages selon les canaux
// empruntés.
const PROFONDEUR_MAX = 300;

const CHAMPS = {
  id: true,
  event: true,
  content: true,
  channel: true,
  readAt: true,
  createdAt: true,
} as const;

const lireLignes = (marinId: string) =>
  prisma.marinNotification.findMany({
    where: { marinId },
    orderBy: { createdAt: "desc" },
    take: PROFONDEUR_MAX,
    select: CHAMPS,
  });

export const listerMessagesMarin = async (
  marinId: string,
  filtres: Record<string, unknown>,
) => {
  const pagination = lirePagination(filtres);
  const messages = regrouperNotifications(await lireLignes(marinId));
  const page = messages.slice(pagination.skip, pagination.skip + pagination.taille);

  return {
    ...construireReponse(page, messages.length, pagination),
    nonLus: compterNonLus(messages),
  };
};

// Nombre de messages non lus, pour la pastille. Compté sur les groupes et
// non sur les lignes : un message parti sur deux canaux compte pour un.
export const compterNonLusMarin = async (marinId: string): Promise<number> =>
  compterNonLus(regrouperNotifications(await lireLignes(marinId)));

// Marquer un message lu. L'identifiant reçu désigne une ligne du groupe :
// toutes les lignes du même message passent à lu, sinon la pastille
// resterait allumée par le jumeau resté sur l'autre canal.
export const marquerMessageLu = async (marinId: string, notificationId: string) => {
  const ligne = await prisma.marinNotification.findFirst({
    where: { id: notificationId, marinId },
    select: { event: true, content: true, createdAt: true },
  });
  if (!ligne) throw new NotFoundError("Notification introuvable.");

  // Même découpage du temps que le regroupement : les deux doivent voir la
  // même fenêtre, sinon un message marqué lu réapparaîtrait non lu.
  const debut = debutFenetre(ligne.createdAt);
  const fin = new Date(debut.getTime() + FENETRE_REGROUPEMENT_MS);

  const resultat = await prisma.marinNotification.updateMany({
    where: {
      marinId,
      event: ligne.event,
      content: ligne.content,
      createdAt: { gte: debut, lt: fin },
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return { lignesMarquees: resultat.count };
};

// Tout marquer lu, geste attendu d'un centre de notifications.
export const marquerToutLuMarin = async (marinId: string) => {
  const resultat = await prisma.marinNotification.updateMany({
    where: { marinId, readAt: null },
    data: { readAt: new Date() },
  });

  return { lignesMarquees: resultat.count };
};