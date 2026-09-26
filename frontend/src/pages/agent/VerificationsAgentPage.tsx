// ============================================
// pages/agent/VerificationsAgentPage.tsx
// Files de contrôle : documents déposés et embarquements déclarés.
//
// Les deux files sont réunies sur un seul écran : c'est le même geste métier,
// contrôler une pièce et décider si elle fait foi.
// ============================================
import { useEffect, useState } from "react";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Card, EtatVide, SectionTitre } from "../../components/atoms/Card.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { dateCourte } from "../../lib/format.js";
import type { DocumentMaritime, Embarquement, Pagine } from "../../types/api.js";

type Onglet = "documents" | "embarquements";

export const VerificationsAgentPage = () => {
  const [onglet, setOnglet] = useState<Onglet>("documents");
  const [documents, setDocuments] = useState<Pagine<DocumentMaritime> | null>(null);
  const [embarquements, setEmbarquements] = useState<Pagine<Embarquement> | null>(null);
  const [methode, setMethode] = useState("");
  const [erreur, setErreur] = useState("");
  const [action, setAction] = useState<string | null>(null);

  const charger = async () => {
    const [listeDocuments, listeEmbarquements] = await Promise.all([
      api.get<Pagine<DocumentMaritime>>("/api/documents/a-verifier"),
      api.get<Pagine<Embarquement>>("/api/sea-service/a-verifier"),
    ]);
    setDocuments(listeDocuments);
    setEmbarquements(listeEmbarquements);
  };

  useEffect(() => {
    charger().catch(() => setErreur(t.commun.erreurReseau));
  }, []);

  const agir = async (chemin: string, identifiant: string, corps?: unknown) => {
    setErreur("");
    setAction(identifiant);
    try {
      await api.post(chemin, corps);
      setMethode("");
      await charger();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setAction(null);
    }
  };

  if (!documents || !embarquements) return <ChargementPage />;

  return (
    <div className="space-y-4">
      <SectionTitre titre={t.navigation.verifications} />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOnglet("documents")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${onglet === "documents" ? "bg-navy text-white" : "bg-white text-ardoise"}`}
        >
          {t.navigation.documents} ({documents.total})
        </button>
        <button
          type="button"
          onClick={() => setOnglet("embarquements")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${onglet === "embarquements" ? "bg-navy text-white" : "bg-white text-ardoise"}`}
        >
          {t.navigation.serviceMer} ({embarquements.total})
        </button>
      </div>

      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      {onglet === "documents" &&
        (documents.items.length === 0 ? (
          <EtatVide message={t.commun.aucunResultat} />
        ) : (
          <div className="space-y-2">
            {/* La méthode de contrôle est saisie une fois et s'applique à la
                validation suivante : l'agent enchaîne les dossiers. */}
            <InputField
              label={t.agent.methodeVerification}
              aide={t.agent.methodeAide}
              value={methode}
              onChange={(evenement) => setMethode(evenement.target.value)}
            />

            {documents.items.map((document) => (
              <Card key={document.id} className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-navy">
                    {document.certificateType.label}
                  </p>
                  <p className="mt-0.5 text-xs text-ardoise">
                    {document.marin?.fullName} · {document.marin?.matricule ?? ""}
                  </p>
                  <p className="matricule mt-0.5 text-xs text-ardoise">
                    {document.number ?? "—"} · {dateCourte(document.expiryDate)}
                  </p>
                </div>

                {document.fileUrl && (
                  <a
                    href={document.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-navy-light hover:underline"
                  >
                    {t.documents.fichier}
                  </a>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variante="succes"
                    taille="sm"
                    chargement={action === document.id}
                    disabled={methode.trim().length < 3}
                    onClick={() =>
                      agir(`/api/documents/${document.id}/verification`, document.id, { methode })
                    }
                  >
                    {t.agent.verifier}
                  </Button>
                  <Button
                    variante="danger"
                    taille="sm"
                    chargement={action === document.id}
                    disabled={methode.trim().length < 5}
                    onClick={() =>
                      agir(`/api/documents/${document.id}/rejet`, document.id, { reason: methode })
                    }
                  >
                    {t.agent.rejeter}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ))}

      {onglet === "embarquements" &&
        (embarquements.items.length === 0 ? (
          <EtatVide message={t.commun.aucunResultat} />
        ) : (
          <div className="space-y-2">
            <InputField
              label={t.agent.motifRejet}
              aide={t.agent.motifObligatoire}
              value={methode}
              onChange={(evenement) => setMethode(evenement.target.value)}
            />

            {embarquements.items.map((embarquement) => (
              <Card key={embarquement.id} className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-navy">{embarquement.vesselName}</p>
                  <p className="mt-0.5 text-xs text-ardoise">
                    {embarquement.marin?.fullName} · {embarquement.marin?.matricule ?? ""}
                  </p>
                  <p className="mt-0.5 text-xs text-ardoise">
                    {dateCourte(embarquement.startDate)} → {dateCourte(embarquement.endDate)} ·{" "}
                    {embarquement.days} {t.commun.jours}
                  </p>
                </div>

                {embarquement.proofUrl && (
                  <a
                    href={embarquement.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-navy-light hover:underline"
                  >
                    {t.serviceMer.joindrePreuve}
                  </a>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variante="succes"
                    taille="sm"
                    chargement={action === embarquement.id}
                    onClick={() =>
                      agir(`/api/sea-service/${embarquement.id}/verification`, embarquement.id)
                    }
                  >
                    {t.agent.verifier}
                  </Button>
                  <Button
                    variante="danger"
                    taille="sm"
                    chargement={action === embarquement.id}
                    disabled={methode.trim().length < 5}
                    onClick={() =>
                      agir(`/api/sea-service/${embarquement.id}/rejet`, embarquement.id, {
                        reason: methode,
                      })
                    }
                  >
                    {t.agent.rejeter}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ))}
    </div>
  );
};
