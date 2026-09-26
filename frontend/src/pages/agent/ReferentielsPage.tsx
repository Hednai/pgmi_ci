// ============================================
// pages/agent/ReferentielsPage.tsx
// Consultation des référentiels administrables.
//
// L'écran expose ce qui pilote réellement le système : durées de validité,
// formations requises, barèmes. Un administrateur métier doit pouvoir les
// vérifier sans ouvrir la base.
// ============================================
import { useEffect } from "react";
import { t } from "../../i18n/index.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card, SectionTitre } from "../../components/atoms/Card.js";
import { Badge } from "../../components/atoms/Badge.js";
import { ChargementPage } from "../../components/atoms/Feedback.js";
import { montant } from "../../lib/format.js";

export const ReferentielsPage = () => {
  const { fonctions, certificats, baremes, charge, charger } = useReferentielStore();

  useEffect(() => {
    void charger();
  }, [charger]);

  if (!charge) return <ChargementPage />;

  return (
    <div className="space-y-6">
      <SectionTitre titre={t.referentiels.titre} />

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
        <h2 className="mb-2 text-sm font-semibold text-navy">{t.referentiels.baremes}</h2>
        <Card className="divide-y divide-bordure p-0">
          {baremes?.map((bareme) => {
            const certificat = certificats?.find(
              (valeur) => valeur.id === bareme.certificateTypeId,
            );
            return (
              <div key={bareme.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm text-navy">{certificat?.label ?? "—"}</p>
                  <p className="text-xs text-ardoise">{bareme.requestType}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-orange-ci">
                  {montant(bareme.amount, bareme.currency)}
                </span>
              </div>
            );
          })}
        </Card>
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
  );
};
