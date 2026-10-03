// ============================================
// pages/marin/DemandesPage.tsx
// Suivi des demandes du marin.
// ============================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t, libelle } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { Icone } from "../../components/atoms/Icone.js";
import { EnteteEcran, TuileChiffre } from "../../components/layouts/EnteteEcran.js";
import { dateCourte, montant } from "../../lib/format.js";
import type { Demande } from "../../types/api.js";

// Statuts qui appellent une action du marin : ils remontent en tête de liste.
const STATUTS_ACTION = ["AWAITING_PAYMENT", "INFO_REQUESTED"];

export function DemandesPage() {
  const [demandes, setDemandes] = useState<Demande[] | null>(null);
  const [erreur, setErreur] = useState("");
  const naviguer = useNavigate();

  useEffect(() => {
    api
      .get<Demande[]>("/api/demandes/me")
      .then(setDemandes)
      .catch(() => setErreur(t.commun.erreurReseau));
  }, []);

  if (erreur) {
    return <Alerte ton="erreur">{erreur}</Alerte>;
  }

  if (!demandes) {
    return <ChargementPage />;
  }

  // Ce qui attend une action du marin passe devant : payer ou compléter un
  // dossier est plus urgent que consulter une demande déjà instruite.
  const aTraiter = demandes.filter(function (demande) {
    return STATUTS_ACTION.includes(demande.status);
  }).length;

  const demandesTriees = demandes.slice().sort(function (premiere, seconde) {
    const poidsPremiere = STATUTS_ACTION.includes(premiere.status) ? 0 : 1;
    const poidsSeconde = STATUTS_ACTION.includes(seconde.status) ? 0 : 1;
    return poidsPremiere - poidsSeconde;
  });

  return (
    <div>
      <EnteteEcran titre={t.demandes.titre}>
        <div className="flex gap-3">
          <TuileChiffre valeur={demandes.length} libelle={t.demandes.titre} />
          <TuileChiffre valeur={aTraiter} libelle={t.demandes.actionAttendue} accentue />
        </div>
      </EnteteEcran>

      <div className="space-y-3">
        <button
          type="button"
          onClick={function () {
            naviguer("/demandes/nouvelle");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-ci py-3 text-sm font-semibold text-white shadow-lg shadow-orange-ci/25"
        >
          <Icone nom="nouvelleDemande" taille={16} />
          {t.demandes.nouvelle}
        </button>

      {demandes.length === 0 ? (
        <EtatVide message={t.demandes.aucune} />
      ) : (
        demandesTriees.map(function afficherDemande(demande) {
          const attendAction = STATUTS_ACTION.includes(demande.status);

          return (
          <Card
            key={demande.id}
            className={attendAction ? "border-[1.5px] border-orange-ci bg-alerte-soft/30" : ""}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="matricule text-xs text-ardoise">{demande.reference}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-navy">
                  {demande.certificateType.label}
                </p>
                <p className="mt-0.5 text-xs text-ardoise">
                  {libelle(t.demandes.type, demande.type)}, {dateCourte(demande.createdAt)}
                </p>
              </div>
              <BadgeStatut
                statut={demande.status}
                libelle={libelle(t.demandes.statut, demande.status)}
              />
            </div>

            {/* Pièces complémentaires demandées : c'est l'action attendue du
                marin, elle est mise en avant. */}
            {demande.additionalInfo && demande.status === "INFO_REQUESTED" && (
              <Alerte ton="alerte" titre={t.agent.piecesAttendues}>
                {demande.additionalInfo}
              </Alerte>
            )}

            {demande.decisionReason && demande.status === "REJECTED" && (
              <Alerte ton="erreur">{demande.decisionReason}</Alerte>
            )}

            {demande.status === "AWAITING_PAYMENT" && (
              <Button
                taille="sm"
                pleineLargeur
                className="mt-3"
                onClick={() => naviguer(`/demandes/${demande.id}/paiement`)}
              >
                {t.paiement.payer}, {montant(demande.feeAmount, demande.currency)}
              </Button>
            )}
          </Card>
          );
        })
      )}
      </div>
    </div>
  );
}
