// ============================================
// components/molecules/ReglementPrestation.tsx
// Règlement d'une prestation payante de la plateforme.
//
// Une validation de mouvement et une édition de relevé se règlent par le
// même geste : un montant lu dans la grille tarifaire, un moyen de paiement
// choisi dans la liste servie par l'API, un envoi. Le composant ne connaît
// ni l'un ni l'autre objet, il reçoit le chemin à appeler : ajouter une
// troisième prestation ne demandera pas un troisième composant.
//
// Le montant n'est jamais transmis au serveur : il le relit lui-même.
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
  // Route de règlement de la prestation, par exemple
  // /api/sea-service/me/<id>/paiement
  chemin: string;
  montantDu: number;
  devise: string;
  // Textes propres à la prestation réglée
  intitule: string;
  note: string;
  libelleBouton: string;
  surReglement: () => Promise<void> | void;
}

export function ReglementPrestation({
  chemin,
  montantDu,
  devise,
  intitule,
  note,
  libelleBouton,
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
      await api.post(chemin, {
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
        <p className="text-[11px] text-ardoise">{intitule}</p>
        <p className="font-titre text-2xl font-bold text-navy">
          {formaterMontant(montantDu, devise)}
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-ardoise">{note}</p>
      </div>

      <SelectField
        label={t.paiement.choisirMode}
        value={choix}
        onChange={function (evenement) {
          setChoix(evenement.target.value);
        }}
        obligatoire
      >
        <option value="">{t.paiement.choisirOperateur}</option>
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
        {libelleBouton} {formaterMontant(montantDu, devise)}
      </Button>
    </div>
  );
}