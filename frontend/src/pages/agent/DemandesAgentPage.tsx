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
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { TextAreaField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import {
  EnteteAgent,
  BarreFiltres,
  PanneauTraitement,
} from "../../components/layouts/EnteteAgent.js";
import { dateCourte, initiales, montant } from "../../lib/format.js";
import type { Demande, Pagine } from "../../types/api.js";

const FILTRES = [
  { valeur: "", libelle: t.commun.voirTout },
  { valeur: "SUBMITTED", libelle: t.demandes.statut.SUBMITTED },
  { valeur: "ASSIGNED", libelle: t.demandes.statut.ASSIGNED },
  { valeur: "IN_REVIEW", libelle: t.demandes.statut.IN_REVIEW },
  { valeur: "AWAITING_PAYMENT", libelle: t.demandes.statut.AWAITING_PAYMENT },
];

export function DemandesAgentPage() {
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
    <div>
      <EnteteAgent
        titre={t.navigation.demandes}
        sousTitre={`${resultat.total} ${t.agent.dossiersDansLaFile}`}
        icone="demandes"
      />

      <div className="space-y-4">
        <BarreFiltres filtres={FILTRES} actif={filtre} onChange={setFiltre} />

        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {resultat.items.length === 0 ? (
          <EtatVide message={t.agent.aucuneDemande} />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-bordure bg-fond text-left">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">
                    {t.agent.marin}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">
                    {t.agent.nature}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">
                    {t.agent.statut}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">
                    {t.demandes.fraisDossier}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">
                    {t.agent.depot}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-bordure">
                {resultat.items.map(function afficherLigne(demande) {
                  return (
                    <tr
                      key={demande.id}
                      onClick={function () {
                        setSelection(demande);
                      }}
                      className="cursor-pointer transition-colors hover:bg-fond"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[9px] font-bold text-white">
                            {initiales(demande.marin ? demande.marin.fullName : "")}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-navy">
                              {demande.marin ? demande.marin.fullName : ""}
                            </p>
                            <p className="matricule text-[10px] text-ardoise">
                              {demande.marin?.matricule ?? demande.reference}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <p className="text-[13px] text-navy/80">{demande.certificateType.label}</p>
                        <p className="text-[10px] text-ardoise">
                          {libelle(t.demandes.type, demande.type)}
                        </p>
                      </td>

                      <td className="px-4 py-3">
                        <BadgeStatut
                          statut={demande.status}
                          libelle={libelle(t.demandes.statut, demande.status)}
                        />
                      </td>

                      <td className="px-4 py-3 text-[13px] font-medium text-navy">
                        {demande.feeAmount > 0
                          ? montant(demande.feeAmount, demande.currency)
                          : t.demandes.gratuit}
                      </td>

                      <td className="px-4 py-3 text-[12px] text-ardoise">
                        {dateCourte(demande.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

      {/* Panneau de décision : ouvert par-dessus la liste pour garder le
          contexte de la file en arrière-plan. */}
      {selection && (
        <PanneauTraitement
          titre={selection.certificateType.label}
          sousTitre={`${selection.reference}, ${selection.marin ? selection.marin.fullName : ""}`}
          onFermer={function () {
            setSelection(null);
          }}
        >
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

        </PanneauTraitement>
      )}
      </div>
    </div>
  );
}
