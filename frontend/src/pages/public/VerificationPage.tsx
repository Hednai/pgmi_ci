// ============================================
// pages/public/VerificationPage.tsx
// Saisie manuelle d'un code de vérification.
//
// Le scan d'un QR ouvre la page HTML statique servie par le backend, bien
// plus légère. Cet écran couvre le cas où le QR est illisible et où
// l'inspecteur recopie le code imprimé.
// ============================================
import { useState } from "react";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Card } from "../../components/atoms/Card.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField } from "../../components/atoms/Field.js";
import { Alerte } from "../../components/atoms/Feedback.js";
import type { ResultatVerification } from "../../types/api.js";

export const VerificationPage = () => {
  const [code, setCode] = useState("");
  const [resultat, setResultat] = useState<ResultatVerification | null>(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const verifier = async () => {
    setErreur("");
    setResultat(null);
    setChargement(true);
    try {
      setResultat(
        await api.get<ResultatVerification>(
          `/api/verification/${encodeURIComponent(code.trim().toUpperCase())}`,
          true,
        ),
      );
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="min-h-screen bg-fond">
      <header className="bg-navy px-4 py-5 text-white">
        <div className="mx-auto max-w-lg">
          <p className="text-[11px] uppercase tracking-wide text-white/60">
            {t.commun.republique}
          </p>
          <h1 className="font-titre text-lg font-semibold">{t.verification.titre}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4">
        <Card className="space-y-4">
          <InputField
            label={t.verification.codeSaisie}
            value={code}
            onChange={(evenement) => setCode(evenement.target.value.toUpperCase())}
            onKeyDown={(evenement) => {
              if (evenement.key === "Enter") void verifier();
            }}
            className="matricule"
          />
          <Button
            pleineLargeur
            taille="lg"
            chargement={chargement}
            disabled={code.trim().length < 4}
            onClick={verifier}
          >
            {t.verification.verifier}
          </Button>
        </Card>

        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {resultat && (
          <Card className="space-y-3">
            <Alerte ton={resultat.valide ? "succes" : "erreur"} titre={resultat.libelleStatut}>
              {resultat.message}
            </Alerte>

            {resultat.document && (
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between border-b border-bordure pb-2">
                  <dt className="text-ardoise">{t.verification.document}</dt>
                  <dd className="font-medium text-navy">{resultat.document.certificat}</dd>
                </div>
                <div className="flex justify-between border-b border-bordure pb-2">
                  <dt className="text-ardoise">{t.verification.titulaire}</dt>
                  <dd className="font-medium text-navy">{resultat.document.titulaire}</dd>
                </div>
                <div className="flex justify-between border-b border-bordure pb-2">
                  <dt className="text-ardoise">{t.tableauBordMarin.matricule}</dt>
                  <dd className="matricule font-medium text-navy">
                    {resultat.document.matricule ?? "—"}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-bordure pb-2">
                  <dt className="text-ardoise">{t.documents.expireLe}</dt>
                  <dd className="font-medium text-navy">{resultat.document.expireLe ?? "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ardoise">{t.verification.autorite}</dt>
                  <dd className="text-right font-medium text-navy">
                    {resultat.document.autorite}
                  </dd>
                </div>
              </dl>
            )}
          </Card>
        )}
      </main>
    </div>
  );
};
