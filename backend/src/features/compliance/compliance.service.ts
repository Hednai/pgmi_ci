// ============================================
// features/compliance/compliance.service.ts
// Moteur de conformité.
//
// Le moteur informe, il ne décide pas (R13) : il compare le dossier du marin
// aux prérequis enregistrés dans le référentiel et restitue ce qui manque.
// Aucune règle n'est codée en dur, tout vient de CertificateRequirement.
// ============================================
import { prisma } from "../../lib/prisma.js";
import { DOCUMENT_STATUS, EMBARKATION_STATUS } from "../../domain/status.js";
import { joursAvantExpiration } from "../../utils/dates.js";
import { EXPIRY_WARNING_WINDOW_DAYS } from "../../domain/rules.js";
import { NotFoundError } from "../../utils/errors.js";

// État d'un prérequis, tel qu'affiché dans la checklist du marin
export const ETAT_PREREQUIS = {
  VALIDE: "VALIDE",
  BIENTOT_EXPIRE: "BIENTOT_EXPIRE",
  EXPIRE: "EXPIRE",
  MANQUANT: "MANQUANT",
  EN_ATTENTE: "EN_ATTENTE",
} as const;
export type EtatPrerequis = (typeof ETAT_PREREQUIS)[keyof typeof ETAT_PREREQUIS];

export interface LignePrerequis {
  label: string;
  type: "CERTIFICAT" | "SEA_SERVICE";
  etat: EtatPrerequis;
  code?: string;
  documentId?: string;
  expireLe?: Date | null;
  joursRestants?: number | null;
  // Renseignés uniquement pour un prérequis de service en mer
  joursRequis?: number;
  joursAcquis?: number;
  // Le prérequis passe-t-il par une formation ARSTM ?
  formationRequise?: boolean;
  certificateTypeId?: string;
}

export interface RapportConformite {
  certificat: { id: string; code: string; label: string };
  progression: number;
  satisfaits: number;
  total: number;
  eligible: boolean;
  prerequis: LignePrerequis[];
  // Rappel affiché sous la checklist : le moteur n'est pas décisionnaire
  avertissement: string;
}

const AVERTISSEMENT =
  "Cette analyse est indicative. Seule la Direction des Affaires Maritimes décide de la délivrance d'un certificat.";

// Seuil d'alerte d'un certificat prérequis : aligné sur la fenêtre de
// relance générale pour que le marin voie la même information partout.
const estBientotExpire = (jours: number) => jours >= 0 && jours <= EXPIRY_WARNING_WINDOW_DAYS;

// Évaluer la conformité d'un marin pour un certificat cible
export const evaluerConformite = async (
  marinId: string,
  certificateTypeId: string,
): Promise<RapportConformite> => {
  const cible = await prisma.certificateType.findUnique({
    where: { id: certificateTypeId },
    include: {
      requirementsFor: {
        include: { requiredType: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!cible) throw new NotFoundError("Type de certificat inconnu.");

  const [documents, seaService] = await Promise.all([
    prisma.document.findMany({
      where: {
        marinId,
        status: { in: [DOCUMENT_STATUS.VERIFIED, DOCUMENT_STATUS.OFFICIAL_DIGITAL] },
      },
      select: { id: true, certificateTypeId: true, expiryDate: true },
    }),
    prisma.embarkation.aggregate({
      where: { marinId, status: EMBARKATION_STATUS.VERIFIED },
      _sum: { days: true },
    }),
  ]);

  // R4 : seuls les jours vérifiés entrent dans le calcul
  const joursAcquis = seaService._sum.days ?? 0;

  const prerequis: LignePrerequis[] = cible.requirementsFor.map((regle) => {
    // Prérequis de service en mer
    if (regle.requiredSeaDays) {
      return {
        label: regle.label,
        type: "SEA_SERVICE",
        etat:
          joursAcquis >= regle.requiredSeaDays
            ? ETAT_PREREQUIS.VALIDE
            : ETAT_PREREQUIS.EN_ATTENTE,
        joursRequis: regle.requiredSeaDays,
        joursAcquis,
      };
    }

    // Prérequis de certificat
    const detenu = documents.find((doc) => doc.certificateTypeId === regle.requiredTypeId);

    if (!detenu) {
      return {
        label: regle.label,
        type: "CERTIFICAT",
        etat: ETAT_PREREQUIS.MANQUANT,
        code: regle.requiredType?.code,
        certificateTypeId: regle.requiredTypeId ?? undefined,
        formationRequise: regle.requiredType?.requiresTraining ?? false,
      };
    }

    const jours = detenu.expiryDate ? joursAvantExpiration(detenu.expiryDate) : null;

    let etat: EtatPrerequis = ETAT_PREREQUIS.VALIDE;
    if (jours !== null && jours < 0) etat = ETAT_PREREQUIS.EXPIRE;
    else if (jours !== null && estBientotExpire(jours)) etat = ETAT_PREREQUIS.BIENTOT_EXPIRE;

    return {
      label: regle.label,
      type: "CERTIFICAT",
      etat,
      code: regle.requiredType?.code,
      documentId: detenu.id,
      expireLe: detenu.expiryDate,
      joursRestants: jours,
      certificateTypeId: regle.requiredTypeId ?? undefined,
      formationRequise: regle.requiredType?.requiresTraining ?? false,
    };
  });

  // Un prérequis bientôt expiré compte comme satisfait : il l'est encore
  // aujourd'hui. Il apparaît en alerte, pas en manquant.
  const satisfaits = prerequis.filter(
    (ligne) =>
      ligne.etat === ETAT_PREREQUIS.VALIDE || ligne.etat === ETAT_PREREQUIS.BIENTOT_EXPIRE,
  ).length;

  const total = prerequis.length;

  return {
    certificat: { id: cible.id, code: cible.code, label: cible.label },
    progression: total > 0 ? Math.round((satisfaits / total) * 100) : 100,
    satisfaits,
    total,
    eligible: satisfaits === total,
    prerequis,
    avertissement: AVERTISSEMENT,
  };
};

// Conformité sur tous les certificats qui déclarent des prérequis.
// Alimente l'écran « Ma conformité » sans que le marin ait à choisir
// un certificat cible au préalable.
export const evaluerToutesConformites = async (marinId: string) => {
  const cibles = await prisma.certificateType.findMany({
    where: { isActive: true, requirementsFor: { some: {} } },
    select: { id: true },
    orderBy: { sortOrder: "asc" },
  });

  return Promise.all(cibles.map((cible) => evaluerConformite(marinId, cible.id)));
};
