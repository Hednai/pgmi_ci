// ============================================
// layouts/ProtectedRoute.tsx
// Gardes de navigation.
//
// Le contrôle réel reste côté serveur : ces gardes évitent d'afficher un
// écran inutile, elles ne constituent pas une sécurité à elles seules.
// ============================================
import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "../../stores/authStore.js";
import { ChargementPage } from "../atoms/Feedback.js";

export const RouteMarin = ({ children }: { children: ReactNode }) => {
  const { type, initialisation } = useAuthStore();
  const emplacement = useLocation();

  if (initialisation) return <ChargementPage />;
  if (type !== "MARIN") {
    return <Navigate to="/connexion" state={{ depuis: emplacement.pathname }} replace />;
  }
  return <>{children}</>;
};

export const RouteAgent = ({
  children,
  permissions,
}: {
  children: ReactNode;
  // Permissions dont au moins une est requise pour afficher l'écran.
  // Absent : tout agent authentifié est admis.
  permissions?: string[];
}) => {
  const { type, agent, initialisation } = useAuthStore();

  if (initialisation) return <ChargementPage />;
  if (type !== "AGENT") return <Navigate to="/agent/connexion" replace />;

  // Saisie d'une URL à la main : l'écran n'est pas rendu et l'agent revient
  // à son tableau de bord. Le serveur refuse de toute façon les appels.
  const habilite =
    !permissions ||
    permissions.some(function (permission) {
      return (agent?.permissions ?? []).includes(permission);
    });

  if (!habilite) return <Navigate to="/agent" replace />;

  return <>{children}</>;
};