// ============================================
// features/verification/verification.service.ts
// Vérification publique d'un document par son code QR.
//
// Trois contraintes gouvernent ce fichier :
//   R10, le nom complet du marin n'est jamais renvoyé ;
//   ENF-008, une seule requête, charge utile minimale, réponse sous 1 s en 2G ;
//   R5, chaque scan est journalisé, y compris les codes inconnus.
// ============================================
import { prisma } from "../../lib/prisma.js";
import type { Request } from "express";
import { DOCUMENT_STATUS } from "../../domain/status.js";
import { masquerNom } from "../../utils/reference.js";
import { statutEffectif } from "../documents/documents.service.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { formaterDate } from "../../utils/dates.js";

// Réponse publique. Le vocabulaire est celui d'un contrôle au port, pas
// celui de la base de données.
export interface ResultatVerification {
  trouve: boolean;
  statut: string;
  libelleStatut: string;
  valide: boolean;
  document?: {
    certificat: string;
    code: string;
    numero: string | null;
    delivreLe: string | null;
    expireLe: string | null;
    titulaire: string;
    matricule: string | null;
    fonction: string | null;
    photoUrl: string | null;
    autorite: string;
  };
  // Mouvement vérifié, renvoyé quand le code désigne un embarquement et non
  // un document. Les deux blocs ne coexistent jamais (R26).
  mouvement?: {
    navire: string;
    imo: string | null;
    titulaire: string;
    matricule: string | null;
    fonction: string | null;
    embarqueLe: string;
    debarqueLe: string;
    jours: number;
    code: string;
    autorite: string;
  };
  remplacePar?: string;
  message: string;
}

// Libellés affichés sur la page publique
const LIBELLES: Record<string, { libelle: string; message: string; valide: boolean }> = {
  VERIFIED: {
    libelle: "Document valide",
    message: "Ce document est authentique et enregistré au registre national.",
    valide: true,
  },
  OFFICIAL_DIGITAL: {
    libelle: "Document valide",
    message: "Document officiel délivré par la Direction des Affaires Maritimes.",
    valide: true,
  },
  EXPIRED: {
    libelle: "Document expiré",
    message: "Ce document est authentique mais sa date de validité est dépassée.",
    valide: false,
  },
  REPLACED: {
    libelle: "Document remplacé",
    message: "Ce document a été remplacé par une version plus récente.",
    valide: false,
  },
  REVOKED: {
    libelle: "Document révoqué",
    message: "Ce document a été révoqué par l'autorité maritime.",
    valide: false,
  },
  SUSPENDED: {
    libelle: "Document suspendu",
    message: "Ce document est temporairement suspendu.",
    valide: false,
  },
  SCANNED: {
    libelle: "Document non vérifié",
    message: "Ce document n'a pas été contrôlé par la Direction des Affaires Maritimes.",
    valide: false,
  },
  REJECTED: {
    libelle: "Document rejeté",
    message: "Ce document a été rejeté et n'a aucune valeur.",
    valide: false,
  },
};

// Vérification par matricule (scan du QR profil du marin).
// Retourne l'identité professionnelle du marin sans document spécifique.
const verifierParMatricule = async (
  matricule: string,
  req?: Request,
): Promise<ResultatVerification> => {
  const marin = await prisma.marin.findUnique({
    where: { matricule },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      matricule: true,
      status: true,
      photoUrl: true,
      createdAt: true,
      fonction: { select: { label: true } },
      authority: { select: { name: true } },
    },
  });

  await logAction({
    actorType: "PUBLIC",
    action: AUDIT_ACTION.QR_VERIFICATION,
    targetType: "Marin",
    targetId: marin?.id,
    metadata: { matricule, trouve: Boolean(marin) },
    req,
  });

  if (!marin) {
    return {
      trouve: false,
      statut: "NOT_FOUND",
      libelleStatut: "Matricule inconnu",
      valide: false,
      message: "Aucun marin ne correspond à ce matricule.",
    };
  }

  const actif = marin.status === "ACTIVE";

  return {
    trouve: true,
    statut: marin.status,
    libelleStatut: actif ? "Marin vérifié" : "Marin en attente",
    valide: actif,
    message: actif
      ? "Ce marin est enregistré et actif auprès de la Direction Générale des Affaires Maritimes."
      : "Ce marin est en attente d'activation par la DGAM.",
    document: {
      certificat: "Carte professionnelle maritime",
      code: "CPM",
      numero: marin.matricule,
      delivreLe: formaterDate(marin.createdAt),
      expireLe: null,
      titulaire: masquerNom(`${marin.firstName} ${marin.lastName}`),
      matricule: marin.matricule,
      fonction: marin.fonction?.label ?? null,
      photoUrl: marin.photoUrl,
      autorite: marin.authority.name,
    },
  };
};

// Vérification d'un mouvement par son code court (R26).
// Retourne null si le code ne désigne aucun mouvement : l'appelant
// poursuivra alors sa propre réponse « code inconnu ».
//
// Seul un mouvement vérifié porte un code, la question de son statut ne se
// pose donc pas : s'il répond, il est opposable.
const verifierMouvement = async (
  code: string,
  req?: Request,
): Promise<ResultatVerification | null> => {
  const mouvement = await prisma.embarkation.findUnique({
    where: { verificationCode: code },
    select: {
      id: true,
      vesselName: true,
      imoNumber: true,
      startDate: true,
      endDate: true,
      days: true,
      fonction: { select: { label: true } },
      marin: {
        select: {
          firstName: true,
          lastName: true,
          matricule: true,
          authority: { select: { name: true } },
        },
      },
    },
  });

  if (!mouvement) return null;

  // Le scan est journalisé comme celui d'un document : R5 ne distingue pas
  // les objets. La colonne documentId reste nulle, le journal d'audit porte
  // la cible réelle.
  await prisma.qRVerificationLog.create({
    data: {
      verificationCode: code,
      documentId: null,
      result: "FOUND",
      ip: req?.ip ?? null,
      userAgent: req?.headers["user-agent"] ?? null,
    },
  });

  await logAction({
    actorType: "PUBLIC",
    action: AUDIT_ACTION.QR_VERIFICATION,
    targetType: "Embarkation",
    targetId: mouvement.id,
    metadata: { code, trouve: true },
    req,
  });

  return {
    trouve: true,
    statut: "VERIFIED",
    libelleStatut: "Mouvement vérifié",
    valide: true,
    message:
      "Ce temps de mer a été contrôlé sur pièces par la Direction Générale " +
      "des Affaires Maritimes et compte dans le service en mer du marin.",
    mouvement: {
      navire: mouvement.vesselName,
      imo: mouvement.imoNumber,
      // R10 : le nom reste partiellement masqué, y compris ici. Le matricule
      // et la fonction suffisent à rapprocher la fiche du livret présenté.
      titulaire: masquerNom(`${mouvement.marin.firstName} ${mouvement.marin.lastName}`),
      matricule: mouvement.marin.matricule,
      fonction: mouvement.fonction?.label ?? null,
      embarqueLe: formaterDate(mouvement.startDate),
      debarqueLe: formaterDate(mouvement.endDate),
      jours: mouvement.days,
      code,
      autorite: mouvement.marin.authority.name,
    },
  };
};

// Vérifier un code. Ne lève jamais : un code inconnu est une réponse
// métier normale, pas une erreur technique.
export const verifierCode = async (
  code: string,
  req?: Request,
): Promise<ResultatVerification> => {
  const codeNormalise = code.trim().toUpperCase();

  // Un matricule commence par "CI-MAR-" : recherche par identité du marin
  if (codeNormalise.startsWith("CI-MAR-")) {
    return verifierParMatricule(codeNormalise, req);
  }

  const document = await prisma.document.findUnique({
    where: { verificationCode: codeNormalise },
    select: {
      id: true,
      status: true,
      number: true,
      issueDate: true,
      expiryDate: true,
      replacedById: true,
      certificateType: { select: { label: true } },
      marin: {
        select: {
          firstName: true,
          lastName: true,
          matricule: true,
          photoUrl: true,
          fonction: { select: { label: true } },
          authority: { select: { name: true } },
        },
      },
    },
  });

  // Documents et mouvements partagent le même espace de codes : un code qui
  // ne désigne aucun document peut désigner un mouvement vérifié.
  if (!document) {
    const mouvement = await verifierMouvement(codeNormalise, req);
    if (mouvement) return mouvement;
  }

  await prisma.qRVerificationLog.create({
    data: {
      verificationCode: codeNormalise,
      documentId: document?.id ?? null,
      result: document ? "FOUND" : "NOT_FOUND",
      ip: req?.ip ?? null,
      userAgent: req?.headers["user-agent"] ?? null,
    },
  });

  await logAction({
    actorType: "PUBLIC",
    action: AUDIT_ACTION.QR_VERIFICATION,
    targetType: "Document",
    targetId: document?.id,
    metadata: { code: codeNormalise, trouve: Boolean(document) },
    req,
  });

  if (!document) {
    return {
      trouve: false,
      statut: "NOT_FOUND",
      libelleStatut: "Code inconnu",
      valide: false,
      message:
        "Aucun document ni mouvement ne correspond à ce code. Vérifiez la saisie " +
        "ou signalez la pièce présentée.",
    };
  }

  const statut = statutEffectif(document);
  const libelle = LIBELLES[statut] ?? LIBELLES[DOCUMENT_STATUS.SCANNED];

  // Le code du remplaçant est utile à un inspecteur : il peut enchaîner
  // directement sur la version en vigueur.
  let remplacePar: string | undefined;
  if (document.replacedById) {
    const remplacant = await prisma.document.findUnique({
      where: { id: document.replacedById },
      select: { verificationCode: true },
    });
    remplacePar = remplacant?.verificationCode ?? undefined;
  }

  return {
    trouve: true,
    statut,
    libelleStatut: libelle?.libelle ?? "Statut inconnu",
    valide: libelle?.valide ?? false,
    message: libelle?.message ?? "",
    ...(remplacePar ? { remplacePar } : {}),
    document: {
      certificat: document.certificateType.label,
      code: codeNormalise,
      numero: document.number,
      delivreLe: document.issueDate ? formaterDate(document.issueDate) : null,
      expireLe: document.expiryDate ? formaterDate(document.expiryDate) : null,
      // R10 : nom partiellement masqué, la photo sert à la comparaison visuelle
      titulaire: masquerNom(`${document.marin.firstName} ${document.marin.lastName}`),
      matricule: document.marin.matricule,
      fonction: document.marin.fonction?.label ?? null,
      photoUrl: document.marin.photoUrl,
      autorite: document.marin.authority.name,
    },
  };
};