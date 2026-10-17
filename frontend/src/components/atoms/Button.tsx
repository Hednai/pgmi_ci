// ============================================
// atoms/Button.tsx
// Bouton de l'application.
//
// Les variantes portent une intention métier, pas une couleur : un écran
// demande une action « principale », la charte décide de sa teinte.
// ============================================
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type VarianteBouton = "principal" | "secondaire" | "discret" | "danger" | "succes";
export type TailleBouton = "sm" | "md" | "lg";

interface ProprietesBouton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  pleineLargeur?: boolean;
  chargement?: boolean;
  icone?: ReactNode;
}

const VARIANTES: Record<VarianteBouton, string> = {
  principal: "bg-orange-ci text-white hover:bg-orange-ci/90 active:bg-orange-ci/80",
  secondaire: "bg-navy text-white hover:bg-navy-light active:bg-navy-light/90",
  discret: "bg-white text-navy border border-bordure hover:bg-navy-soft",
  danger: "bg-erreur text-white hover:bg-erreur/90",
  succes: "bg-succes text-white hover:bg-succes/90",
};

const TAILLES: Record<TailleBouton, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export const Button = ({
  variante = "principal",
  taille = "md",
  pleineLargeur = false,
  chargement = false,
  icone,
  children,
  className = "",
  disabled,
  ...reste
}: ProprietesBouton) => (
  <button
    className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${TAILLES[taille]} ${pleineLargeur ? "w-full" : ""} ${className}`}
    disabled={disabled || chargement}
    {...reste}
  >
    {chargement ? (
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
    ) : (
      icone
    )}
    {children}
  </button>
);
