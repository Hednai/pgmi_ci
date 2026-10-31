// ============================================
// components/molecules/ReglementMouvement.tsx
// Règlement des frais de validation d'un mouvement, avant soumission.
//
// Le choix du moyen de paiement reste sur la ligne du dossier plutôt que
// sur un écran séparé : le marin vient de compléter ses pièces, l'envoyer
// ailleurs lui ferait perdre le fil de ce qu'il est en train de faire.
//
// Les opérateurs ne sont pas écrits ici, ils viennent de la route des
// moyens de paiement, et le montant vient de la grille tarifaire. Le
// serveur relit l'un et l'autre : l'écran ne fait qu'annoncer.
// ============================================
import { useEffect, useState } from "react";
import { t, libelle } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Button } from "../atoms/Button.js";
import { SelectField } from "../atoms/Field.js";
import { Alerte } from "../atoms/Feedback.js";
import { montant as formaterMontant } from "../../lib/format.js";

// Moyens de paiement servis par l'API, partagés avec l'écran des demandes.
interface MoyensPaiement {
  canaux: string[];
  operateurs: string[];
  modeBacASable: boolean;
  guichet: string;
}

// Valeur du choix « au guichet », distincte d'un code opérateur.
const CHOIX_GUICHET = "CASH";

interface ProprietesReglement {
  embarquementId: string;
  montantDu: number;
  devise: string;
  surReglement: () => Promise<void> | void;
}

export function ReglementMouvement({
  embarquementId,
  montantDu,
  devise,
  surReglement,
}: ProprietesReglement) {
  const [moyens, setMoyens] = useState<MoyensPaiement | null>(null);
  const [choix, setChoix] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(function chargerMoyens() {
    api
      .get<MoyensPaiement>("/api/demandes/moyens-paiement")
      .then(setMoyens)
      .catch(function () {
        setErreur(t.commun.erreurReseau);
      });
  }, []);

  async function payer() {
    setErreur("");
    setEnvoi(true);
    try {
      // Le montant n'est pas transmis : le serveur le relit dans la grille
      // tarifaire au moment du règlement.
      await api.post(`/api/sea-service/me/${embarquementId}/paiement`, {
        canal: choix === CHOIX_GUICHET ? "CASH" : "MOBILE_MONEY",
        operateur: choix === CHOIX_GUICHET ? undefined : choix,
      });
      await surReglement();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setEnvoi(false);
    }
  }

  if (!moyens) {
    return <p className="mt-3 text-xs text-ardoise">{t.commun.chargement}</p>;
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-orange-ci/30 bg-alerte-soft/40 p-3">
      <div>
        <p className="text-[11px] text-ardoise">{t.serviceMer.reglement.fraisValidation}</p>
        <p className="font-titre text-2xl font-bold text-navy">
          {formaterMontant(montantDu, devise)}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-ardoise">
          {t.serviceMer.reglement.note}
        </p>
      </div>

      <SelectField
        label={t.serviceMer.reglement.moyen}
        value={choix}
        onChange={function (evenement) {
          setChoix(evenement.target.value);
        }}
        obligatoire
      >
        <option value="">{t.serviceMer.reglement.choisirMoyen}</option>
        {moyens.operateurs.map(function afficherOperateur(code) {
          return (
            <option key={code} value={code}>
              {libelle(t.paiement.operateur, code)}
            </option>
          );
        })}
        <option value={CHOIX_GUICHET}>{t.paiement.guichet}</option>
      </SelectField>

      {moyens.modeBacASable && <Alerte ton="info">{t.paiement.modeBacASable}</Alerte>}

      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      <Button pleineLargeur chargement={envoi} disabled={!choix} onClick={payer}>
        {t.serviceMer.reglement.payerEtSoumettre} {formaterMontant(montantDu, devise)}
      </Button>
    </div>
  );
}