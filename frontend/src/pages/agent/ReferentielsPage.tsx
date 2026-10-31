// ============================================
// pages/agent/ReferentielsPage.tsx
// Consultation des référentiels administrables.
//
// L'écran expose ce qui pilote réellement le système : durées de validité,
// formations requises, barèmes. Un administrateur métier doit pouvoir les
// vérifier sans ouvrir la base.
// ============================================
import { useEffect, useState } from "react";
import { t } from "../../i18n/index.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { Badge } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { ChargementPage } from "../../components/atoms/Feedback.js";
import { EnteteAgent } from "../../components/layouts/EnteteAgent.js";
import { FormulaireBareme } from "../../components/molecules/FormulaireBareme.js";
import { libelleBareme, natureBareme } from "../../lib/baremes.js";
import { montant } from "../../lib/format.js";
import type { Bareme } from "../../types/api.js";

export function ReferentielsPage() {
  const { fonctions, certificats, baremes, charge, charger, enregistrerBareme } =
    useReferentielStore();

  // Formulaire de tarif ouvert. Null signifie fermé, un objet sans barème
  // signifie création, un objet avec barème signifie modification.
  const [formulaire, setFormulaire] = useState<{ bareme?: Bareme } | null>(null);

  useEffect(() => {
    void charger();
  }, [charger]);

  function fermerFormulaire() {
    setFormulaire(null);
  }

  if (!charge) return <ChargementPage />;

  return (
    <div>
      <EnteteAgent
        titre={t.referentiels.titre}
        sousTitre={t.referentiels.sousTitre}
        icone="referentiels"
      />

      <div className="space-y-6">

      <section>
        <h2 className="mb-2 text-sm font-semibold text-navy">{t.referentiels.certificats}</h2>
        <div className="space-y-2">
          {certificats?.map((certificat) => (
            <Card key={certificat.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">{certificat.label}</p>
                  <p className="matricule mt-0.5 text-xs text-ardoise">{certificat.code}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {certificat.validityMonths && (
                    <span className="text-xs text-ardoise">
                      {t.referentiels.validite} : {certificat.validityMonths}{" "}
                      {t.referentiels.mois}
                    </span>
                  )}
                  {certificat.requiresTraining && (
                    <Badge ton="alerte">{t.referentiels.formationRequise}</Badge>
                  )}
                </div>
              </div>

              {/* Les prérequis alimentent le moteur de conformité : les voir
                  ici évite d'avoir à deviner pourquoi un marin est bloqué. */}
              {certificat.requirementsFor && certificat.requirementsFor.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-bordure pt-2">
                  {certificat.requirementsFor.map((prerequis) => (
                    <li key={prerequis.id} className="text-xs text-ardoise">
                      {prerequis.label}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-navy">{t.referentiels.baremes}</h2>
          {/* Le bouton disparaît pendant la saisie : un seul formulaire à
              la fois évite deux tarifs édités en parallèle. */}
          {!formulaire && (
            <Button
              taille="sm"
              variante="discret"
              onClick={function () {
                setFormulaire({});
              }}
            >
              {t.referentiels.ajouterTarif}
            </Button>
          )}
        </div>

        {formulaire && (
          <div className="mb-3">
            <FormulaireBareme
              certificats={certificats ?? []}
              bareme={formulaire.bareme}
              onEnregistrer={enregistrerBareme}
              onFermer={fermerFormulaire}
            />
          </div>
        )}

        {baremes && baremes.length > 0 ? (
          <Card className="divide-y divide-bordure p-0">
            {baremes.map((bareme) => (
              <div
                key={bareme.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-navy">
                    {libelleBareme(bareme, certificats ?? [])}
                  </p>
                  <p className="text-xs text-ardoise">{natureBareme(bareme)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-semibold text-orange-ci">
                    {montant(bareme.amount, bareme.currency)}
                  </span>
                  <Button
                    taille="sm"
                    variante="discret"
                    onClick={function () {
                      setFormulaire({ bareme });
                    }}
                  >
                    {t.referentiels.modifier}
                  </Button>
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <EtatVide message={t.referentiels.aucunBareme} />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-navy">{t.referentiels.fonctions}</h2>
        <Card className="flex flex-wrap gap-2">
          {fonctions?.map((fonction) => (
            <Badge key={fonction.id}>{fonction.label}</Badge>
          ))}
        </Card>
      </section>
    </div>
    </div>
  );
}