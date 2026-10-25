// ============================================
// pages/marin/ServiceMerPage.tsx
// Registre de service en mer : déclaration des embarquements et preuves.
//
// Le registre se lit comme une carrière : regroupement par année, du plus
// récent au plus ancien, avec un filet latéral coloré selon l'état de
// vérification. La durée est affichée pendant la saisie, mais c'est le
// serveur qui la recalcule : l'affichage aide, il ne fait pas foi (R4).
// ============================================
import { useEffect, useMemo, useState } from "react";
import { t, libelle } from "../../i18n/index.js";
import { api, lireFichier, ErreurApi } from "../../lib/apiClient.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { Icone } from "../../components/atoms/Icone.js";
import { InputField, SelectField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { EnteteEcran, TuileChiffre } from "../../components/layouts/EnteteEcran.js";
import type { DossierServiceMer, Embarquement } from "../../types/api.js";

const MS_JOUR = 24 * 60 * 60 * 1000;

// Regroupe les embarquements par année de début, années décroissantes.
function grouperParAnnee(embarquements: Embarquement[]): [string, Embarquement[]][] {
  const groupes = new Map<string, Embarquement[]>();

  embarquements.forEach(function (embarquement) {
    const annee = String(new Date(embarquement.startDate).getUTCFullYear());
    const existant = groupes.get(annee);
    if (existant) {
      existant.push(embarquement);
    } else {
      groupes.set(annee, [embarquement]);
    }
  });

  return Array.from(groupes.entries()).sort(function (premier, second) {
    return Number(second[0]) - Number(premier[0]);
  });
}

// Date au format jour et mois, suffisant dans une section déjà datée par année.
function jourEtMois(valeur: string | null): string {
  if (!valeur) {
    return "—";
  }
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const jour = String(date.getUTCDate()).padStart(2, "0");
  const mois = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${jour}/${mois}`;
}

// Colonne d'information d'un embarquement : libellé discret, valeur en gras.
function ColonneInfo({
  libelle: etiquette,
  valeur,
  couleur = "text-navy",
}: {
  libelle: string;
  valeur: string | number;
  couleur?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-ardoise">{etiquette}</p>
      <p className={`mt-0.5 text-[13px] font-semibold ${couleur}`}>{valeur}</p>
    </div>
  );
}

export function ServiceMerPage() {
  const [dossier, setDossier] = useState<DossierServiceMer | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const { fonctions, charger } = useReferentielStore();

  const [formulaire, setFormulaire] = useState({
    vesselName: "",
    imoNumber: "",
    flag: "",
    vesselType: "",
    fonctionId: "",
    startDate: "",
    endDate: "",
  });

  function rafraichir() {
    return api
      .get<DossierServiceMer>("/api/sea-service/me")
      .then(setDossier)
      .catch(function () {
        setErreur(t.commun.erreurReseau);
      });
  }

  useEffect(
    function chargerDossier() {
      void charger();
      void rafraichir();
    },
    [charger],
  );

  // Aperçu de la durée, jour d'embarquement et de débarquement compris.
  const dureeApercu = useMemo(
    function calculerDuree() {
      if (!formulaire.startDate || !formulaire.endDate) {
        return null;
      }
      const debut = new Date(formulaire.startDate).getTime();
      const fin = new Date(formulaire.endDate).getTime();
      if (Number.isNaN(debut) || Number.isNaN(fin) || fin < debut) {
        return null;
      }
      return Math.round((fin - debut) / MS_JOUR) + 1;
    },
    [formulaire.startDate, formulaire.endDate],
  );

  const parAnnee = useMemo(
    function regrouper() {
      return dossier ? grouperParAnnee(dossier.embarquements) : [];
    },
    [dossier],
  );

  async function declarer() {
    setErreur("");
    setEnvoi(true);
    try {
      await api.post("/api/sea-service/me", {
        ...formulaire,
        imoNumber: formulaire.imoNumber || undefined,
        fonctionId: formulaire.fonctionId || undefined,
      });
      setOuvert(false);
      setFormulaire({
        vesselName: "",
        imoNumber: "",
        flag: "",
        vesselType: "",
        fonctionId: "",
        startDate: "",
        endDate: "",
      });
      await rafraichir();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setEnvoi(false);
    }
  }

  async function joindrePreuve(embarquementId: string, fichier: File) {
    setErreur("");
    try {
      await api.post(`/api/sea-service/me/${embarquementId}/preuve`, {
        fichier: await lireFichier(fichier),
      });
      await rafraichir();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    }
  }

  if (!dossier) {
    return <ChargementPage />;
  }

  return (
    <div>
      <EnteteEcran titre={t.serviceMer.titre}>
        <div className="flex gap-3">
          <TuileChiffre valeur={dossier.totaux.joursVerifies} libelle={t.serviceMer.totalVerifie} />
          <TuileChiffre
            valeur={dossier.totaux.joursEnAttente}
            libelle={t.serviceMer.totalAttente}
            accentue
          />
          <TuileChiffre
            valeur={dossier.totaux.embarquements}
            libelle={t.serviceMer.embarquements}
          />
        </div>
      </EnteteEcran>

      <div className="space-y-4">
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        <button
          type="button"
          onClick={function () {
            setOuvert(!ouvert);
          }}
          className="w-full rounded-xl border-[1.5px] border-dashed border-navy bg-fond py-3.5 text-sm font-semibold text-navy transition-colors hover:bg-navy-soft"
        >
          {ouvert ? (
            t.commun.annuler
          ) : (
            <span className="inline-flex items-center justify-center gap-2">
              <Icone nom="nouvelleDemande" taille={16} />
              {t.serviceMer.declarer}
            </span>
          )}
        </button>

        {ouvert && (
          <Card className="space-y-4">
            <InputField
              label={t.serviceMer.navire}
              value={formulaire.vesselName}
              onChange={function (evenement) {
                setFormulaire({ ...formulaire, vesselName: evenement.target.value });
              }}
              obligatoire
            />

            <div className="grid grid-cols-2 gap-3">
              <InputField
                label={t.serviceMer.imo}
                inputMode="numeric"
                value={formulaire.imoNumber}
                onChange={function (evenement) {
                  setFormulaire({ ...formulaire, imoNumber: evenement.target.value });
                }}
              />
              <InputField
                label={t.serviceMer.pavillon}
                value={formulaire.flag}
                onChange={function (evenement) {
                  setFormulaire({ ...formulaire, flag: evenement.target.value });
                }}
              />
            </div>

            <SelectField
              label={t.serviceMer.fonction}
              value={formulaire.fonctionId}
              onChange={function (evenement) {
                setFormulaire({ ...formulaire, fonctionId: evenement.target.value });
              }}
            >
              <option value="">—</option>
              {fonctions?.map(function afficherFonction(fonction) {
                return (
                  <option key={fonction.id} value={fonction.id}>
                    {fonction.label}
                  </option>
                );
              })}
            </SelectField>

            <div className="grid grid-cols-2 gap-3">
              <InputField
                label={t.serviceMer.debut}
                type="date"
                value={formulaire.startDate}
                onChange={function (evenement) {
                  setFormulaire({ ...formulaire, startDate: evenement.target.value });
                }}
                obligatoire
              />
              <InputField
                label={t.serviceMer.fin}
                type="date"
                value={formulaire.endDate}
                onChange={function (evenement) {
                  setFormulaire({ ...formulaire, endDate: evenement.target.value });
                }}
                obligatoire
              />
            </div>

            {dureeApercu !== null && (
              <p className="text-sm font-medium text-navy">
                {t.serviceMer.dureeCalculee} : {dureeApercu} {t.commun.jours}
              </p>
            )}

            <Alerte ton="info">{t.serviceMer.preuveAide}</Alerte>

            <Button
              pleineLargeur
              chargement={envoi}
              disabled={!formulaire.vesselName || !formulaire.startDate || !formulaire.endDate}
              onClick={declarer}
            >
              {t.commun.enregistrer}
            </Button>
          </Card>
        )}

        {dossier.embarquements.length === 0 ? (
          <EtatVide message={t.serviceMer.aucun} />
        ) : (
          parAnnee.map(function afficherAnnee([annee, embarquements]) {
            return (
              <section key={annee}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-navy">
                    {annee}
                  </span>
                  <span className="h-px flex-1 bg-bordure" />
                </div>

                <div className="space-y-5">
                  {embarquements.map(function afficherEmbarquement(embarquement) {
                    const verifie = embarquement.status === "VERIFIED";
                    const rejete = embarquement.status === "REJECTED";
                    const filet = verifie
                      ? "border-teal-sea"
                      : rejete
                        ? "border-erreur"
                        : "border-orange-ci";
                    const couleurJours = verifie
                      ? "text-teal-sea"
                      : rejete
                        ? "text-erreur"
                        : "text-orange-ci";

                    return (
                      <div
                        key={embarquement.id}
                        className={`border-l-[3px] ${filet} pl-4`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-titre text-base font-bold text-navy">
                              {embarquement.vesselName}
                            </p>
                            <p className="mt-0.5 text-xs text-ardoise">
                              {embarquement.imoNumber ? `IMO ${embarquement.imoNumber}` : ""}
                              {embarquement.imoNumber && embarquement.vesselType ? ", " : ""}
                              {embarquement.vesselType ?? ""}
                            </p>
                          </div>
                          <BadgeStatut
                            statut={embarquement.status}
                            libelle={libelle(t.serviceMer.statut, embarquement.status)}
                          />
                        </div>

                        <div className="mt-2.5 flex gap-6">
                          <ColonneInfo
                            libelle={t.serviceMer.fonction}
                            valeur={embarquement.fonction ? embarquement.fonction.code : "—"}
                          />
                          <ColonneInfo
                            libelle={t.serviceMer.periode}
                            valeur={`${jourEtMois(embarquement.startDate)} → ${jourEtMois(embarquement.endDate)}`}
                          />
                          <ColonneInfo
                            libelle={t.serviceMer.joursColonne}
                            valeur={embarquement.days}
                            couleur={couleurJours}
                          />
                        </div>

                        {/* Traçabilité de la vérification par l'autorité */}
                        {verifie && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <Icone nom="verifie" taille={13} className="shrink-0 text-teal-sea" />
                            <span className="text-[11px] font-medium text-teal-sea">
                              {t.serviceMer.verifiePar}
                            </span>
                          </div>
                        )}

                        {embarquement.proofUrl && !verifie && (
                          <p className="mt-2 text-[11px] text-ardoise">
                            {t.serviceMer.preuveSoumise}
                          </p>
                        )}

                        {embarquement.rejectReason && (
                          <p className="mt-2 text-xs font-medium text-erreur">
                            {embarquement.rejectReason}
                          </p>
                        )}

                        {/* Sans preuve, les jours ne comptent pas : le dépôt est
                            proposé directement sur la ligne concernée. */}
                        {!embarquement.proofUrl && !verifie && (
                          <label className="mt-3 block">
                            <span className="text-xs font-medium text-navy-light">
                              {t.serviceMer.joindrePreuve}
                            </span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,application/pdf"
                              className="mt-1 block w-full text-xs text-ardoise"
                              onChange={function (evenement) {
                                const fichier = evenement.target.files?.[0];
                                if (fichier) {
                                  void joindrePreuve(embarquement.id, fichier);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
