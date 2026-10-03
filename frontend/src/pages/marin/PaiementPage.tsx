// ============================================
// pages/marin/PaiementPage.tsx
// Règlement des frais de dossier.
//
// Le montant affiché vient de la demande enregistrée côté serveur, jamais
// d'un calcul local : c'est ce qui sera réellement débité. Le paiement au
// guichet est présenté au même niveau que le Mobile Money, parce qu'une
// partie des marins n'a pas de compte mobile.
// ============================================
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { t, libelle } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { Card } from "../../components/atoms/Card.js";
import { Button } from "../../components/atoms/Button.js";
import { Icone } from "../../components/atoms/Icone.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { EnteteEcran } from "../../components/layouts/EnteteEcran.js";
import { montant, telephone as formaterTelephone } from "../../lib/format.js";
import type { Demande } from "../../types/api.js";

interface MoyensPaiement {
  canaux: string[];
  operateurs: string[];
  modeBacASable: boolean;
  guichet: string;
}

// Code interne désignant le règlement en espèces à l'antenne.
const CANAL_GUICHET = "GUICHET";

// Couleur de la pastille de chaque opérateur, reprise de leur identité.
const COULEURS_OPERATEUR: Record<string, string> = {
  ORANGE_MONEY: "bg-orange-ci",
  MTN_MOMO: "bg-yellow-400 text-navy",
  WAVE: "bg-sky-500",
  MOOV_MONEY: "bg-blue-600",
};

// Initiales affichées dans la pastille, à défaut de logo officiel.
const INITIALES_OPERATEUR: Record<string, string> = {
  ORANGE_MONEY: "OM",
  MTN_MOMO: "MTN",
  WAVE: "W",
  MOOV_MONEY: "MV",
};

interface ProprietesOption {
  selectionne: boolean;
  titre: string;
  detail: string;
  pastille: React.ReactNode;
  onClick: () => void;
}

// Ligne de choix d'un moyen de paiement, avec son témoin de sélection.
function OptionPaiement({ selectionne, titre, detail, pastille, onClick }: ProprietesOption) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selectionne}
      className={`flex w-full items-center gap-3 rounded-carte border px-4 py-3.5 text-left transition-colors ${selectionne ? "border-[1.5px] border-orange-ci bg-alerte-soft/40" : "border-bordure bg-white hover:bg-fond"}`}
    >
      {pastille}

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-navy">{titre}</span>
        <span className="block text-[11px] text-ardoise">{detail}</span>
      </span>

      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selectionne ? "border-orange-ci" : "border-bordure"}`}
      >
        {selectionne && <span className="h-2.5 w-2.5 rounded-full bg-orange-ci" />}
      </span>
    </button>
  );
}

export function PaiementPage() {
  const { id } = useParams();
  const naviguer = useNavigate();
  const marin = useAuthStore(function (etat) {
    return etat.marin;
  });

  const [demande, setDemande] = useState<Demande | null>(null);
  const [moyens, setMoyens] = useState<MoyensPaiement | null>(null);
  const [selection, setSelection] = useState("");
  const [numero, setNumero] = useState("");
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  useEffect(
    function chargerPaiement() {
      Promise.all([
        api.get<Demande[]>("/api/demandes/me"),
        api.get<MoyensPaiement>("/api/demandes/moyens-paiement"),
      ])
        .then(function ([demandes, moyensPaiement]) {
          setDemande(
            demandes.find(function (valeur) {
              return valeur.id === id;
            }) ?? null,
          );
          setMoyens(moyensPaiement);
        })
        .catch(function () {
          setErreur(t.commun.erreurReseau);
        });
    },
    [id],
  );

  // Le numéro du marin est proposé par défaut : c'est presque toujours celui
  // de son compte Mobile Money.
  useEffect(
    function preremplirNumero() {
      if (marin && !numero) {
        setNumero(marin.phone);
      }
    },
    [marin, numero],
  );

  async function payer() {
    setErreur("");
    setEnvoi(true);
    try {
      await api.post(`/api/demandes/me/${id}/paiement`, {
        canal: selection === CANAL_GUICHET ? "ESPECES" : "MOBILE_MONEY",
        operateur: selection === CANAL_GUICHET ? undefined : selection,
        telephonePayeur: selection === CANAL_GUICHET ? undefined : numero || undefined,
      });
      setSucces(true);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setEnvoi(false);
    }
  }

  if (!demande || !moyens) {
    return <ChargementPage />;
  }

  if (succes) {
    return (
      <Card className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-succes-soft text-succes">
          <Icone nom="valide" taille={28} epaisseur={2.5} />
        </div>

        <div>
          <p className="font-titre text-base font-semibold text-navy">{t.paiement.succes}</p>
          <p className="mt-1 text-sm text-ardoise">{t.paiement.succesDetail}</p>
        </div>

        <Button
          pleineLargeur
          onClick={function () {
            naviguer("/demandes", { replace: true });
          }}
        >
          {t.commun.continuer}
        </Button>
      </Card>
    );
  }

  const guichetSelectionne = selection === CANAL_GUICHET;

  return (
    <div>
      <EnteteEcran titre={t.paiement.titre}>
        <p className="text-[11px] text-white/60">{t.paiement.etapeSur}</p>
      </EnteteEcran>

      <div className="space-y-4">
        {/* Montant dû, tel qu'enregistré par le serveur */}
        <Card className="bg-navy-soft/50 text-center">
          <p className="text-xs text-ardoise">
            {t.paiement.fraisPour}, {demande.certificateType.label}
          </p>
          <p className="mt-1 font-titre text-4xl font-bold text-navy">
            {montant(demande.feeAmount, demande.currency)}
          </p>
          <p className="matricule mt-1.5 text-xs text-ardoise">{demande.reference}</p>
        </Card>

        <div>
          <p className="mb-2.5 text-sm font-semibold text-navy">{t.paiement.choisirMode}</p>

          <div className="space-y-2">
            {moyens.operateurs.map(function afficherOperateur(code) {
              return (
                <OptionPaiement
                  key={code}
                  selectionne={selection === code}
                  titre={libelle(t.paiement.operateur, code)}
                  detail={t.paiement.instantane}
                  pastille={
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white ${COULEURS_OPERATEUR[code] ?? "bg-navy"}`}
                    >
                      {INITIALES_OPERATEUR[code] ?? code.slice(0, 2)}
                    </span>
                  }
                  onClick={function () {
                    setSelection(code);
                  }}
                />
              );
            })}

            {/* Règlement en espèces : indispensable pour les marins sans
                compte Mobile Money */}
            <OptionPaiement
              selectionne={guichetSelectionne}
              titre={t.paiement.guichet}
              detail={t.paiement.especesDetail}
              pastille={
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-sea text-white">
                  <Icone nom="especes" taille={18} />
                </span>
              }
              onClick={function () {
                setSelection(CANAL_GUICHET);
              }}
            />
          </div>
        </div>

        {/* Numéro à débiter, demandé uniquement pour le Mobile Money */}
        {selection && !guichetSelectionne && (
          <Card>
            <label htmlFor="champ-numero-paiement" className="text-sm font-semibold text-navy">
              {t.paiement.numeroOperateur} {libelle(t.paiement.operateur, selection)}
            </label>

            <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-fond px-3.5 py-3">
              <Icone nom="mobile" taille={16} className="shrink-0 text-ardoise" />
              <input
                id="champ-numero-paiement"
                type="tel"
                inputMode="tel"
                value={numero}
                onChange={function (evenement) {
                  setNumero(evenement.target.value);
                }}
                className="w-full bg-transparent text-sm font-medium text-navy outline-none"
              />
            </div>

            <p className="mt-1.5 text-[11px] text-ardoise">{formaterTelephone(numero)}</p>
          </Card>
        )}

        {guichetSelectionne && <Alerte ton="info" titre={t.paiement.guichet}>{moyens.guichet}</Alerte>}

        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {/* En bac à sable, le paiement est confirmé sans opérateur réel :
            l'information évite toute confusion pendant les démonstrations. */}
        {moyens.modeBacASable && <Alerte ton="info">{t.commun.modeDemonstration}</Alerte>}

        <Button
          pleineLargeur
          taille="lg"
          disabled={!selection}
          chargement={envoi}
          onClick={payer}
          className="shadow-lg shadow-orange-ci/25"
        >
          {guichetSelectionne
            ? t.commun.confirmer
            : `${t.paiement.payer} ${montant(demande.feeAmount, demande.currency)}`}
        </Button>

        {!guichetSelectionne && (
          <p className="text-center text-[11px] leading-relaxed text-ardoise">
            {t.paiement.confirmationTelephone}
          </p>
        )}
      </div>
    </div>
  );
}
