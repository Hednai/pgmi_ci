// ============================================
// layouts/MarinLayout.tsx
// Coquille de l'espace marin : en-tête compacte et navigation basse.
//
// Mobile-first assumé : la barre de navigation est en bas, à portée du pouce,
// et le contenu réserve la place nécessaire pour ne jamais passer dessous.
// ============================================
import { NavLink, Outlet } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { useAuthStore } from "../../stores/authStore.js";
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
  const deconnecter = useAuthStore(function (etat) {
    return etat.deconnecter;
  });

  return (
    <div className="min-h-screen bg-fond">
      {/* Navigation de bureau. Masquée sur téléphone, où la barre basse
          reste à portée du pouce. Les onglets viennent de la même source
          que la barre basse : un onglet ajouté apparaît aux deux endroits. */}
      <header className="hidden border-b border-bordure bg-white lg:block">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy text-white">
              <Icone nom="verifications" taille={20} />
            </span>
            <div className="leading-tight">
              <p className="font-titre text-base font-bold text-navy">{t.commun.application}</p>
              <p className="text-[10px] text-ardoise">{t.commun.republique}</p>
            </div>
          </div>

          <nav className="flex flex-1 items-center gap-1">
            {ONGLETS.map(function (onglet) {
              return (
                <NavLink
                  key={onglet.chemin}
                  to={onglet.chemin}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-navy-soft text-navy" : "text-ardoise hover:bg-fond"}`
                  }
                >
                  <Icone nom={onglet.icone} taille={18} />
                  {onglet.libelle}
                </NavLink>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={deconnecter}
            className="shrink-0 rounded-lg border border-bordure px-3 py-2 text-xs font-medium text-ardoise transition-colors hover:bg-fond"
          >
            {t.commun.deconnexion}
          </button>
        </div>
      </header>

      {/* Le remplissage horizontal reste à px-4 : EnteteEcran s'appuie dessus
          avec -mx-4 pour afficher son dégradé bord à bord. Seules la largeur
          maximale et la marge basse changent sur grand écran. */}
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-4 lg:max-w-5xl lg:pb-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-bordure bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
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