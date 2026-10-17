// ============================================
// services/storage/suppressionDifferee.ts
// Suppression fiable d'une pièce, malgré l'absence de transaction commune
// entre la base de données et le stockage objet.
//
// Motif « outbox » : l'intention de suppression est écrite en base, si
// possible dans la même transaction que le changement métier. Un travail
// périodique la draine ensuite contre le stockage. La base fait foi, le
// stockage rattrape.
// ============================================
import { prisma } from "../../lib/prisma.js";
import { logger } from "../../lib/logger.js";
import { STOCKAGE } from "../../config/constants.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { storage } from "./storage.service.js";
import { calculerReportMs } from "./reportSuppression.js";

// Motifs de suppression, cités à l'appel plutôt qu'écrits en clair.
// Ils se retrouvent tels quels dans la table et dans le journal d'audit.
export const MOTIF_SUPPRESSION = {
  REMPLACEMENT: "REMPLACEMENT",
  RETRAIT: "RETRAIT",
  // Fichier déposé alors que l'écriture en base a échoué
  COMPENSATION: "COMPENSATION",
} as const;

export type MotifSuppression = (typeof MOTIF_SUPPRESSION)[keyof typeof MOTIF_SUPPRESSION];

// Client d'écriture : le client global, ou le client d'une transaction en
// cours. Le type est volontairement structurel et minimal, pour que ce
// module n'impose pas aux appelants de manipuler les types générés.
export interface ClientSuppression {
  pendingDeletion: {
    upsert(arguments_: {
      where: { fileUrl: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

// Inscrire une pièce à supprimer.
//
// upsert et non create : la même URL peut être inscrite deux fois si une
// première tentative a échoué puis que le dossier est retouché. La
// contrainte d'unicité sur fileUrl ne doit pas faire échouer l'action
// métier pour autant.
export const planifierSuppression = async (
  fileUrl: string,
  reason: MotifSuppression,
  client: ClientSuppression = prisma as unknown as ClientSuppression,
): Promise<void> => {
  await client.pendingDeletion.upsert({
    where: { fileUrl },
    update: { reason, nextAttemptAt: new Date(), abandonedAt: null },
    create: { fileUrl, reason },
  });
};

// Retirer une inscription devenue sans objet : la suppression a abouti.
const oublier = async (fileUrl: string): Promise<void> => {
  await prisma.pendingDeletion.deleteMany({ where: { fileUrl } });
};

// Report avant la prochaine tentative. Croissance géométrique bornée.
const prochaineTentative = (tentatives: number): Date =>
  new Date(Date.now() + calculerReportMs(tentatives));

// Tentative immédiate, sans passer par la file.
// Utilisée en compensation, juste après un dépôt dont l'écriture en base a
// échoué : le fichier vient d'être créé, il est encore présent, la
// suppression a toutes les chances d'aboutir. En cas d'échec, l'inscription
// à la file prend le relais.
export const supprimerMaintenant = async (
  fileUrl: string,
  reason: MotifSuppression,
): Promise<void> => {
  try {
    await storage.supprimer(fileUrl);
  } catch (err) {
    logger.warn({ err, fileUrl, reason }, "Suppression immédiate impossible, inscription en file");
    await planifierSuppression(fileUrl, reason);
  }
};

// Drainer la file. Appelée par le planificateur, et exposée pour les tests.
export const traiterSuppressionsEnAttente = async (): Promise<{
  traitees: number;
  reportees: number;
  abandonnees: number;
}> => {
  const aTraiter = await prisma.pendingDeletion.findMany({
    where: { abandonedAt: null, nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: STOCKAGE.SUPPRESSION_LOT,
  });

  let traitees = 0;
  let reportees = 0;
  let abandonnees = 0;

  for (const entree of aTraiter) {
    try {
      await storage.supprimer(entree.fileUrl);
      await oublier(entree.fileUrl);
      traitees += 1;
    } catch (err) {
      const tentatives = entree.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);

      if (tentatives >= STOCKAGE.SUPPRESSION_TENTATIVES_MAX) {
        // La ligne n'est jamais effacée : elle reste en base, marquée
        // abandonnée, pour qu'un humain traite le fichier résiduel.
        await prisma.pendingDeletion.update({
          where: { id: entree.id },
          data: { attempts: tentatives, lastError: message, abandonedAt: new Date() },
        });

        await logAction({
          actorType: "SYSTEM",
          actorId: null,
          action: AUDIT_ACTION.FILE_DELETE_ABANDONED,
          targetType: "Fichier",
          targetId: entree.fileUrl,
          metadata: { motif: entree.reason, tentatives, erreur: message },
        });

        logger.error(
          { fileUrl: entree.fileUrl, tentatives },
          "Suppression abandonnée après épuisement des tentatives, intervention manuelle requise",
        );

        abandonnees += 1;
      } else {
        await prisma.pendingDeletion.update({
          where: { id: entree.id },
          data: {
            attempts: tentatives,
            lastError: message,
            nextAttemptAt: prochaineTentative(tentatives),
          },
        });

        logger.warn(
          { fileUrl: entree.fileUrl, tentatives, prochaine: prochaineTentative(tentatives) },
          "Suppression reportée",
        );

        reportees += 1;
      }
    }
  }

  return { traitees, reportees, abandonnees };
};