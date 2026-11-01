// ============================================
// pages/marin/ServiceMerPage.tsx
// Registre de service en mer : déclaration des embarquements et preuves.
// ============================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { t, libelle } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { repartirErreurs, AUCUNE_ERREUR } from "../../lib/erreursFormulaire.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { Icone } from "../../components/atoms/Icone.js";
import { InputField, SelectField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { EnteteEcran, TuileChiffre } from "../../components/layouts/EnteteEcran.js";
import { DossierJustificatifs } from "../../components/molecules/DossierJustificatifs.js";
import { QrPrestation } from "../../components/molecules/QrPrestation.js";
import { useFluxTempsReel } from "../../hooks/useFluxTempsReel.js";
import { EVENEMENTS_ECRAN } from "../../lib/evenements.js";
import { SERVICE_TARIFE } from "../../lib/baremes.js";
import type { DossierServiceMer, Embarquement } from "../../types/api.js";

const MS_JOUR = 24 * 60 * 60 * 1000;

function grouperParAnnee(embarquements: Embarquement[]): [string, Embarquement[]][] {
  const groupes = new Map<string, Embarquement[]>();
  embarquements.forEach(function (embarquement) {
    const annee = String(new Date(embarquement.startDate).getUTCFullYear());
    const existant = groupes.get(annee);
    if (existant) { existant.push(embarquement); } else { groupes.set(annee, [embarquement]); }
  });
  return Array.from(groupes.entries()).sort(function (a, b) { return Number(b[0]) - Number(a[0]); });
}

function jourEtMois(valeur: string | null): string {
  if (!valeur) return "—";
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return "—";
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function ColonneInfo({ libelle: etiquette, valeur, couleur = "text-navy" }: { libelle: string; valeur: string | number; couleur?: string }) {
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
  // Mouvement dont le QR est affiché. Un seul à la fois : deux vignettes
  // ouvertes sur un écran de téléphone ne seraient pas lisibles.
  const [qrOuvert, setQrOuvert] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  // Erreurs de validation rattachées à un champ du formulaire de déclaration
  const [erreursChamps, setErreursChamps] = useState(AUCUNE_ERREUR.parChamp);
  const [envoi, setEnvoi] = useState(false);
  const { fonctions, charger, baremeService } = useReferentielStore();

  // Frais de validation d'un mouvement, lus une fois pour tout l'écran. La
  // grille tarifaire est déjà chargée par le magasin des référentiels : il
  // n'y a ni appel supplémentaire ni montant écrit dans le code.
  const fraisValidation = baremeService(SERVICE_TARIFE.EMBARKATION_VALIDATION);

  const [formulaire, setFormulaire] = useState({
    vesselName: "", imoNumber: "", flag: "", vesselType: "", fonctionId: "", startDate: "", endDate: "",
  });

  const rafraichir = useCallback(function () {
    return api.get<DossierServiceMer>("/api/sea-service/me")
      .then(setDossier)
      .catch(function () { setErreur(t.commun.erreurReseau); });
  }, []);

  useEffect(function chargerDossier() {
    void charger();
    void rafraichir();
  }, [charger, rafraichir]);

  // La décision d'un agent arrive sans rechargement.
  useFluxTempsReel({
    evenements: EVENEMENTS_ECRAN.SERVICE_MER_MARIN,
    surEvenement: function () { void rafraichir(); },
  });

  const dureeApercu = useMemo(function calculerDuree() {
    if (!formulaire.startDate || !formulaire.endDate) return null;
    const debut = new Date(formulaire.startDate).getTime();
    const fin = new Date(formulaire.endDate).getTime();
    if (Number.isNaN(debut) || Number.isNaN(fin) || fin < debut) return null;
    return Math.round((fin - debut) / MS_JOUR) + 1;
  }, [formulaire.startDate, formulaire.endDate]);

  const parAnnee = useMemo(function regrouper() {
    return dossier ? grouperParAnnee(dossier.embarquements) : [];
  }, [dossier]);

  async function declarer() {
    setErreur("");
    setErreursChamps(AUCUNE_ERREUR.parChamp);
    setEnvoi(true);
    try {
      await api.post("/api/sea-service/me", {
        ...formulaire,
        imoNumber: formulaire.imoNumber || undefined,
        fonctionId: formulaire.fonctionId || undefined,
      });
      setOuvert(false);
      setFormulaire({ vesselName: "", imoNumber: "", flag: "", vesselType: "", fonctionId: "", startDate: "", endDate: "" });
      await rafraichir();
    } catch (err) {
      // Un refus de validation désigne le champ fautif : il s'affiche sous
      // ce champ, et le bandeau ne reste que pour ce qui n'y est pas rattaché.
      const erreurs = repartirErreurs(err, t.commun.erreurReseau);
      setErreursChamps(erreurs.parChamp);
      setErreur(erreurs.global);
    } finally {
      setEnvoi(false);
    }
  }

  if (!dossier) return <ChargementPage />;

  return (
    <div>
      <EnteteEcran titre={t.serviceMer.titre}>
        <div className="flex gap-3">
          <TuileChiffre valeur={dossier.totaux.joursVerifies} libelle={t.serviceMer.totalVerifie} />
          <TuileChiffre valeur={dossier.totaux.joursEnAttente} libelle={t.serviceMer.totalAttente} accentue />
          <TuileChiffre valeur={dossier.totaux.embarquements} libelle={t.serviceMer.embarquements} />
        </div>
      </EnteteEcran>

      <div className="space-y-4">
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {/* Le relevé agrège les mouvements vérifiés : il se consulte depuis
            l'écran qui les porte, sans occuper un onglet de la barre. */}
        <Link
          to="/releve"
          className="flex items-center justify-between rounded-xl border border-bordure bg-white px-4 py-3 text-sm font-semibold text-navy transition-colors hover:bg-navy-soft"
        >
          {t.releve.acces}
          <Icone nom="documents" taille={16} />
        </Link>

        <button type="button" onClick={function () { setOuvert(!ouvert); }}
          className="w-full rounded-xl border-[1.5px] border-dashed border-navy bg-fond py-3.5 text-sm font-semibold text-navy transition-colors hover:bg-navy-soft">
          {ouvert ? t.commun.annuler : (
            <span className="inline-flex items-center justify-center gap-2">
              <Icone nom="nouvelleDemande" taille={16} />{t.serviceMer.declarer}
            </span>
          )}
        </button>

        {ouvert && (
          <Card className="space-y-4">
            <InputField label={t.serviceMer.navire} value={formulaire.vesselName}
              erreur={erreursChamps.vesselName}
              onChange={function (e) { setFormulaire({ ...formulaire, vesselName: e.target.value }); }} obligatoire />
            <div className="grid grid-cols-2 gap-3">
              {/* Le format attendu est annoncé avant l'envoi : le serveur
                  exige sept chiffres, inutile de le faire découvrir par un refus. */}
              <InputField label={t.serviceMer.imo} inputMode="numeric" maxLength={7}
                aide={t.serviceMer.imoAide} erreur={erreursChamps.imoNumber}
                value={formulaire.imoNumber}
                onChange={function (e) { setFormulaire({ ...formulaire, imoNumber: e.target.value }); }} />
              <InputField label={t.serviceMer.pavillon} value={formulaire.flag}
                erreur={erreursChamps.flag}
                onChange={function (e) { setFormulaire({ ...formulaire, flag: e.target.value }); }} />
            </div>
            <SelectField label={t.serviceMer.fonction} value={formulaire.fonctionId}
              erreur={erreursChamps.fonctionId}
              onChange={function (e) { setFormulaire({ ...formulaire, fonctionId: e.target.value }); }}>
              <option value="">—</option>
              {fonctions?.map(function (f) { return <option key={f.id} value={f.id}>{f.label}</option>; })}
            </SelectField>
            <div className="grid grid-cols-2 gap-3">
              <InputField label={t.serviceMer.debut} type="date" value={formulaire.startDate}
                erreur={erreursChamps.startDate}
                onChange={function (e) { setFormulaire({ ...formulaire, startDate: e.target.value }); }} obligatoire />
              <InputField label={t.serviceMer.fin} type="date" value={formulaire.endDate}
                erreur={erreursChamps.endDate}
                onChange={function (e) { setFormulaire({ ...formulaire, endDate: e.target.value }); }} obligatoire />
            </div>
            {dureeApercu !== null && (
              <p className="text-sm font-medium text-navy">
                {t.serviceMer.dureeCalculee} : {dureeApercu} {t.commun.jours}
              </p>
            )}
            <Alerte ton="info">{t.serviceMer.declarationAide}</Alerte>
            <Button pleineLargeur chargement={envoi}
              disabled={!formulaire.vesselName || !formulaire.startDate || !formulaire.endDate}
              onClick={declarer}>
              {t.commun.enregistrer}
            </Button>
          </Card>
        )}

        {dossier.embarquements.length === 0 ? <EtatVide message={t.serviceMer.aucun} /> : (
          parAnnee.map(function afficherAnnee([annee, embarquements]) {
            return (
              <section key={annee}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-[1.5px] text-navy">{annee}</span>
                  <span className="h-px flex-1 bg-bordure" />
                </div>
                <div className="space-y-5">
                  {embarquements.map(function afficherEmbarquement(embarquement) {
                    const verifie = embarquement.status === "VERIFIED";
                    const rejete = embarquement.status === "REJECTED";
                    const filet = verifie ? "border-teal-sea" : rejete ? "border-erreur" : "border-orange-ci";
                    const couleurJours = verifie ? "text-teal-sea" : rejete ? "text-erreur" : "text-orange-ci";

                    return (
                      <div key={embarquement.id} className={`border-l-[3px] ${filet} pl-4`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-titre text-base font-bold text-navy">{embarquement.vesselName}</p>
                            <p className="mt-0.5 text-xs text-ardoise">
                              {embarquement.imoNumber ? `IMO ${embarquement.imoNumber}` : ""}
                              {embarquement.imoNumber && embarquement.vesselType ? ", " : ""}
                              {embarquement.vesselType ?? ""}
                            </p>
                          </div>
                          <BadgeStatut statut={embarquement.status} libelle={libelle(t.serviceMer.statut, embarquement.status)} />
                        </div>

                        <div className="mt-2.5 flex gap-6">
                          <ColonneInfo libelle={t.serviceMer.fonction} valeur={embarquement.fonction ? embarquement.fonction.code : "—"} />
                          <ColonneInfo libelle={t.serviceMer.periode} valeur={`${jourEtMois(embarquement.startDate)} → ${jourEtMois(embarquement.endDate)}`} />
                          <ColonneInfo libelle={t.serviceMer.joursColonne} valeur={embarquement.days} couleur={couleurJours} />
                        </div>

                        {verifie && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <Icone nom="verifie" taille={13} className="shrink-0 text-teal-sea" />
                            <span className="text-[11px] font-medium text-teal-sea">{t.serviceMer.verifiePar}</span>
                          </div>
                        )}

                        {/* Un mouvement vérifié est opposable : son QR se
                            présente au contrôle à la place du livret (R26). */}
                        {verifie && (
                          qrOuvert === embarquement.id ? (
                            <QrPrestation
                              chemin={`/api/sea-service/me/${embarquement.id}/qr`}
                              instruction={t.serviceMer.qr.instruction}
                              onFermer={function () { setQrOuvert(null); }}
                            />
                          ) : (
                            <Button variante="discret" taille="sm" className="mt-2"
                              onClick={function () { setQrOuvert(embarquement.id); }}>
                              {t.serviceMer.qr.afficher}
                            </Button>
                          )
                        )}

                        {embarquement.rejectReason && (
                          <p className="mt-2 text-xs font-medium text-erreur">
                            {t.serviceMer.dossierRejete} {embarquement.rejectReason}
                          </p>
                        )}

                        {/* Sans pièce justificative, les jours ne comptent pas
                            (R4) : le dossier se constitue sur la ligne concernée. */}
                        {!verifie && (
                          <DossierJustificatifs
                            embarquement={embarquement}
                            montantValidation={fraisValidation?.amount ?? 0}
                            deviseValidation={fraisValidation?.currency ?? ""}
                            surChangement={rafraichir}
                          />
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