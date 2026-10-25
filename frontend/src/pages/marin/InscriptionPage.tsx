// ============================================
// pages/marin/InscriptionPage.tsx
// Création du dossier marin.
//
// Le marin choisit ici son numéro et son mot de passe : ce sont ses
// identifiants de connexion définitifs. Le dossier créé reste PENDING et
// n'ouvre aucun droit tant qu'un agent DGAM n'a pas vérifié l'identité en
// personne (R1) : c'est ce passage au guichet, et non un code reçu à
// l'inscription, qui fait foi sur l'identité du titulaire.
// ============================================
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField } from "../../components/atoms/Field.js";
import { ChampMotDePasse } from "../../components/atoms/ChampMotDePasse.js";
import { Alerte } from "../../components/atoms/Feedback.js";
import { Icone } from "../../components/atoms/Icone.js";
import { MOT_DE_PASSE_LONGUEUR_MIN } from "../../lib/regles.js";
import type { Marin } from "../../types/api.js";

export function InscriptionPage() {
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
  // Numéro et mot de passe : les identifiants de connexion du marin
  const [numero, setNumero] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  const majChamp = (champ: keyof typeof formulaire) => (valeur: string) =>
    setFormulaire((precedent) => ({ ...precedent, [champ]: valeur }));

  // Contrôles de saisie faits avant l'envoi. Le serveur les refait : ils ne
  // sont ici que pour épargner un aller-retour sur une connexion lente.
  const controleLocal = (): string => {
    if (numero.replace(/\D/g, "").length < 8) return t.auth.telephoneAide;
    if (motDePasse.length < MOT_DE_PASSE_LONGUEUR_MIN) return t.auth.motDePasseTropCourt;
    if (motDePasse !== confirmation) return t.auth.motDePasseDifferent;
    return "";
  };

  const soumettre = async () => {
    const refus = controleLocal();
    if (refus) {
      setErreur(refus);
      return;
    }

    setErreur("");
    setChargement(true);
    try {
      const reponse = await api.post<{ marin: Marin; accessToken: string; refreshToken: string }>(
        "/api/auth/register",
        {
          ...formulaire,
          phone: `${t.auth.prefixePays}${numero.replace(/\s/g, "")}`,
          password: motDePasse,
        },
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
      {/* Même bandeau institutionnel que la connexion */}
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

        {/* Identifiants de connexion : numéro et mot de passe choisis ici,
            utilisés à chaque ouverture de session. */}
        <div className="space-y-4 rounded-carte border border-bordure bg-white p-4">
          <h2 className="text-sm font-semibold text-navy">{t.inscription.identifiants}</h2>
          <p className="text-xs text-ardoise">{t.inscription.identifiantsAide}</p>

          <div>
            <label htmlFor="champ-telephone-inscription" className="text-sm font-semibold text-navy">
              {t.auth.telephone} <span className="text-erreur">*</span>
            </label>
            <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-fond px-3.5 py-3">
              <span className="shrink-0 text-sm font-semibold text-navy">
                {t.auth.prefixePays}
              </span>
              <span className="h-5 w-px bg-bordure" />
              <input
                id="champ-telephone-inscription"
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

          <ChampMotDePasse
            label={t.auth.motDePasse}
            aide={t.auth.motDePasseAide}
            autoComplete="new-password"
            value={motDePasse}
            onChange={function (evenement) {
              setMotDePasse(evenement.target.value);
            }}
            obligatoire
          />

          <ChampMotDePasse
            label={t.auth.motDePasseConfirmation}
            autoComplete="new-password"
            value={confirmation}
            onChange={function (evenement) {
              setConfirmation(evenement.target.value);
            }}
            obligatoire
          />
        </div>

        <div className="space-y-4 rounded-carte border border-bordure bg-white p-4">
          <h2 className="text-sm font-semibold text-navy">{t.inscription.etatCivil}</h2>
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

        <p className="text-center text-xs">
          <Link to="/connexion" className="font-semibold text-navy-light hover:underline">
            {t.auth.dejaInscrit}
          </Link>
        </p>
      </main>
    </div>
  );
}