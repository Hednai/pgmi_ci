// ============================================
// atoms/Feedback.tsx
// Retours visuels : chargement, message d'information, barre de progression.
// ============================================
import type { ReactNode } from "react";
import { t } from "../../i18n/index.js";

export const Spinner = ({ classe = "" }: { classe?: string }) => (
  <span
    role="status"
    aria-label={t.commun.chargement}
    className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-navy/20 border-t-navy ${classe}`}
  />
);

export const ChargementPage = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <Spinner classe="h-8 w-8" />
  </div>
);

export type TonAlerte = "info" | "succes" | "alerte" | "erreur";

const TONS_ALERTE: Record<TonAlerte, string> = {
  info: "bg-navy-soft text-navy border-navy-light/30",
  succes: "bg-succes-soft text-succes border-succes/30",
  alerte: "bg-alerte-soft text-orange-ci border-orange-ci/30",
  erreur: "bg-erreur-soft text-erreur border-erreur/30",
};

export const Alerte = ({
  ton = "info",
  titre,
  children,
}: {
  ton?: TonAlerte;
  titre?: string;
  children: ReactNode;
}) => (
  <div className={`rounded-carte border px-4 py-3 text-sm ${TONS_ALERTE[ton]}`}>
    {titre && <p className="mb-1 font-semibold">{titre}</p>}
    <div className="leading-relaxed">{children}</div>
  </div>
);

// Barre de progression. La couleur suit le niveau atteint : l'information
// est portée par la valeur, pas seulement par la teinte.
export const Progression = ({ valeur, etiquette }: { valeur: number; etiquette?: string }) => {
  const borne = Math.min(Math.max(valeur, 0), 100);
  const couleur = borne >= 100 ? "bg-succes" : borne >= 50 ? "bg-orange-ci" : "bg-navy-light";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-ardoise">
        <span>{etiquette}</span>
        <span className="text-navy">{borne} %</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-navy-soft"
        role="progressbar"
        aria-valuenow={borne}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full transition-all ${couleur}`} style={{ width: `${borne}%` }} />
      </div>
    </div>
  );
};
