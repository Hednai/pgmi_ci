// ============================================
// layouts/EnteteAgent.tsx
// Éléments d'en-tête communs aux écrans du poste agent.
//
// Le poste agent est un outil de bureau : titre lisible, compteur de file
// et filtres alignés. Ces briques sont partagées pour que les six écrans
// se ressemblent et que l'agent ne réapprenne rien d'un écran à l'autre.
// ============================================
import type { ReactNode } from "react";
import { Icone } from "../atoms/Icone.js";
import type { NomIcone } from "../atoms/Icone.js";

interface ProprietesEntete {
  titre: string;
  sousTitre?: string;
  icone: NomIcone;
  // Actions alignées à droite du titre : bouton, compteur, export
  actions?: ReactNode;
}

export function EnteteAgent({ titre, sousTitre, icone, actions }: ProprietesEntete) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
          <Icone nom={icone} taille={20} />
        </span>

        <div>
          <h1 className="font-titre text-xl font-bold text-navy">{titre}</h1>
          {sousTitre && <p className="text-sm text-ardoise">{sousTitre}</p>}
        </div>
      </div>

      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

interface ProprietesFiltre {
  valeur: string;
  libelle: string;
  compte?: number;
}

interface ProprietesBarreFiltres {
  filtres: ProprietesFiltre[];
  actif: string;
  onChange: (valeur: string) => void;
}

// Barre de filtres d'une file de travail. Le filtre actif est plein, les
// autres restent discrets pour ne pas concurrencer le contenu.
export function BarreFiltres({ filtres, actif, onChange }: ProprietesBarreFiltres) {
  return (
    <div className="flex flex-wrap gap-2">
      {filtres.map(function afficherFiltre(filtre) {
        const selectionne = filtre.valeur === actif;

        return (
          <button
            key={filtre.valeur || "tous"}
            type="button"
            onClick={function () {
              onChange(filtre.valeur);
            }}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${selectionne ? "bg-navy text-white" : "border border-bordure bg-white text-ardoise hover:bg-fond"}`}
          >
            {filtre.libelle}
            {typeof filtre.compte === "number" && (
              <span className={selectionne ? "ml-1.5 text-white/60" : "ml-1.5 text-ardoise/60"}>
                {filtre.compte}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Panneau latéral de traitement d'un dossier. Il recouvre la liste sans la
// quitter : l'agent garde sa file en tête et enchaîne les dossiers.
export function PanneauTraitement({
  titre,
  sousTitre,
  onFermer,
  children,
}: {
  titre: string;
  sousTitre?: string;
  onFermer: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-navy/70 sm:items-center sm:p-6">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-carte bg-white sm:rounded-carte">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-bordure bg-white px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-titre text-base font-bold text-navy">{titre}</h2>
            {sousTitre && <p className="mt-0.5 truncate text-xs text-ardoise">{sousTitre}</p>}
          </div>

          <button
            type="button"
            onClick={onFermer}
            className="shrink-0 rounded-lg p-1.5 text-ardoise transition-colors hover:bg-fond hover:text-navy"
          >
            <Icone nom="manquant" taille={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">{children}</div>
      </div>
    </div>
  );
}
