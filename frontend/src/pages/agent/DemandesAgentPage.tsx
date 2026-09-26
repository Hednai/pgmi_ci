// ============================================
// pages/agent/DemandesAgentPage.tsx
// File d'instruction des demandes et actions de décision.
//
// Les refus du serveur (règles R6, R8, R9) sont affichés tels quels avec
// leur identifiant de règle : l'agent comprend pourquoi il est bloqué.
// ============================================
import { useEffect, useState } from "react";
import { t, libelle } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Card, EtatVide, SectionTitre } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { TextAreaField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { dateCourte, montant } from "../../lib/format.js";
import type { Demande, Pagine } from "../../types/api.js";

const FILTRES = [
  { cle: "", libelleFiltre: t.commun.voirTout },
  { cle: "SUBMITTED", libelleFiltre: t.demandes.statut.SUBMITTED ?? "" },
  { cle: "ASSIGNED", libelleFiltre: t.demandes.statut.ASSIGNED ?? "" },
  { cle: "IN_REVIEW", libelleFiltre: t.demandes.statut.IN_REVIEW ?? "" },
  { cle: "AWAITING_PAYMENT", libelleFiltre: t.demandes.statut.AWAITING_PAYMENT ?? "" },
];

export const DemandesAgentPage = () => {
  const [resultat, setResultat] = useState<Pagine<Demande> | null>(null);
  const [filtre, setFiltre] = useState("");
  const [selection, setSelection] = useState<Demande | null>(null);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState("");
  const [action, setAction] = useState(false);

  const charger = async (statut: string) => {
    const donnees = await api.get<Pagine<Demande>>(
      `/api/demandes${statut ? `?status=${statut}` : ""}`,
    );
    setResultat(donnees);
  };

  useEffect(() => {
    charger(filtre).catch(() => setErreur(t.commun.erreurReseau));
  }, [filtre]);

  const executer = async (chemin: string, corps?: unknown) => {
    if (!selection) return;
    setErreur("");
    setAction(true);
    try {
      await api.post(`/api/demandes/${selection.id}/${chemin}`, corps);
      setSelection(null);
      setMotif("");
      await charger(filtre);
    } catch (err) {
      setErreur(
        err instanceof ErreurApi
          ? `${err.message}${err.regle ? ` (${err.regle})` : ""}`
          : t.commun.erreurReseau,
      );
    } finally {
      setAction(false);
    }
  };

  if (!resultat) return <ChargementPage />;

  return (
    <div className="space-y-4">
      <SectionTitre titre={t.navigation.demandes} />

      <div className="flex flex-wrap gap-2">
        {FILTRES.map((element) => (
          <button
            key={element.cle}
            type="button"
            onClick={() => setFiltre(element.cle)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filtre === element.cle ? "bg-navy text-white" : "bg-white text-ardoise"}`}
          >
            {element.libelleFiltre}
          </button>
        ))}
      </div>

      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      {resultat.items.length === 0 ? (
        <EtatVide message={t.agent.aucuneDemande} />
      ) : (
        <div className="space-y-2">
          {resultat.items.map((demande) => (
            <Card key={demande.id} onClick={() => setSelection(demande)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="matricule text-xs text-ardoise">{demande.reference}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-navy">
                    {demande.certificateType.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ardoise">
                    {demande.marin?.fullName} · {demande.marin?.matricule ?? ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <BadgeStatut
                    statut={demande.status}
                    libelle={libelle(t.demandes.statut, demande.status)}
                  />
                  <p className="mt-1 text-xs text-ardoise">{dateCourte(demande.createdAt)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Panneau de décision : ouvert par-dessus la liste pour garder le
          contexte de la file en arrière-plan. */}
      {selection && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-navy/70 p-0 sm:items-center sm:p-6">
          <Card className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-b-none sm:rounded-carte">
            <div>
              <p className="matricule text-xs text-ardoise">{selection.reference}</p>
              <p className="font-titre text-base font-semibold text-navy">
                {selection.certificateType.label}
              </p>
              <p className="mt-1 text-sm text-ardoise">
                {selection.marin?.fullName} · {selection.marin?.matricule ?? ""}
              </p>
            </div>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-bordure pb-2">
                <dt className="text-ardoise">{t.demandes.typeDemande}</dt>
                <dd className="font-medium text-navy">
                  {libelle(t.demandes.type, selection.type)}
                </dd>
              </div>
              <div className="flex justify-between border-b border-bordure pb-2">
                <dt className="text-ardoise">{t.demandes.fraisDossier}</dt>
                <dd className="font-medium text-navy">
                  {selection.feeAmount > 0
                    ? montant(selection.feeAmount, selection.currency)
                    : t.demandes.gratuit}
                </dd>
              </div>
              <div className="flex justify-between border-b border-bordure pb-2">
                <dt className="text-ardoise">{t.agent.soumisePar}</dt>
                <dd className="font-medium text-navy">{selection.submittedByRole}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ardoise">{t.demandes.pieces}</dt>
                <dd className="font-medium text-navy">{selection.attachments.length}</dd>
              </div>
            </dl>

            {selection.reason && <Alerte ton="info">{selection.reason}</Alerte>}

            <TextAreaField
              label={t.agent.motifRejet}
              aide={t.agent.motifObligatoire}
              value={motif}
              onChange={(evenement) => setMotif(evenement.target.value)}
            />

            {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

            <div className="grid grid-cols-2 gap-2">
              <Button
                variante="discret"
                chargement={action}
                onClick={() => executer("instruction")}
              >
                {t.agent.instruire}
              </Button>
              <Button
                variante="discret"
                chargement={action}
                disabled={motif.trim().length < 5}
                onClick={() => executer("complement", { message: motif })}
              >
                {t.agent.demanderPieces}
              </Button>
              <Button
                variante="danger"
                chargement={action}
                disabled={motif.trim().length < 5}
                onClick={() => executer("rejet", { reason: motif })}
              >
                {t.agent.rejeter}
              </Button>
              <Button
                variante="succes"
                chargement={action}
                onClick={() => executer("approbation", { reason: motif || undefined })}
              >
                {t.agent.approuver}
              </Button>
            </div>

            {selection.status === "AWAITING_PAYMENT" && (
              <Button
                variante="secondaire"
                pleineLargeur
                chargement={action}
                onClick={() => executer("encaissement")}
              >
                {t.agent.encaisser}
              </Button>
            )}

            <Button variante="discret" pleineLargeur onClick={() => setSelection(null)}>
              {t.commun.fermer}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};
