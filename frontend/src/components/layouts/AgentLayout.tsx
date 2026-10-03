// ============================================
// layouts/AgentLayout.tsx
// Coquille du poste agent : barre latérale fixe, pensée pour un écran de
// bureau au guichet.
//
// Les entrées de menu sont filtrées par rôle : un agent ARSTM ne voit pas
// les files d'instruction de la DGAM, et inversement.
// ============================================
import { NavLink, Outlet } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { useAuthStore } from "../../stores/authStore.js";
import { api } from "../../lib/apiClient.js";
import { Icone } from "../atoms/Icone.js";
import type { NomIcone } from "../atoms/Icone.js";
import { initiales } from "../../lib/format.js";

interface EntreeMenu {
  chemin: string;
  libelle: string;
  icone: NomIcone;
  roles?: string[];
}

const ROLES_DGAM = ["DGAM_AGENT", "DGAM_SUPERVISOR", "PLATFORM_ADMIN", "BUSINESS_ADMIN"];
const ROLES_ARSTM = ["ARSTM_TRAINING", "ARSTM_REGISTRAR", "ARSTM_MANAGER"];

const MENU: EntreeMenu[] = [
  { chemin: "/agent", libelle: t.navigation.tableauBord, icone: "tableauBord" },
  { chemin: "/agent/demandes", libelle: t.navigation.demandes, icone: "demandes", roles: ROLES_DGAM },
  { chemin: "/agent/marins", libelle: t.navigation.marins, icone: "marins", roles: ROLES_DGAM },
  {
    chemin: "/agent/verifications",
    libelle: t.navigation.verifications,
    icone: "verifications",
    roles: ROLES_DGAM,
  },
  { chemin: "/agent/arstm", libelle: t.navigation.arstm, icone: "formations", roles: ROLES_ARSTM },
  {
    chemin: "/agent/referentiels",
    libelle: t.navigation.referentiels,
    icone: "referentiels",
    roles: ["BUSINESS_ADMIN", "PLATFORM_ADMIN"],
  },
  {
    chemin: "/agent/journal",
    libelle: t.navigation.journal,
    icone: "journal",
    roles: ["DGAM_SUPERVISOR", "PLATFORM_ADMIN"],
  },
];

export const AgentLayout = () => {
  const agent = useAuthStore((etat) => etat.agent);
  const deconnecter = useAuthStore((etat) => etat.deconnecter);

  const entrees = MENU.filter(
    (entree) => !entree.roles || (agent?.role && entree.roles.includes(agent.role)),
  );

  const gererDeconnexion = async () => {
    // La déconnexion est demandée au serveur pour révoquer les jetons déjà
    // émis, puis l'état local est vidé quoi qu'il arrive.
    try {
      await api.post("/api/auth/agent/logout");
    } finally {
      deconnecter();
    }
  };

  return (
    <div className="flex min-h-screen bg-fond">
      <aside className="fixed inset-y-0 left-0 hidden w-sidebar flex-col bg-navy text-white lg:flex">
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12">
            <Icone nom="verifications" taille={20} />
          </span>
          <div className="min-w-0">
            <p className="font-titre text-base font-bold leading-tight">{t.commun.application}</p>
            <p className="truncate text-[10px] text-white/40">{t.agent.titre}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {entrees.map((entree) => (
            <NavLink
              key={entree.chemin}
              to={entree.chemin}
              end={entree.chemin === "/agent"}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/[0.06]"}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icone
                    nom={entree.icone}
                    taille={18}
                    className={isActive ? "text-orange-ci" : ""}
                  />
                  {entree.libelle}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-ci text-[11px] font-bold">
              {initiales(agent ? `${agent.firstName} ${agent.lastName}` : "")}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {agent ? `${agent.firstName} ${agent.lastName}` : ""}
              </p>
              <p className="truncate text-[10px] text-white/50">
                {agent?.roleLabel}
                {agent?.authority?.name ? `, ${agent.authority.name}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={gererDeconnexion}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/15 py-2 text-xs font-medium text-white/80 transition-colors hover:bg-white/[0.06]"
          >
            <Icone nom="deconnexion" taille={14} />
            {t.commun.deconnexion}
          </button>
        </div>
      </aside>

      {/* Barre supérieure de repli sur petit écran, la latérale étant masquée */}
      <div className="flex-1 lg:ml-sidebar">
        <header className="flex items-center justify-between border-b border-bordure bg-white px-4 py-3 lg:hidden">
          <p className="font-titre font-bold text-navy">{t.commun.application}</p>
          <button
            type="button"
            onClick={gererDeconnexion}
            className="text-xs font-medium text-erreur"
          >
            {t.commun.deconnexion}
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-bordure bg-white px-3 py-2 lg:hidden">
          {entrees.map((entree) => (
            <NavLink
              key={entree.chemin}
              to={entree.chemin}
              end={entree.chemin === "/agent"}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${isActive ? "bg-navy text-white" : "text-ardoise"}`
              }
            >
              {entree.libelle}
            </NavLink>
          ))}
        </nav>

        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
