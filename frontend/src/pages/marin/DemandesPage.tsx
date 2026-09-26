// ============================================
// pages/marin/DemandesPage.tsx
// Suivi des demandes du marin.
// ============================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t, libelle } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { Card, SectionTitre, EtatVide } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { dateCourte, montant } from "../../lib/format.js";
import type { Demande } from "../../types/api.js";

export const DemandesPage = () => {
  const [demandes, setDemandes] = useState<Demande[] | null>(null);
  const [erreur, setErreur] = useState("");
  const naviguer = useNavigate();

  useEffect(() => {
    api
      .get<Demande[]>("/api/demandes/me")
      .then(setDemandes)
      .catch(() => setErreur(t.commun.erreurReseau));
  }, []);

  if (erreur) return <Alerte ton="erreur">{erreur}</Alerte>;
  if (!demandes) return <ChargementPage />;

  return (
    <div className="space-y-4">
      <SectionTitre
        titre={t.demandes.titre}
        action={
          <Button taille="sm" onClick={() => naviguer("/demandes/nouvelle")}>
            {t.demandes.nouvelle}
          </Button>
        }
      />

      {demandes.length === 0 ? (
        <EtatVide message={t.demandes.aucune} />
      ) : (
        demandes.map((demande) => (
          <Card key={demande.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="matricule text-xs text-ardoise">{demande.reference}</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-navy">
                  {demande.certificateType.label}
                </p>
                <p className="mt-0.5 text-xs text-ardoise">
                  {libelle(t.demandes.type, demande.type)} · {dateCourte(demande.createdAt)}
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
                {t.paiement.payer} · {montant(demande.feeAmount, demande.currency)}
              </Button>
            )}
          </Card>
        ))
      )}
    </div>
  );
};
