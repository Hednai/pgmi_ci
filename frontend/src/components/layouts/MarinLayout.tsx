// ============================================
// layouts/MarinLayout.tsx
// Coquille de l'espace marin : en-tête compacte et navigation basse.
//
// Mobile-first assumé : la barre de navigation est en bas, à portée du pouce,
// et le contenu réserve la place nécessaire pour ne jamais passer dessous.
// ============================================
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { useAuthStore } from "../../stores/authStore.js";
import { initiales } from "../../lib/format.js";

const ONGLETS = [
  { chemin: "/accueil", libelle: t.navigation.accueil, icone: "⌂" },
  { chemin: "/documents", libelle: t.navigation.documents, icone: "▤" },
  { chemin: "/service-mer", libelle: t.navigation.serviceMer, icone: "⚓" },
  { chemin: "/conformite", libelle: t.navigation.conformite, icone: "◷" },
  { chemin: "/profil", libelle: t.navigation.profil, icone: "●" },
];

export const MarinLayout = () => {
  const marin = useAuthStore((etat) => etat.marin);
  const naviguer = useNavigate();

  return (
    <div className="min-h-screen bg-fond">
      <header className="sticky top-0 z-10 bg-navy px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60">
              {t.commun.application}
            </p>
            <p className="font-titre text-base font-semibold">{marin?.fullName ?? ""}</p>
            {marin?.matricule && (
              <p className="matricule text-xs text-orange-ci">{marin.matricule}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => naviguer("/profil")}
            aria-label={t.profil.titre}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-semibold"
          >
            {initiales(marin?.fullName ?? "")}
          </button>
        </div>
      </header>

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
              <span aria-hidden="true" className="text-lg leading-none">
                {onglet.icone}
              </span>
              {onglet.libelle}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};
