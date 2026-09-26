// ============================================
// molecules/StatCard.tsx
// Indicateur chiffré des tableaux de bord.
// ============================================
import type { ReactNode } from "react";

export const StatCard = ({
  valeur,
  libelle,
  detail,
  ton = "neutre",
  onClick,
}: {
  valeur: number | string;
  libelle: string;
  detail?: string;
  ton?: "neutre" | "alerte" | "succes" | "erreur";
  onClick?: () => void;
}) => {
  const couleurValeur = {
    neutre: "text-navy",
    alerte: "text-orange-ci",
    succes: "text-succes",
    erreur: "text-erreur",
  }[ton];

  const contenu: ReactNode = (
    <>
      <p className={`font-titre text-2xl font-bold ${couleurValeur}`}>{valeur}</p>
      <p className="mt-0.5 text-xs font-medium leading-tight text-ardoise">{libelle}</p>
      {detail && <p className="mt-1 text-[11px] text-ardoise/80">{detail}</p>}
    </>
  );

  const classes =
    "rounded-carte border border-bordure bg-white px-3.5 py-3 text-left transition-shadow";

  return onClick ? (
    <button type="button" onClick={onClick} className={`${classes} hover:shadow-md`}>
      {contenu}
    </button>
  ) : (
    <div className={classes}>{contenu}</div>
  );
};
