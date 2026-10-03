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
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { Icone } from "../../components/atoms/Icone.js";
import type { NomIcone } from "../../components/atoms/Icone.js";
import { EnteteAgent } from "../../components/layouts/EnteteAgent.js";
import { dateCourte } from "../../lib/format.js";
import type { EntreeJournal, Pagine } from "../../types/api.js";

// Icône et couleur associées à chaque famille d'action tracée.
const APPARENCE_ACTION: Record<string, { icone: NomIcone; teinte: string }> = {
  DOCUMENT_VERIFIED: { icone: "verifie", teinte: "bg-succes-soft text-teal-sea" },
  EMBARKATION_VERIFIED: { icone: "verifie", teinte: "bg-succes-soft text-teal-sea" },
  REQUEST_APPROVED: { icone: "valide", teinte: "bg-succes-soft text-succes" },
  MARIN_ACTIVATED: { icone: "marins", teinte: "bg-succes-soft text-succes" },
  DOCUMENT_REJECTED: { icone: "manquant", teinte: "bg-erreur-soft text-erreur" },
  REQUEST_REJECTED: { icone: "manquant", teinte: "bg-erreur-soft text-erreur" },
  INFO_REQUESTED: { icone: "alerte", teinte: "bg-alerte-soft text-orange-ci" },
  PAYMENT_COLLECTED: { icone: "paiement", teinte: "bg-navy-soft text-navy-light" },
  NOTIFICATION_SENT: { icone: "notifications", teinte: "bg-navy-soft text-navy-light" },
};

function apparenceAction(action: string) {
  return APPARENCE_ACTION[action] ?? { icone: "journal" as NomIcone, teinte: "bg-fond text-ardoise" };
}

export function JournalPage() {
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
    <div>
      <EnteteAgent
        titre={t.journal.titre}
        sousTitre={`${resultat.total} ${t.agent.actionsTracees}`}
        icone="journal"
      />

      <div className="space-y-4">
        {/* Rappel de l'invariant R5 : ce registre ne se modifie pas */}
        <Alerte ton="info">{t.journal.sousTitre}</Alerte>

        {resultat.items.length === 0 ? (
          <EtatVide message={t.commun.aucunResultat} />
        ) : (
          <Card className="divide-y divide-bordure p-0">
            {resultat.items.map(function afficherEntree(entree) {
              const apparence = apparenceAction(entree.action);

              return (
                <div key={entree.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${apparence.teinte}`}
                  >
                    <Icone nom={apparence.icone} taille={16} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-navy">
                        {t.journal.actions[entree.action] ?? entree.action}
                      </p>
                      <span className="shrink-0 text-xs text-ardoise">
                        {dateCourte(entree.createdAt)}
                      </span>
                    </div>

                    <p className="mt-0.5 truncate text-xs text-ardoise">
                      {entree.actorLabel ?? entree.actorType}
                      {entree.targetType ? `, ${entree.targetType}` : ""}
                    </p>

                    {/* Les métadonnées portent le motif d'une décision : elles
                        sont ce qui rend le registre opposable lors d'un contrôle. */}
                    {entree.metadata && (
                      <p className="matricule mt-1 truncate text-[11px] text-ardoise/80">
                        {Object.entries(entree.metadata)
                          .map(function ([cle, valeur]) {
                            return `${cle} : ${String(valeur)}`;
                          })
                          .join(", ")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
