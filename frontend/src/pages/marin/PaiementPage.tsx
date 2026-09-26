// ============================================
// pages/marin/PaiementPage.tsx
// Règlement des frais de dossier.
//
// Le montant affiché vient de la demande enregistrée côté serveur, jamais
// d'un calcul local : c'est ce qui sera réellement débité.
// ============================================
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { t, libelle } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Card } from "../../components/atoms/Card.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { montant } from "../../lib/format.js";
import type { Demande } from "../../types/api.js";

interface MoyensPaiement {
  canaux: string[];
  operateurs: string[];
  modeBacASable: boolean;
  guichet: string;
}

export const PaiementPage = () => {
  const { id } = useParams();
  const naviguer = useNavigate();

  const [demande, setDemande] = useState<Demande | null>(null);
  const [moyens, setMoyens] = useState<MoyensPaiement | null>(null);
  const [operateur, setOperateur] = useState("");
  const [numero, setNumero] = useState("");
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Demande[]>("/api/demandes/me"),
      api.get<MoyensPaiement>("/api/demandes/moyens-paiement"),
    ])
      .then(([demandes, moyensPaiement]) => {
        setDemande(demandes.find((valeur) => valeur.id === id) ?? null);
        setMoyens(moyensPaiement);
      })
      .catch(() => setErreur(t.commun.erreurReseau));
  }, [id]);

  const payer = async () => {
    setErreur("");
    setEnvoi(true);
    try {
      await api.post(`/api/demandes/me/${id}/paiement`, {
        canal: "MOBILE_MONEY",
        operateur,
        telephonePayeur: numero || undefined,
      });
      setSucces(true);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setEnvoi(false);
    }
  };

  if (!demande || !moyens) return <ChargementPage />;

  if (succes) {
    return (
      <Card className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-succes-soft text-2xl text-succes">
          ✓
        </div>
        <div>
          <p className="font-titre text-base font-semibold text-navy">{t.paiement.succes}</p>
          <p className="mt-1 text-sm text-ardoise">{t.paiement.succesDetail}</p>
        </div>
        <Button pleineLargeur onClick={() => naviguer("/demandes", { replace: true })}>
          {t.commun.continuer}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="text-center">
        <p className="matricule text-xs text-ardoise">{demande.reference}</p>
        <p className="mt-1 text-sm text-navy">{demande.certificateType.label}</p>
        <p className="mt-3 text-xs text-ardoise">{t.paiement.montant}</p>
        <p className="font-titre text-3xl font-bold text-orange-ci">
          {montant(demande.feeAmount, demande.currency)}
        </p>
      </Card>

      <Card className="space-y-4">
        <p className="text-sm font-semibold text-navy">{t.paiement.choisirOperateur}</p>

        <div className="grid grid-cols-2 gap-2">
          {moyens.operateurs.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setOperateur(code)}
              className={`rounded-xl border px-3 py-3 text-sm font-medium transition-colors ${operateur === code ? "border-orange-ci bg-alerte-soft text-orange-ci" : "border-bordure bg-white text-navy"}`}
            >
              {libelle(t.paiement.operateur, code)}
            </button>
          ))}
        </div>

        <InputField
          label={t.paiement.telephonePayeur}
          type="tel"
          inputMode="tel"
          value={numero}
          onChange={(evenement) => setNumero(evenement.target.value)}
        />

        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {/* En bac à sable, le paiement est confirmé sans opérateur réel :
            l'information évite toute confusion pendant les démonstrations. */}
        {moyens.modeBacASable && <Alerte ton="info">Mode démonstration, aucun débit réel.</Alerte>}

        <Button pleineLargeur taille="lg" disabled={!operateur} chargement={envoi} onClick={payer}>
          {t.paiement.payer}
        </Button>
      </Card>

      <Alerte ton="info" titre={t.paiement.guichet}>
        {t.paiement.guichetDetail}
      </Alerte>
    </div>
  );
};
