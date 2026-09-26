// ============================================
// features/marins/marins.service.ts
// Logique métier du dossier marin : profil, activation au guichet,
// inscription d'un élève navigant par l'ARSTM et validation DGAM.
// ============================================
import { prisma } from "../../lib/prisma.js";
import {
  MARIN_STATUS,
  REGISTRATION_SOURCE,
  EMBARKATION_STATUS,
  DOCUMENT_STATUS,
} from "../../domain/status.js";
import { genererMatricule } from "../../utils/reference.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import {
  notifierMarin,
  NOTIFICATION_EVENT,
} from "../../services/notification/notification.service.js";
import {
  NotFoundError,
  BusinessRuleError,
  ValidationError,
} from "../../utils/errors.js";
import { lirePagination, construireReponse } from "../../utils/pagination.js";
import { joursAvantExpiration } from "../../utils/dates.js";
import { EXPIRY_WARNING_WINDOW_DAYS } from "../../domain/rules.js";
import type { Acteur } from "../../middleware/auth.js";
import type { MajProfil, Activation, InscriptionEleve } from "./marins.validation.js";
import type { MarinSerialisable } from "./marin.serializer.js";

// Champs systématiquement chargés avec un marin
const INCLUDE_MARIN = { fonction: true } as const;

// ---- Consultation ----

export const obtenirMarin = async (marinId: string) => {
  const marin = await prisma.marin.findUnique({
    where: { id: marinId },
    include: INCLUDE_MARIN,
  });
  if (!marin) throw new NotFoundError("Dossier marin introuvable.");
  return marin;
};

// Synthèse du dossier affichée sur l'écran d'accueil du marin.
// Une seule requête par indicateur, pas de chargement de toutes les lignes :
// l'écran doit s'ouvrir vite sur une connexion 3G.
export const obtenirSyntheseMarin = async (marinId: string) => {
  const [marin, nbDocuments, joursVerifies, joursEnAttente, demandesEnCours, prochainesExpirations] =
    await Promise.all([
      obtenirMarin(marinId),
      prisma.document.count({ where: { marinId } }),
      prisma.embarkation.aggregate({
        where: { marinId, status: EMBARKATION_STATUS.VERIFIED },
        _sum: { days: true },
      }),
      prisma.embarkation.aggregate({
        where: { marinId, status: { in: [EMBARKATION_STATUS.DECLARED, EMBARKATION_STATUS.SUBMITTED] } },
        _sum: { days: true },
      }),
      prisma.renewalRequest.count({
        where: {
          marinId,
          status: { notIn: ["DOCUMENT_AVAILABLE", "REJECTED", "CANCELLED"] },
        },
      }),
      prisma.document.findMany({
        where: {
          marinId,
          expiryDate: { not: null },
          status: { in: [DOCUMENT_STATUS.VERIFIED, DOCUMENT_STATUS.OFFICIAL_DIGITAL] },
        },
        include: { certificateType: true },
        orderBy: { expiryDate: "asc" },
        take: 3,
      }),
    ]);

  // Alertes affichées en tête d'écran : uniquement les certificats entrés
  // dans leur dernière année de validité (R16).
  const alertes = prochainesExpirations
    .filter((doc) => doc.expiryDate !== null)
    .map((doc) => ({
      documentId: doc.id,
      certificat: doc.certificateType.label,
      code: doc.certificateType.code,
      expiryDate: doc.expiryDate,
      joursRestants: joursAvantExpiration(doc.expiryDate as Date),
      requiresTraining: doc.certificateType.requiresTraining,
    }))
    .filter((alerte) => alerte.joursRestants <= EXPIRY_WARNING_WINDOW_DAYS);

  return {
    marin,
    statistiques: {
      documents: nbDocuments,
      joursVerifies: joursVerifies._sum.days ?? 0,
      joursEnAttente: joursEnAttente._sum.days ?? 0,
      demandesEnCours,
    },
    alertes,
  };
};

// ---- Profil ----

export const majProfil = async (marinId: string, donnees: MajProfil) => {
  return prisma.marin.update({
    where: { id: marinId },
    data: {
      email: donnees.email && donnees.email.length > 0 ? donnees.email : null,
      region: donnees.region ?? undefined,
      shipCategory: donnees.shipCategory ?? undefined,
      fonctionId: donnees.fonctionId ?? undefined,
      photoUrl: donnees.photoUrl ?? undefined,
    },
    include: INCLUDE_MARIN,
  });
};

// Le SMS n'est pas modifiable : il reste vrai en base quoi qu'envoie le client (R17)
export const majPreferences = async (
  marinId: string,
  preferences: { whatsapp: boolean; email: boolean },
) => {
  const marin = await prisma.marin.findUnique({
    where: { id: marinId },
    select: { email: true },
  });

  if (preferences.email && !marin?.email) {
    throw new ValidationError(
      "Renseignez une adresse email avant d'activer les notifications par email.",
    );
  }

  return prisma.marin.update({
    where: { id: marinId },
    data: {
      notifySms: true,
      notifyWhatsapp: preferences.whatsapp,
      notifyEmail: preferences.email,
    },
    include: INCLUDE_MARIN,
  });
};

// ---- Guichet DGAM ----

export const listerMarins = async (filtres: Record<string, unknown>) => {
  const pagination = lirePagination(filtres);
  const recherche = typeof filtres.q === "string" ? filtres.q.trim() : "";

  const where = {
    ...(filtres.status ? { status: String(filtres.status) } : {}),
    ...(filtres.source ? { registrationSource: String(filtres.source) } : {}),
    ...(recherche
      ? {
          OR: [
            { firstName: { contains: recherche } },
            { lastName: { contains: recherche } },
            { matricule: { contains: recherche } },
            { phone: { contains: recherche } },
            { idNumber: { contains: recherche } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.marin.findMany({
      where,
      include: INCLUDE_MARIN,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.taille,
    }),
    prisma.marin.count({ where }),
  ]);

  return construireReponse<MarinSerialisable>(items, total, pagination);
};

// Attribuer un matricule unique. La collision est improbable mais possible :
// quelques essais valent mieux qu'une erreur au guichet.
const attribuerMatricule = async (propose?: string): Promise<string> => {
  if (propose && propose.length > 0) {
    const existant = await prisma.marin.findUnique({ where: { matricule: propose } });
    if (existant) throw new BusinessRuleError("Ce matricule est déjà attribué.", "R3");
    return propose;
  }

  for (let essai = 0; essai < 5; essai += 1) {
    const candidat = genererMatricule();
    const existant = await prisma.marin.findUnique({ where: { matricule: candidat } });
    if (!existant) return candidat;
  }

  throw new BusinessRuleError("Impossible d'attribuer un matricule, réessayez.");
};

// Activer un dossier marin après vérification d'identité en personne (R1).
// Même opération pour un marin inscrit en ligne et pour un élève ARSTM en
// attente de validation : dans les deux cas, un agent DGAM engage sa
// responsabilité en activant le compte (R20).
export const activerMarin = async (
  marinId: string,
  donnees: Activation,
  acteur: Acteur,
) => {
  const marin = await prisma.marin.findUnique({ where: { id: marinId } });
  if (!marin) throw new NotFoundError("Dossier marin introuvable.");

  if (marin.status === MARIN_STATUS.ACTIVE) {
    throw new BusinessRuleError("Ce dossier est déjà activé.");
  }

  // Un matricule déjà attribué n'est jamais remplacé (R3)
  const matricule = marin.matricule ?? (await attribuerMatricule(donnees.matricule));

  const actualise = await prisma.marin.update({
    where: { id: marinId },
    data: {
      status: MARIN_STATUS.ACTIVE,
      matricule,
      fonctionId: donnees.fonctionId ?? marin.fonctionId,
      region: donnees.region ?? marin.region,
      validatedById: acteur.id,
      validatedAt: new Date(),
    },
    include: INCLUDE_MARIN,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.MARIN_ACTIVATE,
    targetType: "Marin",
    targetId: marinId,
    metadata: {
      matricule,
      identityCheck: donnees.identityCheck,
      sourceInscription: marin.registrationSource,
    },
  });

  if (!marin.matricule) {
    await logAction({
      actorType: "AGENT",
      actorId: acteur.id,
      actorLabel: acteur.label,
      action: AUDIT_ACTION.MATRICULE_ASSIGNED,
      targetType: "Marin",
      targetId: marinId,
      metadata: { matricule },
    });
  }

  await notifierMarin({
    marinId,
    evenement: NOTIFICATION_EVENT.ACCOUNT_ACTIVATED,
    contenu: `PGMI : votre dossier marin est activé. Matricule ${matricule}. Vous pouvez déposer vos certificats.`,
    forcerSms: true,
  });

  return actualise;
};

export const suspendreMarin = async (marinId: string, motif: string, acteur: Acteur) => {
  const marin = await prisma.marin.update({
    where: { id: marinId },
    data: { status: MARIN_STATUS.SUSPENDED },
    include: INCLUDE_MARIN,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.MARIN_SUSPEND,
    targetType: "Marin",
    targetId: marinId,
    metadata: { motif },
  });

  return marin;
};

// ---- Module C : inscription d'un élève navigant par l'ARSTM ----

// L'ARSTM rencontre l'élève dans le cadre de sa scolarité : cette présence
// vaut vérification d'identité (R19). Le dossier est créé complet mais reste
// en PENDING_DGAM_VALIDATION, le matricule n'étant officialisé que par la
// DGAM (R20, option 2 retenue au dossier ARSTM).
export const inscrireEleveNavigant = async (
  donnees: InscriptionEleve,
  acteur: Acteur,
) => {
  const existant = await prisma.marin.findUnique({
    where: { phone: donnees.phone },
    select: { id: true },
  });
  if (existant) {
    throw new ValidationError("Un dossier existe déjà pour ce numéro de téléphone.");
  }

  // L'élève est rattaché à l'autorité nationale, pas à l'ARSTM : son dossier
  // appartient au registre national dès sa création.
  const dgam = await prisma.authority.findFirst({
    where: { level: "NATIONAL" },
    select: { id: true },
  });
  if (!dgam) throw new NotFoundError("Autorité maritime non configurée.");

  const eleve = await prisma.marin.create({
    data: {
      authorityId: dgam.id,
      phone: donnees.phone,
      email: donnees.email && donnees.email.length > 0 ? donnees.email : null,
      firstName: donnees.firstName,
      lastName: donnees.lastName,
      birthDate: donnees.birthDate,
      birthPlace: donnees.birthPlace,
      nationality: donnees.nationality,
      idNumber: donnees.idNumber,
      region: donnees.region ?? null,
      fonctionId: donnees.fonctionId ?? null,
      status: MARIN_STATUS.PENDING_DGAM_VALIDATION,
      registrationSource: REGISTRATION_SOURCE.ARSTM_ENROLLMENT,
      isCadet: true,
      createdById: acteur.id,
      notifyEmail: Boolean(donnees.email),
    },
    include: INCLUDE_MARIN,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.MARIN_CREATED_BY_ARSTM,
    targetType: "Marin",
    targetId: eleve.id,
    metadata: {
      identityCheck: donnees.identityCheck,
      source: REGISTRATION_SOURCE.ARSTM_ENROLLMENT,
      regle: "R19",
    },
  });

  await notifierMarin({
    marinId: eleve.id,
    evenement: NOTIFICATION_EVENT.CADET_REGISTERED,
    contenu:
      "PGMI : bienvenue. Votre dossier d'élève navigant a été créé par l'ARSTM. Votre matricule est en cours d'attribution par la DGAM.",
    forcerSms: true,
  });

  return eleve;
};

// File d'attente des élèves ARSTM en attente de validation DGAM.
// C'est l'écran de travail quotidien de l'agent DGAM chargé du partenariat.
export const listerValidationsEnAttente = async (filtres: Record<string, unknown>) => {
  const pagination = lirePagination(filtres);

  const where = {
    status: MARIN_STATUS.PENDING_DGAM_VALIDATION,
    registrationSource: REGISTRATION_SOURCE.ARSTM_ENROLLMENT,
  };

  const [items, total] = await Promise.all([
    prisma.marin.findMany({
      where,
      include: { ...INCLUDE_MARIN, createdBy: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "asc" },
      skip: pagination.skip,
      take: pagination.taille,
    }),
    prisma.marin.count({ where }),
  ]);

  return construireReponse<MarinSerialisable>(items, total, pagination);
};
