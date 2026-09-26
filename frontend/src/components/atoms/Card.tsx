// ============================================
// atoms/Card.tsx
// Conteneurs de contenu et états vides.
// ============================================
import type { ReactNode } from "react";

export const Card = ({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) => {
  const classes = `rounded-carte border border-bordure bg-white p-4 ${onClick ? "cursor-pointer transition-shadow hover:shadow-md" : ""} ${className}`;

  // Une carte cliquable doit être atteignable au clavier : elle devient un
  // bouton plutôt qu'une div avec un gestionnaire de clic.
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${classes} w-full text-left`}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
};

export const SectionTitre = ({ titre, action }: { titre: string; action?: ReactNode }) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-base font-semibold text-navy">{titre}</h2>
    {action}
  </div>
);

export const EtatVide = ({ message, action }: { message: string; action?: ReactNode }) => (
  <div className="rounded-carte border border-dashed border-bordure bg-white/60 px-4 py-10 text-center">
    <p className="text-sm text-ardoise">{message}</p>
    {action && <div className="mt-4 flex justify-center">{action}</div>}
  </div>
);
