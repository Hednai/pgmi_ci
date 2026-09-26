// ============================================
// pages/agent/TableauBordAgentPage.tsx
// Tableau de bord du poste agent.
//
// Les indicateurs cliquables mènent directement à la file correspondante :
// l'agent doit atteindre son travail en un geste.
// ============================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { StatCard } from "../../components/molecules/StatCard.js";
import { Card, SectionTitre } from "../../components/atoms/Card.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { dateCourte } from "../../lib/format.js";
import type { SyntheseAgent } from "../../types/api.js";

export const TableauBordAgentPage = () => {
  const [synthese, setSynthese] = useState<SyntheseAgent | null>(null);
  const [erreur, setErreur] = useState("");
  const agent = useAuthStore((etat) => etat.agent);
  const naviguer = useNavigate();

  useEffect(() => {
    api
      .get<SyntheseAgent>("/api/dashboard")
      .then(setSynthese)
      .catch(() => setErreur(t.commun.erreurReseau));
  }, []);

  if (erreur) return <Alerte ton="erreur">{erreur}</Alerte>;
  if (!synthese) return <ChargementPage />;

  const stats = synthese.statistiques;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-titre text-xl font-bold text-navy">
          {t.agent.bienvenue} {agent?.firstName}
        </h1>
        <p className="text-sm text-ardoise">{agent?.roleLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <StatCard
          valeur={stats.demandesAInstruire}
          libelle={t.agent.demandesAInstruire}
          onClick={() => naviguer("/agent/demandes")}
        />
        <StatCard
          valeur={stats.mesDossiers}
          libelle={t.agent.mesDossiers}
          ton="alerte"
          onClick={() => naviguer("/agent/demandes?mesDossiers=1")}
        />
        <StatCard
          valeur={stats.documentsAVerifier}
          libelle={t.agent.documentsAVerifier}
          onClick={() => naviguer("/agent/verifications")}
        />
        <StatCard
          valeur={stats.embarquementsAVerifier}
          libelle={t.agent.embarquementsAVerifier}
          onClick={() => naviguer("/agent/verifications")}
        />
        <StatCard
          valeur={stats.marinsEnAttente}
          libelle={t.agent.marinsEnAttente}
          ton="alerte"
          onClick={() => naviguer("/agent/marins")}
        />
        <StatCard
          valeur={stats.elevesArstmEnAttente}
          libelle={t.agent.elevesArstm}
          ton="alerte"
          onClick={() => naviguer("/agent/marins?source=ARSTM_ENROLLMENT")}
        />
        <StatCard valeur={stats.marinsActifs} libelle={t.agent.marinsActifs} ton="succes" />
        <StatCard
          valeur={stats.certificatsExpires}
          libelle={t.agent.certificatsExpires}
          ton="erreur"
        />
        <StatCard
          valeur={stats.certificatsBientotExpires}
          libelle={t.agent.certificatsBientot}
          ton="alerte"
        />
        <StatCard valeur={stats.verificationsDuJour} libelle={t.agent.verificationsDuJour} />
      </div>

      <section>
        <SectionTitre titre={t.agent.activiteRecente} />
        <Card className="divide-y divide-bordure p-0">
          {synthese.activite.map((entree) => (
            <div key={entree.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy">{entree.action}</p>
                <p className="text-xs text-ardoise">{entree.actorLabel ?? "Système"}</p>
              </div>
              <span className="shrink-0 text-xs text-ardoise">
                {dateCourte(entree.createdAt)}
              </span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
};
