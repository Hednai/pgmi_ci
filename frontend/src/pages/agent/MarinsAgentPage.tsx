// ============================================
// pages/agent/MarinsAgentPage.tsx
// Registre des marins au guichet : recherche, activation, attribution du
// matricule.
//
// L'activation demande une trace écrite de la pièce vérifiée : c'est ce qui
// donne sa valeur à la règle R1 lors d'un contrôle ultérieur.
// ============================================
import { useEffect, useState } from "react";
import { t, libelle } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { Icone } from "../../components/atoms/Icone.js";
import { EnteteAgent, PanneauTraitement } from "../../components/layouts/EnteteAgent.js";
import { dateCourte, initiales } from "../../lib/format.js";
import type { MarinResume, Pagine } from "../../types/api.js";

const STATUTS_MARIN: Record<string, string> = {
  PENDING: "En attente d'activation",
  PENDING_DGAM_VALIDATION: "À valider (ARSTM)",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
};

export function MarinsAgentPage() {
  const [resultat, setResultat] = useState<Pagine<MarinResume> | null>(null);
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("");
  const [selection, setSelection] = useState<MarinResume | null>(null);
  const [controle, setControle] = useState("");
  const [erreur, setErreur] = useState("");
  const [action, setAction] = useState(false);

  const charger = async () => {
    const parametres = new URLSearchParams();
    if (recherche) parametres.set("q", recherche);
    if (statut) parametres.set("status", statut);
    setResultat(await api.get<Pagine<MarinResume>>(`/api/marins?${parametres.toString()}`));
  };

  useEffect(() => {
    // Petite temporisation : évite une requête par frappe pendant la saisie
    const minuterie = setTimeout(() => {
      charger().catch(() => setErreur(t.commun.erreurReseau));
    }, 300);
    return () => clearTimeout(minuterie);
  }, [recherche, statut]);

  const activer = async () => {
    if (!selection) return;
    setErreur("");
    setAction(true);
    try {
      await api.post(`/api/marins/${selection.id}/activation`, { identityCheck: controle });
      setSelection(null);
      setControle("");
      await charger();
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
        titre={t.navigation.marins}
        sousTitre={`${resultat.total} ${t.agent.marinsInscrits}`}
        icone="marins"
      />

      <div className="space-y-4">
        {/* Recherche et filtre de statut, alignés comme dans les autres files */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-bordure bg-white px-3.5 py-2.5 focus-within:border-navy-light">
            <Icone nom="recherche" taille={16} className="shrink-0 text-ardoise" />
            <input
              type="search"
              placeholder={t.commun.rechercher}
              value={recherche}
              onChange={function (evenement) {
                setRecherche(evenement.target.value);
              }}
              className="w-full bg-transparent text-sm text-navy outline-none"
            />
          </div>

          <select
            value={statut}
            onChange={function (evenement) {
              setStatut(evenement.target.value);
            }}
            className="rounded-xl border border-bordure bg-white px-3.5 py-2.5 text-sm text-navy outline-none"
          >
            <option value="">{t.commun.voirTout}</option>
            {Object.entries(STATUTS_MARIN).map(function afficherStatut([cle, valeur]) {
              return (
                <option key={cle} value={cle}>
                  {valeur}
                </option>
              );
            })}
          </select>
        </div>

        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {resultat.items.length === 0 ? (
          <EtatVide message={t.commun.aucunResultat} />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-bordure bg-fond text-left">
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">
                    {t.agent.marin}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">
                    {t.profil.fonction}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">
                    {t.profil.region}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">
                    {t.agent.statut}
                  </th>
                  <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">
                    {t.agent.depot}
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-bordure">
                {resultat.items.map(function afficherMarin(marin) {
                  return (
                    <tr
                      key={marin.id}
                      onClick={function () {
                        setSelection(marin);
                      }}
                      className="cursor-pointer transition-colors hover:bg-fond"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${marin.status === "ACTIVE" ? "bg-teal-sea" : "bg-orange-ci"}`}
                          >
                            {initiales(marin.fullName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-navy">
                              {marin.fullName}
                            </p>
                            <p className="matricule text-[10px] text-ardoise">
                              {marin.matricule ?? "\u2014"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-[13px] text-navy/80">
                        {marin.fonction ?? "\u2014"}
                        {marin.isCadet && (
                          <span className="ml-1.5 rounded bg-navy-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase text-navy-light">
                            {t.arstm.eleve}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-[13px] text-navy/80">
                        {marin.region ?? "\u2014"}
                      </td>

                      <td className="px-4 py-3">
                        <BadgeStatut
                          statut={marin.status}
                          libelle={libelle(STATUTS_MARIN, marin.status)}
                        />
                      </td>

                      <td className="px-4 py-3 text-[12px] text-ardoise">
                        {dateCourte(marin.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

      {selection && (
        <PanneauTraitement
          titre={selection.fullName}
          sousTitre={selection.matricule ?? t.tableauBordMarin.dossierEnAttente}
          onFermer={function () {
            setSelection(null);
          }}
        >
            {selection.status !== "ACTIVE" ? (
              <>
                <InputField
                  label={t.agent.pieceVerifiee}
                  aide="CNI n° …, passeport n° …"
                  value={controle}
                  onChange={(evenement) => setControle(evenement.target.value)}
                  obligatoire
                />

                {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

                <Button
                  pleineLargeur
                  variante="succes"
                  chargement={action}
                  disabled={controle.trim().length < 3}
                  onClick={activer}
                >
                  {t.agent.activerDossier}
                </Button>
              </>
            ) : (
              <Alerte ton="succes">{t.agent.matriculeAttribue}</Alerte>
            )}

        </PanneauTraitement>
      )}
      </div>
    </div>
  );
}
