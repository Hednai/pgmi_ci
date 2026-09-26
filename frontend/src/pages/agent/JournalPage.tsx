// ============================================
// pages/agent/JournalPage.tsx
// Consultation du journal d'audit.
//
// Lecture seule : aucune action de cet écran ne peut modifier une entrée,
// conformément à l'invariant R5.
// ============================================
import { useEffect, useState } from "react";
import { t } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { Card, EtatVide, SectionTitre } from "../../components/atoms/Card.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { dateCourte } from "../../lib/format.js";
import type { EntreeJournal, Pagine } from "../../types/api.js";

export const JournalPage = () => {
  const [resultat, setResultat] = useState<Pagine<EntreeJournal> | null>(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    api
      .get<Pagine<EntreeJournal>>("/api/audit?taille=50")
      .then(setResultat)
      .catch(() => setErreur(t.commun.erreurReseau));
  }, []);

  if (erreur) return <Alerte ton="erreur">{erreur}</Alerte>;
  if (!resultat) return <ChargementPage />;

  return (
    <div className="space-y-4">
      <div>
        <SectionTitre titre={t.journal.titre} />
        <p className="-mt-2 text-sm text-ardoise">{t.journal.sousTitre}</p>
      </div>

      {resultat.items.length === 0 ? (
        <EtatVide message={t.commun.aucunResultat} />
      ) : (
        <Card className="divide-y divide-bordure p-0">
          {resultat.items.map((entree) => (
            <div key={entree.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">{entree.action}</p>
                  <p className="mt-0.5 text-xs text-ardoise">
                    {entree.actorLabel ?? entree.actorType}
                    {entree.targetType ? ` · ${entree.targetType}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ardoise">
                  {dateCourte(entree.createdAt)}
                </span>
              </div>

              {entree.metadata && (
                <p className="mt-1 truncate text-[11px] text-ardoise/80">
                  {JSON.stringify(entree.metadata)}
                </p>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};
