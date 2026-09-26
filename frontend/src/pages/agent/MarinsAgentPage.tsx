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
import { Card, EtatVide, SectionTitre } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { dateCourte } from "../../lib/format.js";
import type { MarinResume, Pagine } from "../../types/api.js";

const STATUTS_MARIN: Record<string, string> = {
  PENDING: "En attente d'activation",
  PENDING_DGAM_VALIDATION: "À valider (ARSTM)",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
};

export const MarinsAgentPage = () => {
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
    <div className="space-y-4">
      <SectionTitre titre={t.navigation.marins} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          placeholder={t.commun.rechercher}
          value={recherche}
          onChange={(evenement) => setRecherche(evenement.target.value)}
          className="flex-1 rounded-xl border border-bordure bg-white px-3.5 py-2.5 text-sm outline-none focus:border-navy-light"
        />
        <select
          value={statut}
          onChange={(evenement) => setStatut(evenement.target.value)}
          className="rounded-xl border border-bordure bg-white px-3.5 py-2.5 text-sm outline-none"
        >
          <option value="">{t.commun.voirTout}</option>
          {Object.entries(STATUTS_MARIN).map(([cle, valeur]) => (
            <option key={cle} value={cle}>
              {valeur}
            </option>
          ))}
        </select>
      </div>

      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      {resultat.items.length === 0 ? (
        <EtatVide message={t.commun.aucunResultat} />
      ) : (
        <div className="space-y-2">
          {resultat.items.map((marin) => (
            <Card key={marin.id} onClick={() => setSelection(marin)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{marin.fullName}</p>
                  <p className="matricule mt-0.5 text-xs text-ardoise">
                    {marin.matricule ?? "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-ardoise">
                    {marin.fonction ?? ""} {marin.region ? `· ${marin.region}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <BadgeStatut
                    statut={marin.status}
                    libelle={libelle(STATUTS_MARIN, marin.status)}
                  />
                  <p className="mt-1 text-xs text-ardoise">{dateCourte(marin.createdAt)}</p>
                </div>
              </div>

              {marin.isCadet && (
                <p className="mt-2 text-xs font-medium text-navy-light">
                  {t.arstm.inscrireEleve}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {selection && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-navy/70 sm:items-center sm:p-6">
          <Card className="w-full max-w-md space-y-4 rounded-b-none sm:rounded-carte">
            <div>
              <p className="font-titre text-base font-semibold text-navy">
                {selection.fullName}
              </p>
              <p className="matricule mt-0.5 text-xs text-ardoise">
                {selection.matricule ?? t.tableauBordMarin.dossierEnAttente}
              </p>
            </div>

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

            <Button variante="discret" pleineLargeur onClick={() => setSelection(null)}>
              {t.commun.fermer}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};
