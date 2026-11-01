// ============================================
// pages/marin/RelevePage.tsx
// Relevé de navigation : éditions passées et nouvelle édition.
//
// Le marin voit d'abord ce qu'une édition retiendrait, mouvement par
// mouvement, et le total de jours. Il décide ensuite, en connaissance du
// contenu et du prix. Un relevé déjà édité reste consultable : il n'expire
// pas (R24).
//
// Aucun montant n'est écrit ici : le tarif vient du serveur, qui le lit
// dans la grille administrable.
// ============================================
import { useCallback, useEffect, useState } from "react";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { Button } from "../../components/atoms/Button.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { EnteteEcran, TuileChiffre } from "../../components/layouts/EnteteEcran.js";
import { ReglementPrestation } from "../../components/molecules/ReglementPrestation.js";
import { QrPrestation } from "../../components/molecules/QrPrestation.js";
import { dateCourte, montant as formaterMontant } from "../../lib/format.js";
import type { DossierReleves } from "../../types/api.js";

// Un relevé non délivré attend son règlement.
const EN_ATTENTE = "AWAITING_PAYMENT";

export function RelevePage() {
  const [dossier, setDossier] = useState<DossierReleves | null>(null);
  const [erreur, setErreur] = useState("");
  const [ouverture, setOuverture] = useState(false);
  const [qrOuvert, setQrOuvert] = useState<string | null>(null);

  const rafraichir = useCallback(function () {
    return api
      .get<DossierReleves>("/api/releves/me")
      .then(setDossier)
      .catch(function () {
        setErreur(t.commun.erreurReseau);
      });
  }, []);

  useEffect(
    function chargerDossier() {
      void rafraichir();
    },
    [rafraichir],
  );

  // Ouvrir une édition fige son contenu. Le règlement se fait ensuite sur
  // la ligne créée, qui apparaît en tête de l'historique.
  async function demanderEdition() {
    setErreur("");
    setOuverture(true);
    try {
      await api.post("/api/releves/me");
      await rafraichir();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setOuverture(false);
    }
  }

  if (!dossier) return <ChargementPage />;

  const aucunMouvement = dossier.disponibles.length === 0;
  const tarif = dossier.tarif;

  return (
    <div>
      <EnteteEcran titre={t.releve.titre}>
        <div className="flex gap-3">
          <TuileChiffre valeur={dossier.totalJours} libelle={t.releve.joursVerifies} />
          <TuileChiffre valeur={dossier.disponibles.length} libelle={t.releve.mouvementsRetenus} />
          <TuileChiffre valeur={dossier.releves.length} libelle={t.releve.editions} accentue />
        </div>
      </EnteteEcran>

      <div className="space-y-4">
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {/* Ce qu'une édition faite maintenant retiendrait */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-navy">{t.releve.contenu}</h2>

          {aucunMouvement ? (
            <EtatVide message={t.releve.aucunMouvement} />
          ) : (
            <Card className="space-y-3">
              <ul className="divide-y divide-bordure">
                {dossier.disponibles.map(function afficherMouvement(mouvement) {
                  return (
                    <li key={mouvement.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy">
                          {mouvement.vesselName}
                        </p>
                        <p className="text-[11px] text-ardoise">
                          {dateCourte(mouvement.startDate)} au {dateCourte(mouvement.endDate)}
                          {mouvement.fonction ? `, ${mouvement.fonction}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-teal-sea">
                        {mouvement.days} {t.commun.jours}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="flex items-baseline justify-between border-t border-bordure pt-2">
                <span className="text-sm text-ardoise">{t.releve.totalJours}</span>
                <span className="font-titre text-xl font-bold text-navy">
                  {dossier.totalJours} {t.commun.jours}
                </span>
              </div>

              <p className="text-[11px] leading-relaxed text-ardoise">
                {tarif.montant > 0
                  ? `${t.releve.tarifEdition} ${formaterMontant(tarif.montant, tarif.devise)}. ${t.releve.chaqueEditionPayante}`
                  : t.releve.editionGratuite}
              </p>

              <Button pleineLargeur chargement={ouverture} onClick={demanderEdition}>
                {t.releve.demander}
              </Button>
            </Card>
          )}
        </section>

        {/* Éditions déjà demandées */}
        <section>
          <h2 className="mb-2 text-sm font-semibold text-navy">{t.releve.historique}</h2>

          {dossier.releves.length === 0 ? (
            <EtatVide message={t.releve.aucuneEdition} />
          ) : (
            <div className="space-y-3">
              {dossier.releves.map(function afficherReleve(releve) {
                const enAttente = releve.status === EN_ATTENTE;

                return (
                  <Card key={releve.id} className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="matricule text-sm font-semibold text-navy">
                          {releve.reference}
                        </p>
                        <p className="text-[11px] text-ardoise">
                          {enAttente
                            ? t.releve.statutAttente
                            : `${t.releve.delivreLe} ${dateCourte(releve.issuedAt)}`}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-teal-sea">
                        {releve.totalDays} {t.commun.jours}
                      </span>
                    </div>

                    <p className="text-[11px] text-ardoise">
                      {releve.entries.length} {t.releve.embarquementsRetenus}
                    </p>

                    {enAttente ? (
                      <ReglementPrestation
                        chemin={`/api/releves/me/${releve.id}/paiement`}
                        montantDu={tarif.montant}
                        devise={tarif.devise}
                        intitule={t.releve.fraisEdition}
                        note={t.releve.chaqueEditionPayante}
                        libelleBouton={t.releve.payerEtEditer}
                        surReglement={rafraichir}
                      />
                    ) : qrOuvert === releve.id ? (
                      <QrPrestation
                        chemin={`/api/releves/me/${releve.id}/qr`}
                        instruction={t.releve.qrInstruction}
                        onFermer={function () { setQrOuvert(null); }}
                      />
                    ) : (
                      <Button
                        variante="discret"
                        taille="sm"
                        onClick={function () { setQrOuvert(releve.id); }}
                      >
                        {t.releve.afficherQr}
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}