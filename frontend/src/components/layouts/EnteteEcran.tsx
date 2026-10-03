// ============================================
// layouts/EnteteEcran.tsx
// Bandeau supérieur des écrans marin.
//
// Le dégradé institutionnel et le bouton de retour sont déclarés une fois
// ici : tous les écrans de l'espace marin partagent donc la même en-tête,
// et un changement de charte ne touche qu'un fichier.
// ============================================
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { Icone } from "../atoms/Icone.js";

interface ProprietesEntete {
  titre: string;
  // Affiche la flèche de retour vers l'écran précédent
  retour?: boolean;
  // Contenu additionnel affiché sous le titre, dans le dégradé
  children?: ReactNode;
}

export function EnteteEcran({ titre, retour = true, children }: ProprietesEntete) {
  const naviguer = useNavigate();

  return (
    <header className="-mx-4 -mt-4 mb-4 bg-gradient-to-br from-navy to-navy-light px-5 pb-5 pt-4 text-white">
      <div className="mb-3 flex items-center gap-3">
        {retour && (
          <button
            type="button"
            onClick={function () {
              naviguer(-1);
            }}
            aria-label={t.commun.retour}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/10"
          >
            <Icone nom="retour" taille={18} />
          </button>
        )}
        <h1 className="font-titre text-lg font-bold">{titre}</h1>
      </div>

      {children}
    </header>
  );
}

// Tuile chiffrée du bandeau, utilisée par les écrans qui résument un total.
export function TuileChiffre({
  valeur,
  libelle,
  accentue = false,
}: {
  valeur: number | string;
  libelle: string;
  accentue?: boolean;
}) {
  return (
    <div className="flex-1 rounded-xl bg-white/10 px-2 py-3 text-center">
      <p className={`font-titre text-2xl font-bold ${accentue ? "text-orange-ci" : "text-white"}`}>
        {valeur}
      </p>
      <p className="mt-0.5 text-[10px] font-medium leading-tight text-white/60">{libelle}</p>
    </div>
  );
}
