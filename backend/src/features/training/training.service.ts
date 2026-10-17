// ============================================
// features/training/training.service.ts
// Module formation ARSTM (modules A et C du dossier d'intégration).
//
// Deux mécanismes portent la valeur du partenariat :
//   R15, une session ne démarre pas sous le seuil de quorum ;
//   R18, une réussite prépare une demande de renouvellement pré-remplie.
//
// Le quorum est réévalué à chaque mouvement d'inscription : l'ARSTM n'a
// aucune action manuelle à faire pour savoir qu'un groupe est complet.
// ============================================
import { prisma } from "../../lib/prisma.js";
import {
  SESSION_STATUS,
  ENROLLMENT_STATUS,
  ENROLLMENT_SOURCE,
  MARIN_STATUS,
} from "../../domain/status.js";
import type { EnrollmentSource } from "../../domain/status.js";
import { AUTHORITY_LEVEL } from "../../domain/roles.js";
import { genererCodeSession } from "../../utils/reference.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { lirePagination, construireReponse } from "../../utils/pagination.js";
import { formaterDate } from "../../utils/dates.js";
import {
  NotFoundError,
  BusinessRuleError,
  ForbiddenError,
  ValidationError,
} from "../../utils/errors.js";
import {
  notifierMarin,
  NOTIFICATION_EVENT,
} from "../../services/notification/notification.service.js";
import type { Acteur } from "../../middleware/auth.js";

const INCLUDE_SESSION = {
  certificateType: { select: { id: true, code: true, label: true, trainingDays: true } },
  authority: { select: { id: true, code: true, name: true } },
  enrollments: {
    include: {
      marin: { select: { id: true, firstName: true, lastName: true, matricule: true, phone: true } },
    },
  },
} as const;

// Inscriptions qui comptent dans le quorum : celles que le marin a
// confirmées. Une proposition non acceptée ne remplit pas une salle.
const STATUTS_COMPTES: string[] = [ENROLLMENT_STATUS.PENDING, ENROLLMENT_STATUS.CONFIRMED];

// ---- Sessions ----

export const listerSessions = async (filtres: Record<string, unknown>, authorityId?: string) => {
  const pagination = lirePagination(filtres);

  const where = {
    ...(authorityId ? { authorityId } : {}),
    ...(filtres.status ? { status: String(filtres.status) } : {}),
    ...(filtres.certificateTypeId
      ? { certificateTypeId: String(filtres.certificateTypeId) }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.trainingSession.findMany({
      where,
      include: INCLUDE_SESSION,
      orderBy: [{ status: "asc" }, { startDate: "asc" }],
      skip: pagination.skip,
      take: pagination.taille,
    }),
    prisma.trainingSession.count({ where }),
  ]);

  // Compteur de quorum calculé à la lecture : une seule vérité, pas de
  // champ dénormalisé à maintenir synchronisé.
  const enrichies = items.map((session) => {
    const confirmes = session.enrollments.filter((inscription) =>
      STATUTS_COMPTES.includes(inscription.status),
    ).length;

    return {
      ...session,
      quorum: {
        confirmes,
        requis: session.minQuorum,
        atteint: confirmes >= session.minQuorum,
        manquants: Math.max(session.minQuorum - confirmes, 0),
      },
    };
  });

  return construireReponse(enrichies, total, pagination);
};

// Sessions visibles par un marin : ouvertes aux inscriptions ou programmées
export const listerSessionsOuvertes = async (certificateTypeId?: string) => {
  const sessions = await prisma.trainingSession.findMany({
    where: {
      status: { in: [SESSION_STATUS.WAITING_FOR_QUORUM, SESSION_STATUS.SCHEDULED] },
      ...(certificateTypeId ? { certificateTypeId } : {}),
    },
    include: {
      certificateType: { select: { id: true, code: true, label: true } },
      authority: { select: { code: true, name: true } },
      // Le marin voit le nombre d'inscrits, jamais leur identité
      _count: { select: { enrollments: true } },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });

  return sessions;
};

export const creerSession = async (
  donnees: {
    certificateTypeId: string;
    startDate?: Date;
    endDate?: Date;
    location?: string;
    trainer?: string;
    capacity: number;
    minQuorum: number;
  },
  acteur: Acteur,
) => {
  const type = await prisma.certificateType.findUnique({
    where: { id: donnees.certificateTypeId },
  });
  if (!type?.isActive) throw new NotFoundError("Module de formation inconnu.");

  const autorite = await prisma.authority.findUnique({
    where: { id: acteur.authorityId ?? "" },
    select: { id: true, level: true },
  });
  if (autorite?.level !== AUTHORITY_LEVEL.TRAINING_INSTITUTION) {
    throw new ForbiddenError("Seule une institution de formation ouvre une session.");
  }

  // Une session créée avec ses dates est directement programmée, sinon elle
  // attend son quorum.
  const programmee = Boolean(donnees.startDate && donnees.location && donnees.trainer);

  const session = await prisma.trainingSession.create({
    data: {
      code: genererCodeSession(),
      authorityId: autorite.id,
      certificateTypeId: type.id,
      startDate: donnees.startDate ?? null,
      endDate: donnees.endDate ?? null,
      location: donnees.location ?? null,
      trainer: donnees.trainer ?? null,
      capacity: donnees.capacity,
      minQuorum: donnees.minQuorum,
      status: programmee ? SESSION_STATUS.SCHEDULED : SESSION_STATUS.WAITING_FOR_QUORUM,
      createdById: acteur.id,
    },
    include: INCLUDE_SESSION,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.SESSION_CREATE,
    targetType: "TrainingSession",
    targetId: session.id,
    metadata: { module: type.code, quorum: donnees.minQuorum },
  });

  return session;
};

// Programmer une session : dates, lieu, formateur.
// Refusée tant que le quorum n'est pas atteint (R15) : c'est la garantie
// donnée à l'ARSTM de ne pas mobiliser une salle pour trois personnes.
export const planifierSession = async (
  sessionId: string,
  donnees: { startDate: Date; endDate: Date; location: string; trainer: string },
  acteur: Acteur,
) => {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: INCLUDE_SESSION,
  });
  if (!session) throw new NotFoundError("Session introuvable.");

  if (session.authorityId !== acteur.authorityId) {
    throw new ForbiddenError("Cette session appartient à une autre institution.");
  }

  const confirmes = session.enrollments.filter((inscription) =>
    STATUTS_COMPTES.includes(inscription.status),
  ).length;

  if (confirmes < session.minQuorum) {
    throw new BusinessRuleError(
      `Quorum non atteint : ${confirmes} inscrit(s) sur ${session.minQuorum} requis.`,
      "R15",
    );
  }

  const actualisee = await prisma.trainingSession.update({
    where: { id: sessionId },
    data: {
      startDate: donnees.startDate,
      endDate: donnees.endDate,
      location: donnees.location,
      trainer: donnees.trainer,
      status: SESSION_STATUS.SCHEDULED,
    },
    include: INCLUDE_SESSION,
  });

  await prisma.trainingEnrollment.updateMany({
    where: { sessionId, status: ENROLLMENT_STATUS.PENDING },
    data: { status: ENROLLMENT_STATUS.CONFIRMED },
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.SESSION_SCHEDULE,
    targetType: "TrainingSession",
    targetId: sessionId,
    metadata: { debut: donnees.startDate, lieu: donnees.location, inscrits: confirmes },
  });

  // Notification à tous les inscrits, sur les trois canaux
  for (const inscription of actualisee.enrollments) {
    await notifierMarin({
      marinId: inscription.marinId,
      evenement: NOTIFICATION_EVENT.TRAINING_SCHEDULED,
      contenu: `PGMI : formation ${actualisee.certificateType.label} programmée du ${formaterDate(donnees.startDate)} au ${formaterDate(donnees.endDate)} à ${donnees.location}. Formateur : ${donnees.trainer}.`,
      forcerSms: true,
    });
  }

  return actualisee;
};

// ---- Inscriptions ----

// Réévaluer le quorum après tout mouvement. Si le seuil est franchi, la
// session reste en attente de programmation mais l'ARSTM est alertée par
// l'indicateur de son tableau de bord.
const evaluerQuorum = async (sessionId: string) => {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: { enrollments: true, certificateType: true },
  });
  if (!session) return null;

  const confirmes = session.enrollments.filter((inscription) =>
    STATUTS_COMPTES.includes(inscription.status),
  ).length;

  return {
    confirmes,
    requis: session.minQuorum,
    atteint: confirmes >= session.minQuorum,
  };
};

// Créer une inscription. Point d'entrée unique du marin, de l'ARSTM et du
// scan automatique : la source est tracée, le reste du traitement est
// identique.
export const inscrireAFormation = async (parametres: {
  marinId: string;
  certificateTypeId: string;
  sessionId?: string;
  source: EnrollmentSource;
  acteur?: Acteur;
  statutInitial?: string;
}) => {
  const [marin, type] = await Promise.all([
    prisma.marin.findUnique({
      where: { id: parametres.marinId },
      select: { id: true, status: true },
    }),
    prisma.certificateType.findUnique({ where: { id: parametres.certificateTypeId } }),
  ]);

  if (!marin) throw new NotFoundError("Dossier marin introuvable.");
  if (!type?.isActive) throw new NotFoundError("Module de formation inconnu.");
  if (marin.status === MARIN_STATUS.SUSPENDED) {
    throw new ForbiddenError("Ce dossier marin est suspendu.");
  }

  // Une inscription active sur le même module suffit : pas de doublon
  const existante = await prisma.trainingEnrollment.findFirst({
    where: {
      marinId: parametres.marinId,
      certificateTypeId: parametres.certificateTypeId,
      status: {
        in: [ENROLLMENT_STATUS.PROPOSED, ENROLLMENT_STATUS.PENDING, ENROLLMENT_STATUS.CONFIRMED],
      },
    },
  });
  if (existante) return existante;

  // Session choisie : contrôle de capacité avant d'accepter
  if (parametres.sessionId) {
    const session = await prisma.trainingSession.findUnique({
      where: { id: parametres.sessionId },
      include: { enrollments: true },
    });
    if (!session) throw new NotFoundError("Session introuvable.");
    if (session.status === SESSION_STATUS.COMPLETED || session.status === SESSION_STATUS.CANCELLED) {
      throw new BusinessRuleError("Cette session n'accepte plus d'inscription.");
    }
    if (session.enrollments.length >= session.capacity) {
      throw new BusinessRuleError("Cette session est complète.");
    }
    if (session.certificateTypeId !== parametres.certificateTypeId) {
      throw new ValidationError("La session ne correspond pas au module demandé.");
    }
  }

  const inscription = await prisma.trainingEnrollment.create({
    data: {
      marinId: parametres.marinId,
      certificateTypeId: parametres.certificateTypeId,
      sessionId: parametres.sessionId ?? null,
      status: parametres.statutInitial ?? ENROLLMENT_STATUS.PENDING,
      source: parametres.source,
    },
    include: { certificateType: true, session: true },
  });

  await logAction({
    actorType: parametres.acteur ? "AGENT" : "SYSTEM",
    actorId: parametres.acteur?.id ?? parametres.marinId,
    actorLabel: parametres.acteur?.label ?? null,
    action: AUDIT_ACTION.ENROLLMENT_CREATE,
    targetType: "TrainingEnrollment",
    targetId: inscription.id,
    metadata: { module: type.code, source: parametres.source },
  });

  if (parametres.sessionId) {
    const quorum = await evaluerQuorum(parametres.sessionId);

    // Message différent selon que le groupe est complet ou non : c'est
    // exactement l'information qu'attend un marin inscrit en liste.
    await notifierMarin({
      marinId: parametres.marinId,
      evenement: quorum?.atteint
        ? NOTIFICATION_EVENT.TRAINING_SCHEDULED
        : NOTIFICATION_EVENT.TRAINING_WAITING_QUORUM,
      contenu: quorum?.atteint
        ? `PGMI : inscription enregistrée pour ${type.label}. Le groupe est complet, les dates vous seront communiquées par l'ARSTM.`
        : `PGMI : inscription enregistrée pour ${type.label}. En attente de groupe (${quorum?.confirmes} sur ${quorum?.requis}).`,
    });
  }

  return inscription;
};

// Réponse du marin à une proposition automatique (module B)
export const repondreProposition = async (
  enrollmentId: string,
  marinId: string,
  accepte: boolean,
) => {
  const inscription = await prisma.trainingEnrollment.findUnique({
    where: { id: enrollmentId },
    include: { certificateType: true },
  });
  if (!inscription) throw new NotFoundError("Proposition introuvable.");
  if (inscription.marinId !== marinId) {
    throw new ForbiddenError("Cette proposition ne vous concerne pas.");
  }
  if (inscription.status !== ENROLLMENT_STATUS.PROPOSED) {
    throw new BusinessRuleError("Cette proposition a déjà reçu une réponse.");
  }

  const actualisee = await prisma.trainingEnrollment.update({
    where: { id: enrollmentId },
    data: { status: accepte ? ENROLLMENT_STATUS.PENDING : ENROLLMENT_STATUS.DECLINED },
    include: { certificateType: true, session: true },
  });

  await logAction({
    actorType: "MARIN",
    actorId: marinId,
    action: AUDIT_ACTION.ENROLLMENT_STATUS_CHANGE,
    targetType: "TrainingEnrollment",
    targetId: enrollmentId,
    metadata: { reponse: accepte ? "acceptee" : "refusee" },
  });

  return actualisee;
};

export const listerInscriptionsMarin = async (marinId: string) =>
  prisma.trainingEnrollment.findMany({
    where: { marinId },
    include: {
      certificateType: { select: { id: true, code: true, label: true } },
      session: {
        select: {
          id: true,
          code: true,
          startDate: true,
          endDate: true,
          location: true,
          trainer: true,
          status: true,
          minQuorum: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

// File d'attente par module, vue ARSTM.
// C'est l'indicateur qui donne à l'ARSTM sa visibilité anticipée sur la
// demande, des mois à l'avance.
export const listerFileAttenteParModule = async (authorityId: string) => {
  const inscriptions = await prisma.trainingEnrollment.findMany({
    where: {
      status: { in: [ENROLLMENT_STATUS.PROPOSED, ENROLLMENT_STATUS.PENDING] },
      OR: [{ sessionId: null }, { session: { authorityId } }],
    },
    include: {
      certificateType: { select: { id: true, code: true, label: true, trainingDays: true } },
      marin: { select: { id: true, firstName: true, lastName: true, matricule: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Regroupement par module, avec le nombre de marins en attente
  interface EntreeModule {
    certificateTypeId: string;
    code: string;
    label: string;
    enAttente: number;
    proposesNonRepondus: number;
    marins: { id: string; nom: string; matricule: string | null }[];
  }

  const parModule = new Map<string, EntreeModule>();

  for (const inscription of inscriptions) {
    const cle = inscription.certificateTypeId;
    const entree: EntreeModule = parModule.get(cle) ?? {
      certificateTypeId: cle,
      code: inscription.certificateType.code,
      label: inscription.certificateType.label,
      enAttente: 0,
      proposesNonRepondus: 0,
      marins: [],
    };

    if (inscription.status === ENROLLMENT_STATUS.PENDING) entree.enAttente += 1;
    else entree.proposesNonRepondus += 1;

    entree.marins.push({
      id: inscription.marin.id,
      nom: `${inscription.marin.firstName} ${inscription.marin.lastName}`,
      matricule: inscription.marin.matricule,
    });

    parModule.set(cle, entree);
  }

  return Array.from(parModule.values()).sort((a, b) => b.enAttente - a.enAttente);
};

// ---- Résultats ----

// Saisir les résultats d'une session terminée.
// Une réussite prépare une demande de renouvellement pré-remplie (R18) :
// le marin confirmera et paiera, sans ressaisir le formulaire.
export const enregistrerResultats = async (
  sessionId: string,
  resultats: { enrollmentId: string; present: boolean; resultat: "PASSED" | "FAILED" }[],
  acteur: Acteur,
) => {
  const session = await prisma.trainingSession.findUnique({
    where: { id: sessionId },
    include: { certificateType: true },
  });
  if (!session) throw new NotFoundError("Session introuvable.");
  if (session.authorityId !== acteur.authorityId) {
    throw new ForbiddenError("Cette session appartient à une autre institution.");
  }

  for (const ligne of resultats) {
    const inscription = await prisma.trainingEnrollment.update({
      where: { id: ligne.enrollmentId },
      data: {
        attended: ligne.present,
        result: ligne.resultat,
        status: ENROLLMENT_STATUS.COMPLETED,
      },
    });

    await notifierMarin({
      marinId: inscription.marinId,
      evenement: NOTIFICATION_EVENT.TRAINING_RESULT,
      contenu:
        ligne.resultat === "PASSED"
          ? `PGMI : formation ${session.certificateType.label} réussie. Votre demande de renouvellement est prête, confirmez-la dans l'application.`
          : `PGMI : formation ${session.certificateType.label} non validée. Rapprochez-vous de l'ARSTM pour la suite.`,
      forcerSms: true,
    });
  }

  const actualisee = await prisma.trainingSession.update({
    where: { id: sessionId },
    data: { status: SESSION_STATUS.COMPLETED },
    include: INCLUDE_SESSION,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.SESSION_RESULT,
    targetType: "TrainingSession",
    targetId: sessionId,
    metadata: {
      module: session.certificateType.code,
      reussites: resultats.filter((ligne) => ligne.resultat === "PASSED").length,
      total: resultats.length,
    },
  });

  return actualisee;
};

// ---- Tableau de bord ARSTM ----

// Indicateurs de l'institut : ce que l'ARSTM regarde le matin.
export const syntheseArstm = async (authorityId: string) => {
  const [sessionsAttente, sessionsProgrammees, inscriptionsEnAttente, elevesEnAttente, fileAttente] =
    await Promise.all([
      prisma.trainingSession.count({
        where: { authorityId, status: SESSION_STATUS.WAITING_FOR_QUORUM },
      }),
      prisma.trainingSession.count({
        where: { authorityId, status: SESSION_STATUS.SCHEDULED },
      }),
      prisma.trainingEnrollment.count({
        where: { status: { in: [ENROLLMENT_STATUS.PROPOSED, ENROLLMENT_STATUS.PENDING] } },
      }),
      prisma.marin.count({
        where: {
          registrationSource: "ARSTM_ENROLLMENT",
          status: MARIN_STATUS.PENDING_DGAM_VALIDATION,
        },
      }),
      listerFileAttenteParModule(authorityId),
    ]);

  return {
    sessionsAttente,
    sessionsProgrammees,
    inscriptionsEnAttente,
    elevesEnAttenteValidation: elevesEnAttente,
    fileAttente,
  };
};
