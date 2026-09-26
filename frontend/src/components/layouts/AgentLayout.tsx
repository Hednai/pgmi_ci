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

interface EntreeMenu {
  chemin: string;
  libelle: string;
  roles?: string[];
}

const ROLES_DGAM = ["DGAM_AGENT", "DGAM_SUPERVISOR", "PLATFORM_ADMIN", "BUSINESS_ADMIN"];
const ROLES_ARSTM = ["ARSTM_TRAINING", "ARSTM_REGISTRAR", "ARSTM_MANAGER"];

const MENU: EntreeMenu[] = [
  { chemin: "/agent", libelle: t.navigation.tableauBord },
  { chemin: "/agent/demandes", libelle: t.navigation.demandes, roles: ROLES_DGAM },
  { chemin: "/agent/marins", libelle: t.navigation.marins, roles: ROLES_DGAM },
  { chemin: "/agent/verifications", libelle: t.navigation.verifications, roles: ROLES_DGAM },
  { chemin: "/agent/arstm", libelle: t.navigation.arstm, roles: ROLES_ARSTM },
  {
    chemin: "/agent/referentiels",
    libelle: t.navigation.referentiels,
    roles: ["BUSINESS_ADMIN", "PLATFORM_ADMIN"],
  },
  {
    chemin: "/agent/journal",
    libelle: t.navigation.journal,
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
        <div className="px-5 py-6">
          <p className="text-[11px] uppercase tracking-wide text-white/50">
            {t.commun.republique}
          </p>
          <p className="font-titre text-lg font-bold">{t.commun.application}</p>
          <p className="mt-1 text-[11px] leading-tight text-white/60">
            {agent?.authority?.name || t.commun.autorite}
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {entrees.map((entree) => (
            <NavLink
              key={entree.chemin}
              to={entree.chemin}
              end={entree.chemin === "/agent"}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-orange-ci text-white" : "text-white/75 hover:bg-white/10"}`
              }
            >
              {entree.libelle}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <p className="text-sm font-semibold">
            {agent ? `${agent.firstName} ${agent.lastName}` : ""}
          </p>
          <p className="text-[11px] text-white/60">{agent?.roleLabel}</p>
          <button
            type="button"
            onClick={gererDeconnexion}
            className="mt-2 text-xs font-medium text-orange-ci hover:underline"
          >
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
