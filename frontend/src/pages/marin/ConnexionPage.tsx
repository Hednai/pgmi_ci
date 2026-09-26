// ============================================
// pages/marin/ConnexionPage.tsx
// Connexion du marin en deux étapes : numéro, puis code SMS.
//
// Pas de mot de passe : c'est un choix du cahier des charges, un marin de
// retour de mer après six mois ne doit rien avoir à retenir.
// ============================================
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField } from "../../components/atoms/Field.js";
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

export const ConnexionPage = () => {
  const [etape, setEtape] = useState<"telephone" | "code">("telephone");
  const [numero, setNumero] = useState("+225");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const [compteExistant, setCompteExistant] = useState(true);
  const [codeDeveloppement, setCodeDeveloppement] = useState<string>();

  const connecterMarin = useAuthStore((etat) => etat.connecterMarin);
  const naviguer = useNavigate();

  const demanderCode = async () => {
    setErreur("");
    setChargement(true);
    try {
      const reponse = await api.post<ReponseOtp>("/api/auth/otp/request", { phone: numero }, true);
      setCompteExistant(reponse.compteExistant);
      setCodeDeveloppement(reponse.codeDeveloppement);
      setEtape("code");
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setChargement(false);
    }
  };

  const validerCode = async () => {
    setErreur("");
    setChargement(true);
    try {
      const reponse = await api.post<ReponseConnexion>(
        "/api/auth/otp/verify",
        { phone: numero, code },
        true,
      );
      connecterMarin(reponse.marin, reponse.accessToken, reponse.refreshToken);
      naviguer("/accueil", { replace: true });
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-navy">
      <div className="flex flex-1 flex-col justify-center px-5 py-10">
        <div className="mx-auto w-full max-w-sm text-white">
          <p className="text-[11px] uppercase tracking-wide text-white/60">
            {t.commun.republique}
          </p>
          <h1 className="mt-1 font-titre text-2xl font-bold">{t.commun.application}</h1>
          <p className="mt-1 text-sm text-white/70">{t.auth.sousTitreMarin}</p>
        </div>

        <div className="mx-auto mt-6 w-full max-w-sm rounded-carte bg-white p-5">
          {etape === "telephone" ? (
            <div className="space-y-4">
              <InputField
                label={t.auth.telephone}
                aide={t.auth.telephoneAide}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={numero}
                onChange={(evenement) => setNumero(evenement.target.value)}
                obligatoire
              />

              {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

              <Button pleineLargeur taille="lg" chargement={chargement} onClick={demanderCode}>
                {t.auth.recevoirCode}
              </Button>

              <p className="text-center text-xs text-ardoise">
                <Link to="/agent/connexion" className="font-medium text-navy-light hover:underline">
                  {t.auth.espaceAgent}
                </Link>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-navy">{t.auth.codeEnvoye}</p>
                <p className="mt-0.5 text-xs text-ardoise">
                  {t.auth.codeInstruction} {formaterTelephone(numero)}
                </p>
              </div>

              <OtpInput valeur={code} onChange={setCode} desactive={chargement} />

              {/* Confort de développement : le code n'est jamais renvoyé en production */}
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
                    onClick={() => naviguer("/inscription", { state: { phone: numero, code } })}
                  >
                    {t.auth.creerDossier}
                  </Button>
                </>
              )}

              <div className="flex justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setEtape("telephone")}
                  className="font-medium text-ardoise hover:underline"
                >
                  {t.auth.changerNumero}
                </button>
                <button
                  type="button"
                  onClick={demanderCode}
                  className="font-medium text-navy-light hover:underline"
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
};
