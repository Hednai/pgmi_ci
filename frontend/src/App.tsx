// ============================================
// App.tsx
// Plan de routage de l'application.
//
// Trois espaces cloisonnés : public (vérification), marin, agent. La
// session est restaurée une fois au montage, avant tout rendu de route
// protégée, pour ne pas renvoyer un utilisateur connecté vers la connexion.
// ============================================
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore.js";

import { MarinLayout } from "./components/layouts/MarinLayout.js";
import { AgentLayout } from "./components/layouts/AgentLayout.js";
import { RouteMarin, RouteAgent } from "./components/layouts/ProtectedRoute.js";

import { ConnexionPage } from "./pages/marin/ConnexionPage.js";
import { InscriptionPage } from "./pages/marin/InscriptionPage.js";
import { AccueilPage } from "./pages/marin/AccueilPage.js";
import { DocumentsPage } from "./pages/marin/DocumentsPage.js";
import { ServiceMerPage } from "./pages/marin/ServiceMerPage.js";
import { ConformitePage } from "./pages/marin/ConformitePage.js";
import { FormationsPage } from "./pages/marin/FormationsPage.js";
import { ProfilPage } from "./pages/marin/ProfilPage.js";
import { DemandesPage } from "./pages/marin/DemandesPage.js";
import { NouvelleDemandePage } from "./pages/marin/NouvelleDemandePage.js";
import { PaiementPage } from "./pages/marin/PaiementPage.js";

import { ConnexionAgentPage } from "./pages/agent/ConnexionAgentPage.js";
import { TableauBordAgentPage } from "./pages/agent/TableauBordAgentPage.js";
import { DemandesAgentPage } from "./pages/agent/DemandesAgentPage.js";
import { MarinsAgentPage } from "./pages/agent/MarinsAgentPage.js";
import { VerificationsAgentPage } from "./pages/agent/VerificationsAgentPage.js";
import { ArstmPage } from "./pages/agent/ArstmPage.js";
import { ReferentielsPage } from "./pages/agent/ReferentielsPage.js";
import { JournalPage } from "./pages/agent/JournalPage.js";

import { VerificationPage } from "./pages/public/VerificationPage.js";

const ROLES_ARSTM = ["ARSTM_TRAINING", "ARSTM_REGISTRAR", "ARSTM_MANAGER"];
const ROLES_DGAM = ["DGAM_AGENT", "DGAM_SUPERVISOR", "PLATFORM_ADMIN", "BUSINESS_ADMIN"];

const App = () => {
  const restaurerSession = useAuthStore((etat) => etat.restaurerSession);

  useEffect(() => {
    void restaurerSession();
  }, [restaurerSession]);

  return (
    <BrowserRouter>
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
          <Route path="/conformite" element={<ConformitePage />} />
          <Route path="/formations" element={<FormationsPage />} />
          <Route path="/profil" element={<ProfilPage />} />
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
              <RouteAgent roles={ROLES_DGAM}>
                <DemandesAgentPage />
              </RouteAgent>
            }
          />
          <Route
            path="marins"
            element={
              <RouteAgent roles={ROLES_DGAM}>
                <MarinsAgentPage />
              </RouteAgent>
            }
          />
          <Route
            path="verifications"
            element={
              <RouteAgent roles={ROLES_DGAM}>
                <VerificationsAgentPage />
              </RouteAgent>
            }
          />
          <Route
            path="arstm"
            element={
              <RouteAgent roles={ROLES_ARSTM}>
                <ArstmPage />
              </RouteAgent>
            }
          />
          <Route
            path="referentiels"
            element={
              <RouteAgent roles={["BUSINESS_ADMIN", "PLATFORM_ADMIN"]}>
                <ReferentielsPage />
              </RouteAgent>
            }
          />
          <Route
            path="journal"
            element={
              <RouteAgent roles={["DGAM_SUPERVISOR", "PLATFORM_ADMIN"]}>
                <JournalPage />
              </RouteAgent>
            }
          />
        </Route>

        <Route path="/" element={<Navigate to="/accueil" replace />} />
        <Route path="*" element={<Navigate to="/accueil" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
