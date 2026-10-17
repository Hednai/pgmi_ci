// ============================================
// features/referentials/referentials.service.ts
// Référentiels administrables : fonctions maritimes, types de certificats,
// prérequis et barèmes.
//
// Ces données pilotent le moteur de conformité, les frais et les formations.
// Elles sont modifiables par l'administrateur métier sans redéploiement
// (EF-015) : aucune de ces valeurs n'existe en dur dans le code.
// ============================================
import { prisma } from "../../lib/prisma.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { NotFoundError } from "../../utils/errors.js";
import type { Acteur } from "../../middleware/auth.js";
import { z } from "zod";
import type {
  fonctionSchema,
  certificateTypeSchema,
  feeScheduleSchema,
} from "./referentials.validation.js";

type DonneesFonction = z.infer<typeof fonctionSchema>;
type DonneesCertificat = z.infer<typeof certificateTypeSchema>;
type DonneesBareme = z.infer<typeof feeScheduleSchema>;

// Vue publique consommée par tous les formulaires du frontend.
// Un seul appel suffit à peupler listes déroulantes et libellés, ce qui
// permet de la mettre en cache dans le service worker.
export const chargerReferentiels = async () => {
  const [fonctions, certificats, baremes] = await Promise.all([
    prisma.fonction.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
    prisma.certificateType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      include: {
        requirementsFor: {
          include: { requiredType: { select: { id: true, code: true, label: true } } },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    prisma.feeSchedule.findMany({ where: { isActive: true } }),
  ]);

  return { fonctions, certificats, baremes };
};

// Trace commune à toute modification de référentiel
const tracer = (acteur: Acteur, cible: string, id: string, metadata: Record<string, unknown>) =>
  logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.REFERENTIAL_UPDATE,
    targetType: cible,
    targetId: id,
    metadata,
  });

// ---- Fonctions maritimes ----

export const creerFonction = async (donnees: DonneesFonction, acteur: Acteur) => {
  const fonction = await prisma.fonction.create({ data: donnees });
  await tracer(acteur, "Fonction", fonction.id, { operation: "creation", code: fonction.code });
  return fonction;
};

export const majFonction = async (id: string, donnees: Partial<DonneesFonction>, acteur: Acteur) => {
  const fonction = await prisma.fonction.update({ where: { id }, data: donnees });
  await tracer(acteur, "Fonction", id, { operation: "modification", ...donnees });
  return fonction;
};

// ---- Types de certificats ----

export const creerCertificat = async (donnees: DonneesCertificat, acteur: Acteur) => {
  const certificat = await prisma.certificateType.create({ data: donnees });
  await tracer(acteur, "CertificateType", certificat.id, {
    operation: "creation",
    code: certificat.code,
  });
  return certificat;
};

export const majCertificat = async (
  id: string,
  donnees: Partial<DonneesCertificat>,
  acteur: Acteur,
) => {
  const certificat = await prisma.certificateType.update({ where: { id }, data: donnees });
  await tracer(acteur, "CertificateType", id, { operation: "modification", ...donnees });
  return certificat;
};

// ---- Barèmes ----

// Un barème est unique par couple certificat et type de demande : la mise à
// jour se fait par upsert pour éviter les doublons contradictoires.
export const definirBareme = async (donnees: DonneesBareme, acteur: Acteur) => {
  const type = await prisma.certificateType.findUnique({
    where: { id: donnees.certificateTypeId },
    select: { id: true },
  });
  if (!type) throw new NotFoundError("Type de certificat inconnu.");

  const bareme = await prisma.feeSchedule.upsert({
    where: {
      certificateTypeId_requestType: {
        certificateTypeId: donnees.certificateTypeId,
        requestType: donnees.requestType,
      },
    },
    create: donnees,
    update: {
      amount: donnees.amount,
      currency: donnees.currency,
      isActive: donnees.isActive,
    },
  });

  await tracer(acteur, "FeeSchedule", bareme.id, {
    operation: "bareme",
    montant: donnees.amount,
    requestType: donnees.requestType,
  });

  return bareme;
};
