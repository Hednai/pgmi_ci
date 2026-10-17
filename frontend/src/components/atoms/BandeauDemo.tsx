// ============================================
// atoms/BandeauDemo.tsx
// Bandeau affiché sur les écrans de connexion d'une instance de
// démonstration.
//
// Il annonce la nature de l'instance et rappelle les identifiants de recette.
// Aucun écran métier ne l'utilise : il n'apparaît que là où un visiteur doit
// entrer, et seulement si le mode démonstration est actif.
// ============================================
import { t } from "../../i18n/index.js";

// Une ligne du bandeau : un libellé et la valeur à saisir
export interface LigneDemo {
  libelle: string;
  valeur: string;
}

interface ProprietesBandeauDemo {
  lignes: LigneDemo[];
  // Texte additionnel affiché sous les identifiants
  precision?: string;
}

export function BandeauDemo({ lignes, precision }: ProprietesBandeauDemo) {
  if (lignes.length === 0) return null;

  return (
    <div
      role="status"
      className="rounded-xl border border-alerte/40 bg-alerte-soft px-3.5 py-3 text-xs text-navy"
    >
      <p className="font-semibold uppercase tracking-wide text-alerte">
        {t.demonstration.titre}
      </p>

      <p className="mt-1 text-ardoise">{t.demonstration.explication}</p>

      <ul className="mt-2 space-y-1">
        {lignes.map((ligne) => (
          <li key={`${ligne.libelle}-${ligne.valeur}`} className="flex gap-2">
            <span className="shrink-0 text-ardoise">{ligne.libelle}</span>
            <span className="matricule font-semibold text-navy">{ligne.valeur}</span>
          </li>
        ))}
      </ul>

      {precision && <p className="mt-2 text-ardoise">{precision}</p>}
    </div>
  );
}