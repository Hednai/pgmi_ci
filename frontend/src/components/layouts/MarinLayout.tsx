// ============================================
// layouts/MarinLayout.tsx
// Coquille de l'espace marin : en-tête compacte et navigation basse.
//
// Mobile-first assumé : la barre de navigation est en bas, à portée du pouce,
// et le contenu réserve la place nécessaire pour ne jamais passer dessous.
// ============================================
import { NavLink, Outlet } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { Icone } from "../atoms/Icone.js";
import type { NomIcone } from "../atoms/Icone.js";

interface Onglet {
  chemin: string;
  libelle: string;
  icone: NomIcone;
}

const ONGLETS: Onglet[] = [
  { chemin: "/accueil", libelle: t.navigation.accueil, icone: "accueil" },
  { chemin: "/documents", libelle: t.navigation.documents, icone: "documents" },
  { chemin: "/service-mer", libelle: t.navigation.serviceMer, icone: "serviceMer" },
  { chemin: "/conformite", libelle: t.navigation.conformite, icone: "conformite" },
  { chemin: "/profil", libelle: t.navigation.profil, icone: "profil" },
];

export const MarinLayout = () => {
  return (
    <div className="min-h-screen bg-fond">
      {/* La marge basse laisse la place à la barre de navigation fixe */}
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-bordure bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl">
          {ONGLETS.map((onglet) => (
            <NavLink
              key={onglet.chemin}
              to={onglet.chemin}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${isActive ? "text-orange-ci" : "text-ardoise"}`
              }
            >
              <Icone nom={onglet.icone} taille={20} />
              {onglet.libelle}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
