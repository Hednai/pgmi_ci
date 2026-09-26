// ============================================
// pages/marin/ConformitePage.tsx
// Checklist de conformité par brevet.
//
// L'avertissement du moteur est affiché tel qu'il vient du serveur : le
// marin doit savoir que cette page informe et ne décide pas (R13).
// ============================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t, libelle } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { Card, EtatVide, SectionTitre } from "../../components/atoms/Card.js";
import { Badge, tonDuStatut } from "../../components/atoms/Badge.js";
import { Progression, Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { Button } from "../../components/atoms/Button.js";
import { dateCourte } from "../../lib/format.js";
import type { RapportConformite } from "../../types/api.js";

export const ConformitePage = () => {
  const [rapports, setRapports] = useState<RapportConformite[] | null>(null);
  const [erreur, setErreur] = useState("");
  const naviguer = useNavigate();

  useEffect(() => {
    api
      .get<RapportConformite[]>("/api/conformite/me")
      .then(setRapports)
      .catch(() => setErreur(t.commun.erreurReseau));
  }, []);

  if (erreur) return <Alerte ton="erreur">{erreur}</Alerte>;
  if (!rapports) return <ChargementPage />;
  if (rapports.length === 0) return <EtatVide message={t.conformite.aucune} />;

  return (
    <div className="space-y-4">
      <SectionTitre titre={t.conformite.titre} />
      <p className="-mt-2 text-sm text-ardoise">{t.conformite.sousTitre}</p>

      {rapports.map((rapport) => (
        <Card key={rapport.certificat.id} className="space-y-4">
          <div>
            <p className="font-titre text-sm font-semibold text-navy">
              {rapport.certificat.label}
            </p>
            <p className="mt-0.5 text-xs text-ardoise">
              {rapport.satisfaits} {t.commun.sur} {rapport.total} {t.conformite.prerequis}
            </p>
          </div>

          <Progression valeur={rapport.progression} etiquette={t.conformite.progression} />

          <ul className="space-y-2">
            {rapport.prerequis.map((ligne, index) => (
              <li
                key={`${rapport.certificat.id}-${index}`}
                className="flex items-start justify-between gap-3 border-b border-bordure pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-sm text-navy">{ligne.label}</p>

                  {/* Prérequis de service en mer : la progression chiffrée
                      est plus parlante qu'un simple statut. */}
                  {ligne.type === "SEA_SERVICE" && (
                    <p className="mt-0.5 text-xs text-ardoise">
                      {ligne.joursAcquis} / {ligne.joursRequis} {t.conformite.joursMer}
                    </p>
                  )}

                  {ligne.expireLe && (
                    <p className="mt-0.5 text-xs text-ardoise">
                      {t.documents.expireLe} {dateCourte(ligne.expireLe)}
                    </p>
                  )}

                  {ligne.formationRequise &&
                    (ligne.etat === "MANQUANT" || ligne.etat === "EXPIRE") && (
                      <button
                        type="button"
                        onClick={() => naviguer("/formations")}
                        className="mt-1 text-xs font-medium text-navy-light hover:underline"
                      >
                        {t.conformite.sInscrire}
                      </button>
                    )}
                </div>

                <Badge ton={tonDuStatut(ligne.etat)}>{libelle(t.conformite.etat, ligne.etat)}</Badge>
              </li>
            ))}
          </ul>

          {rapport.eligible ? (
            <Alerte ton="succes">{t.conformite.eligible}</Alerte>
          ) : (
            <Alerte ton="alerte">{t.conformite.nonEligible}</Alerte>
          )}

          <p className="text-[11px] leading-relaxed text-ardoise">{rapport.avertissement}</p>

          {rapport.eligible && (
            <Button
              pleineLargeur
              variante="discret"
              onClick={() =>
                naviguer("/demandes/nouvelle", {
                  state: { certificateTypeId: rapport.certificat.id },
                })
              }
            >
              {t.demandes.nouvelle}
            </Button>
          )}
        </Card>
      ))}
    </div>
  );
};
