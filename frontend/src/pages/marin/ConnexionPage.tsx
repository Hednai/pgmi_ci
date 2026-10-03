// ============================================
// pages/marin/ConnexionPage.tsx
// Connexion du marin en deux étapes : numéro, puis code reçu par SMS.
//
// Pas de mot de passe : c'est un choix du cahier des charges, un marin de
// retour de mer après six mois ne doit rien avoir à retenir.
// ============================================
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { Button } from "../../components/atoms/Button.js";
import { Icone } from "../../components/atoms/Icone.js";
import { OtpInput } from "../../components/atoms/OtpInput.js";
import { Alerte } from "../../components/atoms/Feedback.js";
import { telephone as formaterTelephone } from "../../lib/format.js";
import type { Marin } from "../../types/api.js";

interface ReponseOtp {
  expiresAt: string;
  compteExistant: boolean;
  codeDeveloppement?: string;
}

interface ReponseConnexion {
  marin: Marin;
  accessToken: string;
  refreshToken: string;
}

// Durée de validité d'un code, en secondes. Le compte à rebours affiché
// rassure le marin sur le délai dont il dispose.
const DUREE_CODE_SECONDES = 600;

// Marque institutionnelle affichée en haut des deux étapes.
function EnteteInstitution() {
  return (
    <div className="text-center text-white">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12">
        <Icone nom="verifications" taille={28} />
      </div>

      <p className="mt-4 text-[11px] uppercase tracking-wide text-white/60">
        {t.commun.republique}
      </p>
      <h1 className="mt-1 font-titre text-3xl font-bold tracking-tight">{t.commun.application}</h1>
      <p className="mt-1.5 text-sm text-white/70">{t.auth.sousTitreMarin}</p>
    </div>
  );
}

export function ConnexionPage() {
  const [etape, setEtape] = useState<"telephone" | "code">("telephone");
  const [numero, setNumero] = useState("");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [compteExistant, setCompteExistant] = useState(true);
  const [codeDeveloppement, setCodeDeveloppement] = useState<string>();
  const [secondesRestantes, setSecondesRestantes] = useState(DUREE_CODE_SECONDES);

  const connecterMarin = useAuthStore(function (etat) {
    return etat.connecterMarin;
  });
  const naviguer = useNavigate();

  // Compte à rebours de validité du code, actif seulement à la seconde étape.
  useEffect(
    function decompterValidite() {
      if (etape !== "code") {
        return;
      }

      const minuteur = setInterval(function () {
        setSecondesRestantes(function (precedent) {
          return precedent > 0 ? precedent - 1 : 0;
        });
      }, 1000);

      return function nettoyer() {
        clearInterval(minuteur);
      };
    },
    [etape],
  );

  // Numéro complet au format international attendu par l'API.
  function numeroComplet(): string {
    return `${t.auth.prefixePays}${numero.replace(/\s/g, "")}`;
  }

  function minutesEtSecondes(): string {
    const minutes = Math.floor(secondesRestantes / 60);
    const secondes = secondesRestantes % 60;
    return `${minutes}:${String(secondes).padStart(2, "0")}`;
  }

  async function demanderCode() {
    setErreur("");
    setChargement(true);
    try {
      const reponse = await api.post<ReponseOtp>(
        "/api/auth/otp/request",
        { phone: numeroComplet() },
        true,
      );
      setCompteExistant(reponse.compteExistant);
      setCodeDeveloppement(reponse.codeDeveloppement);
      setSecondesRestantes(DUREE_CODE_SECONDES);
      setEtape("code");
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setChargement(false);
    }
  }

  async function validerCode() {
    setErreur("");
    setChargement(true);
    try {
      const reponse = await api.post<ReponseConnexion>(
        "/api/auth/otp/verify",
        { phone: numeroComplet(), code },
        true,
      );
      connecterMarin(reponse.marin, reponse.accessToken, reponse.refreshToken);
      naviguer("/accueil", { replace: true });
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-navy to-navy-light px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <EnteteInstitution />

        <div className="mt-7 rounded-2xl bg-white p-5 shadow-xl">
          {etape === "telephone" ? (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="champ-telephone"
                  className="text-sm font-semibold text-navy"
                >
                  {t.auth.telephone} <span className="text-erreur">*</span>
                </label>

                {/* Le préfixe pays est fixe : le marin ne saisit que son numéro */}
                <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-fond px-3.5 py-3">
                  <span className="shrink-0 text-sm font-semibold text-navy">
                    {t.auth.prefixePays}
                  </span>
                  <span className="h-5 w-px bg-bordure" />
                  <input
                    id="champ-telephone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="07 00 00 00 00"
                    value={numero}
                    onChange={function (evenement) {
                      setNumero(evenement.target.value);
                    }}
                    className="w-full bg-transparent text-sm font-medium text-navy outline-none placeholder:text-ardoise/60"
                  />
                </div>

                <p className="mt-1.5 text-xs text-ardoise">{t.auth.telephoneAide}</p>
              </div>

              {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

              <Button
                pleineLargeur
                taille="lg"
                chargement={chargement}
                disabled={numero.replace(/\D/g, "").length < 8}
                onClick={demanderCode}
                className="shadow-lg shadow-orange-ci/25"
              >
                {t.auth.recevoirCode}
              </Button>

              <Link
                to="/inscription"
                className="flex w-full items-center justify-center rounded-xl border border-navy py-3 text-sm font-semibold text-navy transition-colors hover:bg-navy-soft"
              >
                {t.auth.creerDossier}
              </Link>

              <p className="pt-1 text-center text-xs">
                <Link
                  to="/agent/connexion"
                  className="font-semibold text-navy-light hover:underline"
                >
                  {t.auth.espaceAgent}
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-semibold text-navy">{t.auth.codeEnvoye}</p>
                <p className="mt-0.5 text-xs text-ardoise">
                  {t.auth.codeInstruction} {formaterTelephone(numeroComplet())}
                </p>
              </div>

              <OtpInput valeur={code} onChange={setCode} desactive={chargement} />

              <p className="text-center text-xs text-ardoise">
                {t.auth.expireDans}{" "}
                <span className="matricule font-semibold text-navy">{minutesEtSecondes()}</span>
              </p>

              {/* Confort de démonstration : le code n'est jamais renvoyé en production */}
              {codeDeveloppement && (
                <Alerte ton="info">
                  {t.auth.codeDeveloppement} : <strong>{codeDeveloppement}</strong>
                </Alerte>
              )}

              {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

              {compteExistant ? (
                <Button
                  pleineLargeur
                  taille="lg"
                  chargement={chargement}
                  disabled={code.length < 6}
                  onClick={validerCode}
                  className="shadow-lg shadow-orange-ci/25"
                >
                  {t.auth.validerCode}
                </Button>
              ) : (
                <>
                  <Alerte ton="info">{t.inscription.rappelGuichet}</Alerte>
                  <Button
                    pleineLargeur
                    taille="lg"
                    disabled={code.length < 6}
                    onClick={function () {
                      naviguer("/inscription", { state: { phone: numeroComplet(), code } });
                    }}
                  >
                    {t.auth.creerDossier}
                  </Button>
                </>
              )}

              <div className="flex justify-between border-t border-bordure pt-3 text-xs">
                <button
                  type="button"
                  onClick={function () {
                    setEtape("telephone");
                    setCode("");
                  }}
                  className="font-medium text-ardoise hover:underline"
                >
                  {t.auth.changerNumero}
                </button>

                <button
                  type="button"
                  onClick={demanderCode}
                  className="font-semibold text-navy-light hover:underline"
                >
                  {t.auth.renvoyerCode}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
