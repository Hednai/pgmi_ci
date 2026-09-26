// ============================================
// features/requests/requests.service.ts
// Workflow des demandes de renouvellement et de première délivrance.
//
// Le fichier applique trois garde-fous côté serveur :
//   R6, celui qui soumet ne décide jamais ;
//   R8, pas d'instruction avant confirmation du paiement ;
//   R9, un rejet sans motif est refusé.
// La matrice REQUEST_TRANSITIONS interdit tout saut d'étape.
// ============================================
import { prisma } from "../../lib/prisma.js";
import {
  REQUEST_STATUS,
  REQUEST_TYPE,
  SUBMITTED_BY_ROLE,
  PAYMENT_STATUS,
  REQUEST_TRANSITIONS,
} from "../../domain/status.js";
import type { RequestStatus, SubmittedByRole } from "../../domain/status.js";
import { ARSTM_ROLES, DGAM_DECISION_ROLES } from "../../domain/roles.js";
import type { AgentRole } from "../../domain/roles.js";
import { genererReferenceDemande } from "../../utils/reference.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { lirePagination, construireReponse } from "../../utils/pagination.js";
import {
  NotFoundError,
  BusinessRuleError,
  ForbiddenError,
  ValidationError,
} from "../../utils/errors.js";
import { storage } from "../../services/storage/storage.service.js";
import {
  notifierMarin,
  NOTIFICATION_EVENT,
} from "../../services/notification/notification.service.js";
import { delivrerDocumentOfficiel } from "../documents/documents.service.js";
import type { Acteur } from "../../middleware/auth.js";

const INCLUDE_DEMANDE = {
  certificateType: true,
  attachments: true,
  payments: true,
  marin: {
    select: { id: true, firstName: true, lastName: true, matricule: true, phone: true },
  },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
  decidedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

// Vérifier une transition avant de l'écrire.
// Centralisé ici : aucun contrôleur ne modifie un statut directement.
const verifierTransition = (actuel: string, cible: RequestStatus) => {
  const autorisees = REQUEST_TRANSITIONS[actuel as RequestStatus] ?? [];
  if (!autorisees.includes(cible)) {
    throw new BusinessRuleError(
      `Transition refusée : une demande ${actuel} ne peut pas passer à ${cible}.`,
    );
  }
};

// Montant des frais, lu dans le barème administrable. Absence de barème
// signifie gratuité, pas erreur : certaines démarches sont exonérées.
const lireMontant = async (certificateTypeId: string, type: string) => {
  const bareme = await prisma.feeSchedule.findFirst({
    where: { certificateTypeId, requestType: type, isActive: true },
  });
  return { montant: bareme?.amount ?? 0, devise: bareme?.currency ?? "XOF" };
};

// Changement de statut tracé et notifié, utilisé par toutes les étapes
const changerStatut = async (parametres: {
  requestId: string;
  cible: RequestStatus;
  acteur: Acteur | null;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  messageMarin?: string;
  forcerSms?: boolean;
}) => {
  const demande = await prisma.renewalRequest.findUnique({
    where: { id: parametres.requestId },
    select: { id: true, status: true, marinId: true, reference: true },
  });
  if (!demande) throw new NotFoundError("Demande introuvable.");

  verifierTransition(demande.status, parametres.cible);

  const actualisee = await prisma.renewalRequest.update({
    where: { id: parametres.requestId },
    data: { status: parametres.cible, ...(parametres.data ?? {}) },
    include: INCLUDE_DEMANDE,
  });

  await logAction({
    actorType: parametres.acteur ? "AGENT" : "SYSTEM",
    actorId: parametres.acteur?.id ?? null,
    actorLabel: parametres.acteur?.label ?? null,
    action: AUDIT_ACTION.REQUEST_STATUS_CHANGE,
    targetType: "RenewalRequest",
    targetId: demande.id,
    metadata: { de: demande.status, vers: parametres.cible, ...(parametres.metadata ?? {}) },
  });

  if (parametres.messageMarin) {
    await notifierMarin({
      marinId: demande.marinId,
      evenement: NOTIFICATION_EVENT.REQUEST_STATUS_CHANGED,
      contenu: parametres.messageMarin,
      forcerSms: parametres.forcerSms,
    });
  }

  return actualisee;
};

// ---- Soumission ----

interface DonneesSoumission {
  certificateTypeId: string;
  type: string;
  sourceDocumentId?: string;
  reason?: string;
  attachments?: { nom: string; mimeType: string; contenuBase64: string }[];
}

// Créer une demande pour un marin donné.
// submittedByRole distingue une demande du marin, d'un agent DGAM, ou de
// l'ARSTM agissant pour un élève : c'est ce champ qui sera confronté au
// décideur au moment de l'approbation (R6, R21).
export const soumettreDemande = async (parametres: {
  marinId: string;
  donnees: DonneesSoumission;
  acteur: Acteur | null;
  submittedByRole: SubmittedByRole;
}) => {
  const { marinId, donnees } = parametres;

  const [marin, type] = await Promise.all([
    prisma.marin.findUnique({ where: { id: marinId }, select: { id: true, status: true } }),
    prisma.certificateType.findUnique({ where: { id: donnees.certificateTypeId } }),
  ]);

  if (!marin) throw new NotFoundError("Dossier marin introuvable.");
  if (!type?.isActive) throw new NotFoundError("Type de certificat inconnu.");

  // Le document source doit appartenir au marin concerné (R11)
  if (donnees.sourceDocumentId) {
    const source = await prisma.document.findUnique({
      where: { id: donnees.sourceDocumentId },
      select: { marinId: true },
    });
    if (!source || source.marinId !== marinId) {
      throw new ValidationError("Le document à renouveler n'appartient pas à ce marin.");
    }
  }

  const { montant, devise } = await lireMontant(type.id, donnees.type);

  const demande = await prisma.renewalRequest.create({
    data: {
      reference: genererReferenceDemande(),
      marinId,
      certificateTypeId: type.id,
      sourceDocumentId: donnees.sourceDocumentId ?? null,
      type: donnees.type,
      reason: donnees.reason ?? null,
      feeAmount: montant,
      currency: devise,
      // Sans frais, la demande part directement en instruction (R8)
      status: montant > 0 ? REQUEST_STATUS.AWAITING_PAYMENT : REQUEST_STATUS.SUBMITTED,
      submittedById: parametres.acteur?.type === "AGENT" ? parametres.acteur.id : null,
      submittedByRole: parametres.submittedByRole,
    },
    include: INCLUDE_DEMANDE,
  });

  // Les pièces jointes sont enregistrées après la création : leur chemin de
  // stockage contient la référence de la demande.
  if (donnees.attachments?.length) {
    for (const fichier of donnees.attachments) {
      const stocke = await storage.enregistrer(`demandes/${demande.id}`, fichier);
      await prisma.requestAttachment.create({
        data: {
          requestId: demande.id,
          fileName: stocke.nom,
          fileUrl: stocke.url,
          mimeType: stocke.mimeType,
          size: stocke.taille,
        },
      });
    }
  }

  await logAction({
    actorType: parametres.acteur?.type === "AGENT" ? "AGENT" : "MARIN",
    actorId: parametres.acteur?.id ?? marinId,
    actorLabel: parametres.acteur?.label ?? null,
    action: AUDIT_ACTION.REQUEST_SUBMIT,
    targetType: "RenewalRequest",
    targetId: demande.id,
    metadata: {
      reference: demande.reference,
      certificat: type.code,
      soumisPar: parametres.submittedByRole,
      montant,
    },
  });

  await notifierMarin({
    marinId,
    evenement: NOTIFICATION_EVENT.REQUEST_SUBMITTED,
    contenu:
      montant > 0
        ? `PGMI : demande ${demande.reference} enregistrée. Réglez ${montant} FCFA pour lancer l'instruction.`
        : `PGMI : demande ${demande.reference} enregistrée et transmise à la DGAM.`,
  });

  return prisma.renewalRequest.findUnique({
    where: { id: demande.id },
    include: INCLUDE_DEMANDE,
  });
};

// Demande ouverte par l'ARSTM pour un élève (module D).
// Contrôle supplémentaire : l'élève doit bien être issu d'une inscription
// ARSTM, l'institut ne peut pas ouvrir de dossier pour un marin quelconque.
export const soumettreDemandePourEleve = async (parametres: {
  marinId: string;
  donnees: DonneesSoumission;
  acteur: Acteur;
}) => {
  const eleve = await prisma.marin.findUnique({
    where: { id: parametres.marinId },
    select: { id: true, isCadet: true, registrationSource: true },
  });

  if (!eleve) throw new NotFoundError("Élève introuvable.");
  if (!eleve.isCadet || eleve.registrationSource !== "ARSTM_ENROLLMENT") {
    throw new ForbiddenError(
      "Ce dossier n'est pas un élève navigant inscrit par l'ARSTM.",
      "R21",
    );
  }

  return soumettreDemande({
    marinId: parametres.marinId,
    donnees: parametres.donnees,
    acteur: parametres.acteur,
    submittedByRole: SUBMITTED_BY_ROLE.ARSTM_ENROLLMENT_AGENT,
  });
};

// ---- Paiement ----

// Appelée après confirmation du règlement : la demande entre dans la file
// d'instruction de la DGAM.
export const confirmerPaiementDemande = async (requestId: string) => {
  const demande = await prisma.renewalRequest.findUnique({
    where: { id: requestId },
    include: { payments: true },
  });
  if (!demande) throw new NotFoundError("Demande introuvable.");

  const paye = demande.payments.some((paiement) => paiement.status === PAYMENT_STATUS.PAID);
  if (!paye) throw new BusinessRuleError("Aucun paiement confirmé sur cette demande.", "R8");

  if (demande.status !== REQUEST_STATUS.AWAITING_PAYMENT) return demande;

  return changerStatut({
    requestId,
    cible: REQUEST_STATUS.ASSIGNED,
    acteur: null,
    metadata: { motif: "Paiement confirmé" },
    messageMarin: `PGMI : paiement reçu pour la demande ${demande.reference}. Instruction en cours.`,
  });
};

// ---- Instruction ----

export const assignerDemande = async (
  requestId: string,
  agentId: string,
  acteur: Acteur,
) => {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, role: true, isActive: true },
  });

  if (!agent?.isActive) throw new NotFoundError("Agent introuvable.");
  if (!DGAM_DECISION_ROLES.includes(agent.role as AgentRole)) {
    throw new ValidationError("Seul un agent DGAM peut instruire une demande.");
  }

  const demande = await prisma.renewalRequest.findUnique({
    where: { id: requestId },
    select: { status: true, submittedById: true },
  });
  if (!demande) throw new NotFoundError("Demande introuvable.");

  // Anticipation de R6 : assigner l'instruction à celui qui a soumis la
  // demande serait refusé plus tard à l'approbation, autant le bloquer ici.
  if (demande.submittedById && demande.submittedById === agentId) {
    throw new BusinessRuleError(
      "Cet agent a soumis la demande, il ne peut pas l'instruire.",
      "R6",
    );
  }

  const cible =
    demande.status === REQUEST_STATUS.ASSIGNED
      ? REQUEST_STATUS.IN_REVIEW
      : REQUEST_STATUS.ASSIGNED;

  const actualisee = await changerStatut({
    requestId,
    cible,
    acteur,
    data: { assignedToId: agentId, assignedAt: new Date() },
    metadata: { assigneA: agentId },
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.REQUEST_ASSIGN,
    targetType: "RenewalRequest",
    targetId: requestId,
    metadata: { assigneA: agentId },
  });

  return actualisee;
};

export const prendreEnInstruction = async (requestId: string, acteur: Acteur) =>
  changerStatut({
    requestId,
    cible: REQUEST_STATUS.IN_REVIEW,
    acteur,
    data: { assignedToId: acteur.id, assignedAt: new Date() },
    messageMarin: "PGMI : votre demande est en cours d'instruction.",
  });

export const demanderComplement = async (
  requestId: string,
  message: string,
  acteur: Acteur,
) =>
  changerStatut({
    requestId,
    cible: REQUEST_STATUS.INFO_REQUESTED,
    acteur,
    data: { additionalInfo: message },
    metadata: { message },
    messageMarin: `PGMI : pièces complémentaires demandées. ${message}`,
    forcerSms: true,
  });

// Approuver une demande puis délivrer le document officiel.
// C'est ici que R6 et R21 sont réellement appliqués.
export const approuverDemande = async (
  requestId: string,
  motif: string | undefined,
  acteur: Acteur,
) => {
  const demande = await prisma.renewalRequest.findUnique({
    where: { id: requestId },
    include: { certificateType: true, payments: true },
  });
  if (!demande) throw new NotFoundError("Demande introuvable.");

  // R21 : aucun rôle ARSTM ne décide, quelle que soit la demande
  if (acteur.role && ARSTM_ROLES.includes(acteur.role)) {
    throw new ForbiddenError(
      "Une institution de formation ne peut pas approuver un document officiel.",
      "R21",
    );
  }

  // R6 : séparation des pouvoirs
  if (demande.submittedById && demande.submittedById === acteur.id) {
    throw new ForbiddenError("Vous ne pouvez pas approuver une demande que vous avez soumise.", "R6");
  }

  // R8 : pas de délivrance sans règlement des frais dus
  if (demande.feeAmount > 0) {
    const paye = demande.payments.some((paiement) => paiement.status === PAYMENT_STATUS.PAID);
    if (!paye) throw new BusinessRuleError("Les frais de dossier ne sont pas réglés.", "R8");
  }

  const approuvee = await changerStatut({
    requestId,
    cible: REQUEST_STATUS.APPROVED,
    acteur,
    data: { decidedById: acteur.id, decidedAt: new Date(), decisionReason: motif ?? null },
  });

  const document = await delivrerDocumentOfficiel({
    marinId: demande.marinId,
    certificateTypeId: demande.certificateTypeId,
    sourceDocumentId: demande.sourceDocumentId,
    acteur,
    reference: demande.reference,
  });

  const finale = await changerStatut({
    requestId,
    cible: REQUEST_STATUS.DOCUMENT_AVAILABLE,
    acteur,
    metadata: { documentId: document.id },
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.REQUEST_APPROVE,
    targetType: "RenewalRequest",
    targetId: requestId,
    metadata: { reference: demande.reference, documentId: document.id },
  });

  await notifierMarin({
    marinId: demande.marinId,
    evenement: NOTIFICATION_EVENT.DOCUMENT_AVAILABLE,
    contenu: `PGMI : votre ${demande.certificateType.label} est disponible. Code de vérification ${document.verificationCode}.`,
    forcerSms: true,
  });

  return { demande: finale, document };
};

export const rejeterDemande = async (requestId: string, motif: string, acteur: Acteur) => {
  if (!motif || motif.trim().length < 5) {
    throw new ValidationError("Le motif de rejet est obligatoire.");
  }

  if (acteur.role && ARSTM_ROLES.includes(acteur.role)) {
    throw new ForbiddenError("Une institution de formation ne décide pas d'une demande.", "R21");
  }

  const demande = await changerStatut({
    requestId,
    cible: REQUEST_STATUS.REJECTED,
    acteur,
    data: { decidedById: acteur.id, decidedAt: new Date(), decisionReason: motif },
    metadata: { motif },
    messageMarin: `PGMI : votre demande a été rejetée. Motif : ${motif}`,
    forcerSms: true,
  });

  await logAction({
    actorType: "AGENT",
    actorId: acteur.id,
    actorLabel: acteur.label,
    action: AUDIT_ACTION.REQUEST_REJECT,
    targetType: "RenewalRequest",
    targetId: requestId,
    metadata: { motif },
  });

  return demande;
};

// ---- Lecture ----

export const listerDemandesMarin = async (marinId: string) =>
  prisma.renewalRequest.findMany({
    where: { marinId },
    include: INCLUDE_DEMANDE,
    orderBy: { createdAt: "desc" },
  });

export const listerDemandes = async (filtres: Record<string, unknown>, acteur: Acteur) => {
  const pagination = lirePagination(filtres);
  const recherche = typeof filtres.q === "string" ? filtres.q.trim() : "";

  const where = {
    ...(filtres.status ? { status: String(filtres.status) } : {}),
    ...(filtres.mesDossiers ? { assignedToId: acteur.id } : {}),
    ...(recherche
      ? {
          OR: [
            { reference: { contains: recherche } },
            { marin: { lastName: { contains: recherche } } },
            { marin: { matricule: { contains: recherche } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.renewalRequest.findMany({
      where,
      include: INCLUDE_DEMANDE,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.taille,
    }),
    prisma.renewalRequest.count({ where }),
  ]);

  return construireReponse(items, total, pagination);
};

export const obtenirDemande = async (requestId: string) => {
  const demande = await prisma.renewalRequest.findUnique({
    where: { id: requestId },
    include: INCLUDE_DEMANDE,
  });
  if (!demande) throw new NotFoundError("Demande introuvable.");
  return demande;
};

// Pré-remplissage d'une demande après réussite d'une formation (R18).
// Le service ne crée rien : il propose au marin un formulaire déjà rempli,
// que le marin confirme lui-même.
export const preparerDemandeApresFormation = async (marinId: string, certificateTypeId: string) => {
  const [type, documentActuel] = await Promise.all([
    prisma.certificateType.findUnique({ where: { id: certificateTypeId } }),
    prisma.document.findFirst({
      where: { marinId, certificateTypeId },
      orderBy: { expiryDate: "desc" },
    }),
  ]);

  if (!type) throw new NotFoundError("Type de certificat inconnu.");
  const { montant, devise } = await lireMontant(type.id, REQUEST_TYPE.RENEWAL);

  return {
    certificateTypeId: type.id,
    certificat: type.label,
    type: REQUEST_TYPE.RENEWAL,
    sourceDocumentId: documentActuel?.id ?? null,
    reason: `Renouvellement après formation ${type.code} suivie à l'ARSTM.`,
    feeAmount: montant,
    currency: devise,
  };
};
