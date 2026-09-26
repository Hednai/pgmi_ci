// ============================================
// pages/marin/ServiceMerPage.tsx
// Sea Service Record : déclaration des embarquements et preuves.
//
// La durée est affichée en direct pendant la saisie, mais c'est le serveur
// qui la recalcule : l'affichage aide, il ne fait pas foi (R4).
// ============================================
import { useEffect, useMemo, useState } from "react";
import { t, libelle } from "../../i18n/index.js";
import { api, lireFichier, ErreurApi } from "../../lib/apiClient.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card, SectionTitre, EtatVide } from "../../components/atoms/Card.js";
import { StatCard } from "../../components/molecules/StatCard.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField, SelectField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { dateCourte } from "../../lib/format.js";
import type { DossierServiceMer } from "../../types/api.js";

const MS_JOUR = 24 * 60 * 60 * 1000;

export const ServiceMerPage = () => {
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

  const rafraichir = () =>
    api
      .get<DossierServiceMer>("/api/sea-service/me")
      .then(setDossier)
      .catch(() => setErreur(t.commun.erreurReseau));

  useEffect(() => {
    void charger();
    void rafraichir();
  }, [charger]);

  // Aperçu de la durée, jour d'embarquement et de débarquement compris
  const dureeApercu = useMemo(() => {
    if (!formulaire.startDate || !formulaire.endDate) return null;
    const debut = new Date(formulaire.startDate).getTime();
    const fin = new Date(formulaire.endDate).getTime();
    if (Number.isNaN(debut) || Number.isNaN(fin) || fin < debut) return null;
    return Math.round((fin - debut) / MS_JOUR) + 1;
  }, [formulaire.startDate, formulaire.endDate]);

  const declarer = async () => {
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
  };

  const joindrePreuve = async (embarquementId: string, fichier: File) => {
    setErreur("");
    try {
      await api.post(`/api/sea-service/me/${embarquementId}/preuve`, {
        fichier: await lireFichier(fichier),
      });
      await rafraichir();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    }
  };

  if (!dossier) return <ChargementPage />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          valeur={dossier.totaux.joursVerifies}
          libelle={t.serviceMer.totalVerifie}
          ton="succes"
        />
        <StatCard
          valeur={dossier.totaux.joursEnAttente}
          libelle={t.serviceMer.totalAttente}
          ton="alerte"
        />
      </div>

      <SectionTitre
        titre={t.serviceMer.titre}
        action={
          <Button taille="sm" onClick={() => setOuvert((valeur) => !valeur)}>
            {ouvert ? t.commun.annuler : t.serviceMer.declarer}
          </Button>
        }
      />

      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      {ouvert && (
        <Card className="space-y-4">
          <InputField
            label={t.serviceMer.navire}
            value={formulaire.vesselName}
            onChange={(evenement) =>
              setFormulaire((precedent) => ({ ...precedent, vesselName: evenement.target.value }))
            }
            obligatoire
          />

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label={t.serviceMer.imo}
              inputMode="numeric"
              value={formulaire.imoNumber}
              onChange={(evenement) =>
                setFormulaire((precedent) => ({ ...precedent, imoNumber: evenement.target.value }))
              }
            />
            <InputField
              label={t.serviceMer.pavillon}
              value={formulaire.flag}
              onChange={(evenement) =>
                setFormulaire((precedent) => ({ ...precedent, flag: evenement.target.value }))
              }
            />
          </div>

          <SelectField
            label={t.serviceMer.fonction}
            value={formulaire.fonctionId}
            onChange={(evenement) =>
              setFormulaire((precedent) => ({ ...precedent, fonctionId: evenement.target.value }))
            }
          >
            <option value="">—</option>
            {fonctions?.map((fonction) => (
              <option key={fonction.id} value={fonction.id}>
                {fonction.label}
              </option>
            ))}
          </SelectField>

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label={t.serviceMer.debut}
              type="date"
              value={formulaire.startDate}
              onChange={(evenement) =>
                setFormulaire((precedent) => ({ ...precedent, startDate: evenement.target.value }))
              }
              obligatoire
            />
            <InputField
              label={t.serviceMer.fin}
              type="date"
              value={formulaire.endDate}
              onChange={(evenement) =>
                setFormulaire((precedent) => ({ ...precedent, endDate: evenement.target.value }))
              }
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
        <div className="space-y-2">
          {dossier.embarquements.map((embarquement) => (
            <Card key={embarquement.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">
                    {embarquement.vesselName}
                  </p>
                  <p className="mt-0.5 text-xs text-ardoise">
                    {dateCourte(embarquement.startDate)} → {dateCourte(embarquement.endDate)}
                  </p>
                </div>
                <BadgeStatut
                  statut={embarquement.status}
                  libelle={libelle(t.serviceMer.statut, embarquement.status)}
                />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-navy">
                  {embarquement.days} {t.commun.jours}
                </span>
                {embarquement.fonction && (
                  <span className="text-xs text-ardoise">{embarquement.fonction.label}</span>
                )}
              </div>

              {embarquement.rejectReason && (
                <p className="mt-2 text-xs font-medium text-erreur">
                  {embarquement.rejectReason}
                </p>
              )}

              {/* Sans preuve, les jours ne comptent pas : le dépôt est
                  proposé directement sur la ligne concernée. */}
              {!embarquement.proofUrl && embarquement.status !== "VERIFIED" && (
                <label className="mt-3 block">
                  <span className="text-xs font-medium text-navy-light">
                    {t.serviceMer.joindrePreuve}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="mt-1 block w-full text-xs text-ardoise"
                    onChange={(evenement) => {
                      const fichier = evenement.target.files?.[0];
                      if (fichier) void joindrePreuve(embarquement.id, fichier);
                    }}
                  />
                </label>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
