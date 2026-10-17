// ============================================
// atoms/Badge.tsx
// Pastilles de statut.
//
// La correspondance statut vers couleur est déclarée une fois ici : un même
// statut a donc la même couleur sur l'écran marin et sur le poste agent.
// ============================================
import type { ReactNode } from "react";
import { t } from "../../i18n/index.js";

export type TonBadge = "neutre" | "succes" | "alerte" | "erreur" | "info";

const TONS: Record<TonBadge, string> = {
  neutre: "bg-navy-soft text-navy",
  succes: "bg-succes-soft text-succes",
  alerte: "bg-alerte-soft text-orange-ci",
  erreur: "bg-erreur-soft text-erreur",
  info: "bg-navy-soft text-navy-light",
};

// Ton associé à chaque statut du domaine. Les statuts non listés retombent
// sur le ton neutre, ce qui évite un écran cassé si le backend en ajoute un.
const TON_PAR_STATUT: Record<string, TonBadge> = {
  VERIFIED: "succes",
  OFFICIAL_DIGITAL: "succes",
  ACTIVE: "succes",
  APPROVED: "succes",
  DOCUMENT_AVAILABLE: "succes",
  CONFIRMED: "succes",
  VALIDE: "succes",
  PASSED: "succes",

  SCANNED: "info",
  SUBMITTED: "info",
  ASSIGNED: "info",
  IN_REVIEW: "info",
  DECLARED: "info",
  SCHEDULED: "info",
  PROPOSED: "info",
  EN_ATTENTE: "info",

  AWAITING_PAYMENT: "alerte",
  INFO_REQUESTED: "alerte",
  EXPIRING_SOON: "alerte",
  PENDING: "alerte",
  PENDING_DGAM_VALIDATION: "alerte",
  WAITING_FOR_QUORUM: "alerte",
  BIENTOT_EXPIRE: "alerte",

  EXPIRED: "erreur",
  EXPIRE: "erreur",
  REJECTED: "erreur",
  REVOKED: "erreur",
  SUSPENDED: "erreur",
  MANQUANT: "erreur",
  FAILED: "erreur",

  REPLACED: "neutre",
  DIGITIZED: "neutre",
  DIGITIZED_DAM: "info",
  CANCELLED: "neutre",
  DECLINED: "neutre",
  COMPLETED: "neutre",
};

export const tonDuStatut = (statut: string): TonBadge => TON_PAR_STATUT[statut] ?? "neutre";

export const Badge = ({ ton = "neutre", children }: { ton?: TonBadge; children: ReactNode }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONS[ton]}`}
  >
    {children}
  </span>
);

// Libellé lisible d'un statut. Les dictionnaires métier sont interrogés dans
// l'ordre, et le code brut sert d'ultime repli pour ne jamais afficher vide.
const libelleDuStatut = (statut: string): string =>
  t.documents.statut[statut] ??
  t.demandes.statut[statut] ??
  t.serviceMer.statut[statut] ??
  statut;

export const BadgeStatut = ({ statut, libelle }: { statut: string; libelle?: string }) => (
  <Badge ton={tonDuStatut(statut)}>{libelle ?? libelleDuStatut(statut)}</Badge>
);
