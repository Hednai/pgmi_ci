// ============================================
// pages/marin/AccueilPage.tsx
// Écran d'accueil du marin : état du dossier, alertes, actions rapides.
//
// L'ordre des blocs suit l'urgence : ce qui expire d'abord, le reste ensuite.
// ============================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { Card, SectionTitre } from "../../components/atoms/Card.js";
import { StatCard } from "../../components/molecules/StatCard.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { Button } from "../../components/atoms/Button.js";
import { dateCourte, dureeEnJours } from "../../lib/format.js";
import type { SyntheseMarin } from "../../types/api.js";

export const AccueilPage = () => {
  const [synthese, setSynthese] = useState<SyntheseMarin | null>(null);
  const [erreur, setErreur] = useState("");
  const naviguer = useNavigate();

  useEffect(() => {
    api
      .get<SyntheseMarin>("/api/marins/me/synthese")
      .then(setSynthese)
      .catch(() => setErreur(t.commun.erreurReseau));
  }, []);

  if (erreur) return <Alerte ton="erreur">{erreur}</Alerte>;
  if (!synthese) return <ChargementPage />;

  const { marin, statistiques, alertes } = synthese;

  return (
    <div className="space-y-5">
      {/* Un dossier non activé bloque la plupart des actions : l'information
          arrive avant tout le reste. */}
      {!marin.isActive && (
        <Alerte ton="alerte" titre={t.tableauBordMarin.dossierEnAttente}>
          {t.tableauBordMarin.dossierEnAttenteDetail}
        </Alerte>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard valeur={statistiques.documents} libelle={t.tableauBordMarin.documentsValides} />
        <StatCard
          valeur={statistiques.joursVerifies}
          libelle={t.tableauBordMarin.joursMer}
          detail={
            statistiques.joursEnAttente > 0
              ? `${statistiques.joursEnAttente} ${t.tableauBordMarin.joursEnAttente}`
              : undefined
          }
          ton="succes"
        />
      </div>

      <section>
        <SectionTitre titre={t.tableauBordMarin.alertes} />
        {alertes.length === 0 ? (
          <Card>
            <p className="text-sm text-ardoise">{t.tableauBordMarin.aucuneAlerte}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {alertes.map((alerte) => (
              <Card key={alerte.documentId} onClick={() => naviguer("/documents")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-navy">{alerte.certificat}</p>
                    <p className="mt-0.5 text-xs text-ardoise">
                      {t.tableauBordMarin.expireLe} {dateCourte(alerte.expiryDate)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${alerte.joursRestants <= 90 ? "bg-erreur-soft text-erreur" : "bg-alerte-soft text-orange-ci"}`}
                  >
                    {dureeEnJours(alerte.joursRestants)}
                  </span>
                </div>
                {alerte.requiresTraining && (
                  <p className="mt-2 text-xs font-medium text-navy-light">
                    {t.conformite.sInscrire}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitre titre={t.tableauBordMarin.actionsRapides} />
        <div className="space-y-2">
          <Button
            pleineLargeur
            taille="lg"
            onClick={() => naviguer("/demandes/nouvelle")}
            disabled={!marin.isActive}
          >
            {t.tableauBordMarin.nouvelleDemande}
          </Button>
          <Button
            pleineLargeur
            variante="discret"
            onClick={() => naviguer("/documents")}
            disabled={!marin.isActive}
          >
            {t.tableauBordMarin.ajouterDocument}
          </Button>
          <Button
            pleineLargeur
            variante="discret"
            onClick={() => naviguer("/service-mer")}
            disabled={!marin.isActive}
          >
            {t.tableauBordMarin.declarerEmbarquement}
          </Button>
        </div>
      </section>

      {statistiques.demandesEnCours > 0 && (
        <Card onClick={() => naviguer("/demandes")}>
          <p className="text-sm font-semibold text-navy">
            {statistiques.demandesEnCours} {t.tableauBordMarin.demandesEnCours.toLowerCase()}
          </p>
          <p className="mt-0.5 text-xs text-ardoise">{t.commun.voirTout}</p>
        </Card>
      )}
    </div>
  );
};
