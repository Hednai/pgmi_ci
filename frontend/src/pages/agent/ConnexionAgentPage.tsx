// ============================================
// pages/agent/ConnexionAgentPage.tsx
// Connexion des agents DGAM et ARSTM.
// ============================================
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField } from "../../components/atoms/Field.js";
import { Alerte } from "../../components/atoms/Feedback.js";
import { Icone } from "../../components/atoms/Icone.js";
import type { Agent } from "../../types/api.js";

export function ConnexionAgentPage() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const connecterAgent = useAuthStore((etat) => etat.connecterAgent);
  const naviguer = useNavigate();

  const soumettre = async () => {
    setErreur("");
    setChargement(true);
    try {
      const reponse = await api.post<{
        agent: Agent;
        accessToken: string;
        refreshToken: string;
      }>("/api/auth/agent/login", { email, password: motDePasse }, true);

      connecterAgent(reponse.agent, reponse.accessToken, reponse.refreshToken);
      naviguer("/agent", { replace: true });
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setChargement(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-navy to-navy-light px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center text-white">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12">
            <Icone nom="verifications" taille={28} />
          </div>

          <p className="mt-4 text-[11px] uppercase tracking-wide text-white/60">
            {t.commun.republique}
          </p>
          <h1 className="mt-1 font-titre text-3xl font-bold tracking-tight">
            {t.commun.application}
          </h1>
          <p className="mt-1.5 text-sm text-white/70">{t.auth.espaceAgent}</p>
        </div>

        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-xl">
          <InputField
            label={t.auth.email}
            type="email"
            autoComplete="username"
            value={email}
            onChange={(evenement) => setEmail(evenement.target.value)}
            obligatoire
          />
          <InputField
            label={t.auth.motDePasse}
            type="password"
            autoComplete="current-password"
            value={motDePasse}
            onChange={(evenement) => setMotDePasse(evenement.target.value)}
            onKeyDown={(evenement) => {
              if (evenement.key === "Enter") void soumettre();
            }}
            obligatoire
          />

          {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

          <Button
            pleineLargeur
            taille="lg"
            variante="secondaire"
            chargement={chargement}
            onClick={soumettre}
          >
            {t.auth.connexion}
          </Button>

          <p className="text-center text-xs">
            <Link to="/connexion" className="font-medium text-navy-light hover:underline">
              {t.auth.espaceMarins}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
