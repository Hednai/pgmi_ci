// ============================================
// pages/marin/ConnexionPage.tsx
// Connexion du marin : numéro et mot de passe.
// Le parcours « Mot de passe oublié ? » envoie un code à usage unique,
// le seul envoi qui subsiste depuis la bascule au mot de passe.
// ============================================
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { Button } from "../../components/atoms/Button.js";
import { Icone } from "../../components/atoms/Icone.js";
import { OtpInput } from "../../components/atoms/OtpInput.js";
import { ChampMotDePasse } from "../../components/atoms/ChampMotDePasse.js";
import { Alerte } from "../../components/atoms/Feedback.js";
import { MOT_DE_PASSE_LONGUEUR_MIN } from "../../lib/regles.js";
import type { Marin } from "../../types/api.js";

interface ReponseCode {
  expiresAt: string;
  codeDeveloppement?: string;
}

interface ReponseSession {
  marin: Marin;
  accessToken: string;
  refreshToken: string;
}

// Durée de validité d'un code, en secondes.
const DUREE_CODE_SECONDES = 600;
const LONGUEUR_CODE = 6;

// Canal d'envoi du code de réinitialisation
type CanalCode = "SMS" | "WHATSAPP";

// Marque institutionnelle affichée en haut des étapes.
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
  // Trois étapes : connexion par mot de passe, demande d'un code, saisie du
  // nouveau mot de passe.
  const [etape, setEtape] = useState<"connexion" | "demandeCode" | "nouveauMotDePasse">(
    "connexion",
  );
  const [numero, setNumero] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [code, setCode] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [canal, setCanal] = useState<CanalCode>("WHATSAPP");
  const [erreur, setErreur] = useState("");
  const [information, setInformation] = useState("");
  const [chargement, setChargement] = useState(false);
  const [codeDeveloppement, setCodeDeveloppement] = useState<string | undefined>();
  const [secondesRestantes, setSecondesRestantes] = useState(DUREE_CODE_SECONDES);

  const connecterMarin = useAuthStore(function (etat) {
    return etat.connecterMarin;
  });
  const naviguer = useNavigate();

  // Compte à rebours de validité du code.
  useEffect(
    function decompterValidite() {
      if (etape !== "nouveauMotDePasse") return;

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

  // Ouvrir la session et rejoindre l'accueil. Partagé par la connexion et
  // par la réinitialisation : le marin qui vient de choisir un mot de passe
  // n'a pas à le ressaisir.
  function ouvrirSession(reponse: ReponseSession) {
    connecterMarin(reponse.marin, reponse.accessToken, reponse.refreshToken);
    naviguer("/accueil", { replace: true });
  }

  function signaler(err: unknown) {
    setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
  }

  async function seConnecter() {
    setErreur("");
    setChargement(true);
    try {
      ouvrirSession(
        await api.post<ReponseSession>(
          "/api/auth/marin/login",
          { phone: numeroComplet(), password: motDePasse },
          true,
        ),
      );
    } catch (err) {
      signaler(err);
    } finally {
      setChargement(false);
    }
  }

  async function demanderCode(canalChoisi?: CanalCode) {
    const canalEffectif = canalChoisi ?? canal;
    if (canalChoisi) setCanal(canalChoisi);
    setErreur("");
    setChargement(true);
    try {
      const reponse = await api.post<ReponseCode>(
        "/api/auth/marin/mot-de-passe/code",
        { phone: numeroComplet(), canal: canalEffectif },
        true,
      );
      setCodeDeveloppement(reponse.codeDeveloppement);
      setSecondesRestantes(DUREE_CODE_SECONDES);
      setInformation(t.auth.codeEnvoye);
      setEtape("nouveauMotDePasse");
    } catch (err) {
      signaler(err);
    } finally {
      setChargement(false);
    }
  }

  async function definirMotDePasse() {
    if (nouveauMotDePasse.length < MOT_DE_PASSE_LONGUEUR_MIN) {
      setErreur(t.auth.motDePasseTropCourt);
      return;
    }

    setErreur("");
    setChargement(true);
    try {
      ouvrirSession(
        await api.post<ReponseSession>(
          "/api/auth/marin/mot-de-passe",
          { phone: numeroComplet(), code, password: nouveauMotDePasse },
          true,
        ),
      );
    } catch (err) {
      signaler(err);
    } finally {
      setChargement(false);
    }
  }

  // Revenir à la connexion en repartant d'un état propre : un code ou un
  // mot de passe à moitié saisi ne doit pas survivre au changement d'étape.
  function revenirALaConnexion() {
    setEtape("connexion");
    setCode("");
    setNouveauMotDePasse("");
    setCodeDeveloppement(undefined);
    setErreur("");
    setInformation("");
  }

  const numeroSaisi = numero.replace(/\D/g, "").length >= 8;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-br from-navy to-navy-light px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <EnteteInstitution />

        <div className="mt-7 rounded-2xl bg-white p-5 shadow-xl">
          {/* Le champ numéro est commun aux trois étapes : le marin ne le
              ressaisit pas en passant par la réinitialisation. */}
          {etape !== "nouveauMotDePasse" && (
            <div>
              <label htmlFor="champ-telephone" className="text-sm font-semibold text-navy">
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
                  autoComplete="username tel"
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
          )}

          {etape === "connexion" && (
            <div className="mt-4 space-y-4">
              <ChampMotDePasse
                label={t.auth.motDePasse}
                autoComplete="current-password"
                value={motDePasse}
                onChange={function (evenement) {
                  setMotDePasse(evenement.target.value);
                }}
                onKeyDown={function (evenement) {
                  if (evenement.key === "Enter") void seConnecter();
                }}
                obligatoire
              />

              {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

              <Button
                pleineLargeur
                taille="lg"
                chargement={chargement}
                disabled={!numeroSaisi || motDePasse.length === 0}
                onClick={seConnecter}
                className="shadow-lg shadow-orange-ci/25"
              >
                {t.auth.connexion}
              </Button>

              <button
                type="button"
                onClick={function () {
                  setErreur("");
                  setEtape("demandeCode");
                }}
                className="block w-full text-center text-xs font-semibold text-navy-light hover:underline"
              >
                {t.auth.oublie}
              </button>

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
          )}

          {etape === "demandeCode" && (
            <div className="mt-4 space-y-4">
              <Alerte ton="info" titre={t.auth.oublieTitre}>
                {t.auth.oublieExplication}
              </Alerte>

              {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

              <p className="text-xs font-semibold text-navy">{t.auth.oublieCanal}</p>
              <div className="flex gap-3">
                <Button pleineLargeur taille="lg" disabled className="opacity-50">
                  {t.auth.canalSms}
                </Button>
                <Button
                  pleineLargeur
                  taille="lg"
                  chargement={chargement}
                  disabled={!numeroSaisi || chargement}
                  onClick={function () {
                    void demanderCode("WHATSAPP");
                  }}
                  className="bg-[#25D366] shadow-lg shadow-[#25D366]/25 hover:bg-[#1da851]"
                >
                  {t.auth.canalWhatsapp}
                </Button>
              </div>
              <p className="text-center text-[11px] text-ardoise">
                {t.auth.canalSmsIndisponible}
              </p>

              <button
                type="button"
                onClick={revenirALaConnexion}
                className="block w-full text-center text-xs font-medium text-ardoise hover:underline"
              >
                {t.auth.retourConnexion}
              </button>
            </div>
          )}

          {etape === "nouveauMotDePasse" && (
            <div className="space-y-4">
              {information && <Alerte ton="info">{information}</Alerte>}

              <div>
                <p className="text-center text-sm font-semibold text-navy">
                  {t.auth.codeChamp}
                </p>
                <div className="mt-2">
                  <OtpInput valeur={code} onChange={setCode} desactive={chargement} />
                </div>
              </div>

              <p className="text-center text-xs text-ardoise">
                {t.auth.expireDans}{" "}
                <span className="matricule font-semibold text-navy">{minutesEtSecondes()}</span>
              </p>

              {/* Confort de recette : le code n'est jamais renvoyé en production */}
              {codeDeveloppement && (
                <Alerte ton="info">
                  {t.auth.codeDeveloppement} : <strong>{codeDeveloppement}</strong>
                </Alerte>
              )}

              <ChampMotDePasse
                label={t.auth.nouveauMotDePasse}
                aide={t.auth.motDePasseAide}
                autoComplete="new-password"
                value={nouveauMotDePasse}
                onChange={function (evenement) {
                  setNouveauMotDePasse(evenement.target.value);
                }}
                obligatoire
              />

              {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

              <Button
                pleineLargeur
                taille="lg"
                chargement={chargement}
                disabled={code.length < LONGUEUR_CODE}
                onClick={definirMotDePasse}
                className="shadow-lg shadow-orange-ci/25"
              >
                {t.auth.definirMotDePasse}
              </Button>

              <div className="flex justify-between border-t border-bordure pt-3 text-xs">
                <button
                  type="button"
                  onClick={revenirALaConnexion}
                  className="font-medium text-ardoise hover:underline"
                >
                  {t.auth.retourConnexion}
                </button>

                <button
                  type="button"
                  onClick={function () {
                    void demanderCode();
                  }}
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