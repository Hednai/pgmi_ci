// ============================================
// pages/marin/InscriptionPage.tsx
// Création du dossier marin après vérification du numéro.
//
// Le code OTP validé à l'écran précédent est transmis ici : il prouve que le
// numéro appartient bien à la personne qui crée le dossier.
// ============================================
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField } from "../../components/atoms/Field.js";
import { Alerte } from "../../components/atoms/Feedback.js";
import { Icone } from "../../components/atoms/Icone.js";
import type { Marin } from "../../types/api.js";

interface EtatNavigation {
  phone?: string;
  code?: string;
}

export function InscriptionPage() {
  const emplacement = useLocation();
  const etatRecu = (emplacement.state ?? {}) as EtatNavigation;
  const naviguer = useNavigate();
  const connecterMarin = useAuthStore((etat) => etat.connecterMarin);

  const [formulaire, setFormulaire] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    birthPlace: "",
    nationality: "Ivoirienne",
    idNumber: "",
    email: "",
    region: "",
  });
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  // Sans numéro vérifié, l'écran n'a pas de sens : retour à la connexion
  if (!etatRecu.phone || !etatRecu.code) return <Navigate to="/connexion" replace />;

  const majChamp = (champ: keyof typeof formulaire) => (valeur: string) =>
    setFormulaire((precedent) => ({ ...precedent, [champ]: valeur }));

  const soumettre = async () => {
    setErreur("");
    setChargement(true);
    try {
      const reponse = await api.post<{ marin: Marin; accessToken: string; refreshToken: string }>(
        "/api/auth/register",
        { ...formulaire, phone: etatRecu.phone, code: etatRecu.code },
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
    <div className="min-h-screen bg-fond">
      {/* Même bandeau institutionnel que la connexion : le marin reste dans
          le même parcours visuel entre les deux écrans. */}
      <header className="bg-gradient-to-br from-navy to-navy-light px-5 pb-6 pt-6 text-white">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/12">
            <Icone nom="verifications" taille={22} />
          </span>

          <div>
            <p className="text-[11px] uppercase tracking-wide text-white/60">
              {t.commun.republique}
            </p>
            <h1 className="font-titre text-lg font-bold">{t.inscription.titre}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-4 p-4 pb-10">
        <Alerte ton="info">{t.inscription.rappelGuichet}</Alerte>

        <div className="space-y-4 rounded-carte border border-bordure bg-white p-4">
          <InputField
            label={t.inscription.prenom}
            value={formulaire.firstName}
            onChange={(evenement) => majChamp("firstName")(evenement.target.value)}
            obligatoire
          />
          <InputField
            label={t.inscription.nom}
            value={formulaire.lastName}
            onChange={(evenement) => majChamp("lastName")(evenement.target.value)}
            obligatoire
          />
          <InputField
            label={t.inscription.dateNaissance}
            type="date"
            value={formulaire.birthDate}
            onChange={(evenement) => majChamp("birthDate")(evenement.target.value)}
            obligatoire
          />
          <InputField
            label={t.inscription.lieuNaissance}
            value={formulaire.birthPlace}
            onChange={(evenement) => majChamp("birthPlace")(evenement.target.value)}
            obligatoire
          />
          <InputField
            label={t.inscription.nationalite}
            value={formulaire.nationality}
            onChange={(evenement) => majChamp("nationality")(evenement.target.value)}
          />
          <InputField
            label={t.inscription.piece}
            value={formulaire.idNumber}
            onChange={(evenement) => majChamp("idNumber")(evenement.target.value)}
            obligatoire
          />
          <InputField
            label={t.inscription.region}
            value={formulaire.region}
            onChange={(evenement) => majChamp("region")(evenement.target.value)}
          />
          <InputField
            label={t.inscription.emailFacultatif}
            type="email"
            value={formulaire.email}
            onChange={(evenement) => majChamp("email")(evenement.target.value)}
          />
        </div>

        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        <Button pleineLargeur taille="lg" chargement={chargement} onClick={soumettre}>
          {t.inscription.valider}
        </Button>
      </main>
    </div>
  );
}
