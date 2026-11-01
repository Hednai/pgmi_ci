// ============================================
// App.tsx
// Plan de routage de l'application.
//
// Trois espaces cloisonnés : public (vérification), marin, agent. La
// session est restaurée une fois au montage, avant tout rendu de route
// protégée, pour ne pas renvoyer un utilisateur connecté vers la connexion.
// ============================================
import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore.js";
import { ChargementPage } from "./components/atoms/Feedback.js";

import { MarinLayout } from "./components/layouts/MarinLayout.js";
import { AgentLayout } from "./components/layouts/AgentLayout.js";
import { RouteMarin, RouteAgent } from "./components/layouts/ProtectedRoute.js";

// Chaque écran est chargé à la demande. Sur une connexion mobile, un marin
// qui ouvre sa page d'accueil ne télécharge pas le poste agent, et
// inversement : le premier affichage ne porte que le code réellement utilisé.
const ConnexionPage = lazy(async function () {
  return { default: (await import("./pages/marin/ConnexionPage.js")).ConnexionPage };
});
const InscriptionPage = lazy(async function () {
  return { default: (await import("./pages/marin/InscriptionPage.js")).InscriptionPage };
});
const AccueilPage = lazy(async function () {
  return { default: (await import("./pages/marin/AccueilPage.js")).AccueilPage };
});
const DocumentsPage = lazy(async function () {
  return { default: (await import("./pages/marin/DocumentsPage.js")).DocumentsPage };
});
const ServiceMerPage = lazy(async function () {
  return { default: (await import("./pages/marin/ServiceMerPage.js")).ServiceMerPage };
});
const RelevePage = lazy(async function () {
  return { default: (await import("./pages/marin/RelevePage.js")).RelevePage };
});
const ConformitePage = lazy(async function () {
  return { default: (await import("./pages/marin/ConformitePage.js")).ConformitePage };
});
const FormationsPage = lazy(async function () {
  return { default: (await import("./pages/marin/FormationsPage.js")).FormationsPage };
});
const ProfilPage = lazy(async function () {
  return { default: (await import("./pages/marin/ProfilPage.js")).ProfilPage };
});
const NotificationsPage = lazy(async function () {
  return { default: (await import("./pages/marin/NotificationsPage.js")).NotificationsPage };
});
const DemandesPage = lazy(async function () {
  return { default: (await import("./pages/marin/DemandesPage.js")).DemandesPage };
});
const NouvelleDemandePage = lazy(async function () {
  return { default: (await import("./pages/marin/NouvelleDemandePage.js")).NouvelleDemandePage };
});
const PaiementPage = lazy(async function () {
  return { default: (await import("./pages/marin/PaiementPage.js")).PaiementPage };
});

const ConnexionAgentPage = lazy(async function () {
  return { default: (await import("./pages/agent/ConnexionAgentPage.js")).ConnexionAgentPage };
});
const TableauBordAgentPage = lazy(async function () {
  return {
    default: (await import("./pages/agent/TableauBordAgentPage.js")).TableauBordAgentPage,
  };
});
const DemandesAgentPage = lazy(async function () {
  return { default: (await import("./pages/agent/DemandesAgentPage.js")).DemandesAgentPage };
});
const MarinsAgentPage = lazy(async function () {
  return { default: (await import("./pages/agent/MarinsAgentPage.js")).MarinsAgentPage };
});
const VerificationsAgentPage = lazy(async function () {
  return {
    default: (await import("./pages/agent/VerificationsAgentPage.js")).VerificationsAgentPage,
  };
});
const ArstmPage = lazy(async function () {
  return { default: (await import("./pages/agent/ArstmPage.js")).ArstmPage };
});
const ReferentielsPage = lazy(async function () {
  return { default: (await import("./pages/agent/ReferentielsPage.js")).ReferentielsPage };
});
const JournalPage = lazy(async function () {
  return { default: (await import("./pages/agent/JournalPage.js")).JournalPage };
});

const VerificationPage = lazy(async function () {
  return { default: (await import("./pages/public/VerificationPage.js")).VerificationPage };
});

// Habilitations requises par écran, au format objet:action renvoyé par le
// serveur. La liste exprime une alternative : une seule suffit.
const PERMISSIONS_DEMANDES = ["demande:instruire", "demande:decider"];
const PERMISSIONS_MARINS = ["marin:rechercher"];
const PERMISSIONS_VERIFICATIONS = ["document:verifier", "embarquement:verifier"];
const PERMISSIONS_ARSTM = ["formation:planifier", "eleve:inscrire"];
const PERMISSIONS_REFERENTIELS = ["referentiel:gerer"];
const PERMISSIONS_JOURNAL = ["audit:consulter"];

const App = () => {
  const restaurerSession = useAuthStore((etat) => etat.restaurerSession);

  useEffect(() => {
    void restaurerSession();
  }, [restaurerSession]);

  return (
    <BrowserRouter>
      <Suspense fallback={<ChargementPage />}>
        <Routes>
        {/* Espace public */}
        <Route path="/verification" element={<VerificationPage />} />

        {/* Authentification */}
        <Route path="/connexion" element={<ConnexionPage />} />
        <Route path="/inscription" element={<InscriptionPage />} />
        <Route path="/agent/connexion" element={<ConnexionAgentPage />} />

        {/* Espace marin */}
        <Route
          element={
            <RouteMarin>
              <MarinLayout />
            </RouteMarin>
          }
        >
          <Route path="/accueil" element={<AccueilPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/service-mer" element={<ServiceMerPage />} />
          <Route path="/releve" element={<RelevePage />} />
          <Route path="/conformite" element={<ConformitePage />} />
          <Route path="/formations" element={<FormationsPage />} />
          <Route path="/profil" element={<ProfilPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/demandes" element={<DemandesPage />} />
          <Route path="/demandes/nouvelle" element={<NouvelleDemandePage />} />
          <Route path="/demandes/:id/paiement" element={<PaiementPage />} />
        </Route>

        {/* Poste agent */}
        <Route
          path="/agent"
          element={
            <RouteAgent>
              <AgentLayout />
            </RouteAgent>
          }
        >
          <Route index element={<TableauBordAgentPage />} />
          <Route
            path="demandes"
            element={
              <RouteAgent permissions={PERMISSIONS_DEMANDES}>
                <DemandesAgentPage />
              </RouteAgent>
            }
          />
          <Route
            path="marins"
            element={
              <RouteAgent permissions={PERMISSIONS_MARINS}>
                <MarinsAgentPage />
              </RouteAgent>
            }
          />
          <Route
            path="verifications"
            element={
              <RouteAgent permissions={PERMISSIONS_VERIFICATIONS}>
                <VerificationsAgentPage />
              </RouteAgent>
            }
          />
          <Route
            path="arstm"
            element={
              <RouteAgent permissions={PERMISSIONS_ARSTM}>
                <ArstmPage />
              </RouteAgent>
            }
          />
          <Route
            path="referentiels"
            element={
              <RouteAgent permissions={PERMISSIONS_REFERENTIELS}>
                <ReferentielsPage />
              </RouteAgent>
            }
          />
          <Route
            path="journal"
            element={
              <RouteAgent permissions={PERMISSIONS_JOURNAL}>
                <JournalPage />
              </RouteAgent>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/accueil" replace />} />
          <Route path="*" element={<Navigate to="/accueil" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;