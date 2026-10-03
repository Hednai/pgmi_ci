// ============================================
// pages/marin/ProfilPage.tsx
// Profil du marin : identité, QR professionnel, préférences de notification.
//
// Le canal SMS est affiché verrouillé : il porte les alertes d'expiration,
// que le marin ne peut pas désactiver (R17).
// ============================================
import { useEffect, useState } from "react";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card } from "../../components/atoms/Card.js";
import { Button } from "../../components/atoms/Button.js";
import { Icone } from "../../components/atoms/Icone.js";
import { InputField, SelectField } from "../../components/atoms/Field.js";
import { Alerte } from "../../components/atoms/Feedback.js";
import { dateCourte, initiales, telephone } from "../../lib/format.js";
import type { Marin } from "../../types/api.js";

// Ligne d'information de la carte d'identité, séparée par un filet.
function Ligne({ libelleChamp, valeur }: { libelleChamp: string; valeur: string }) {
  return (
    <div className="flex items-center justify-between border-b border-bordure py-2.5 last:border-0">
      <span className="text-sm text-ardoise">{libelleChamp}</span>
      <span className="text-sm font-medium text-navy">{valeur}</span>
    </div>
  );
}

// Interrupteur de canal de notification. Le canal obligatoire est rendu
// visuellement actif mais non modifiable.
function InterrupteurCanal({
  etiquette,
  detail,
  actif,
  verrouille = false,
  desactive = false,
  onChange,
}: {
  etiquette: string;
  detail?: string;
  actif: boolean;
  verrouille?: boolean;
  desactive?: boolean;
  onChange?: (valeur: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-bordure py-3 last:border-0">
      <div className="min-w-0 pr-3">
        <p className="text-sm font-medium text-navy">{etiquette}</p>
        {detail && <p className="text-xs text-ardoise">{detail}</p>}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={actif}
        aria-label={etiquette}
        disabled={verrouille || desactive}
        onClick={function () {
          if (onChange) {
            onChange(!actif);
          }
        }}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${actif ? "bg-vert-ci" : "bg-bordure"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${actif ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

export function ProfilPage() {
  const { marin, majMarin, deconnecter } = useAuthStore();
  const { fonctions, charger } = useReferentielStore();

  const [email, setEmail] = useState(marin?.email ?? "");
  const [fonctionId, setFonctionId] = useState(marin?.fonction?.id ?? "");
  const [editionOuverte, setEditionOuverte] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(
    function chargerReferentiels() {
      void charger();
    },
    [charger],
  );

  if (!marin) {
    return null;
  }

  async function enregistrer() {
    setErreur("");
    setMessage("");
    setEnvoi(true);
    try {
      const actualise = await api.patch<Marin>("/api/marins/me", {
        email,
        fonctionId: fonctionId || undefined,
      });
      majMarin(actualise);
      setMessage(t.commun.enregistrer);
      setEditionOuverte(false);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setEnvoi(false);
    }
  }

  async function basculerCanal(canal: "whatsapp" | "email", valeur: boolean) {
    if (!marin) {
      return;
    }
    setErreur("");
    try {
      const actualise = await api.patch<Marin>("/api/marins/me/preferences", {
        whatsapp: canal === "whatsapp" ? valeur : marin.preferences.whatsapp,
        email: canal === "email" ? valeur : marin.preferences.email,
      });
      majMarin(actualise);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    }
  }

  return (
    <div>
      {/* Carte d'identité professionnelle */}
      <header className="-mx-4 -mt-4 mb-4 bg-gradient-to-br from-navy to-navy-light px-5 pb-6 pt-6 text-center text-white">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 font-titre text-2xl font-bold">
          {initiales(marin.fullName)}
        </div>

        <p className="mt-3 font-titre text-lg font-bold">{marin.fullName}</p>
        <p className="mt-0.5 text-xs text-white/70">
          {marin.fonction ? marin.fonction.label : ""}
        </p>

        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5">
          <span
            className={`h-2 w-2 rounded-full ${marin.isActive ? "bg-vert-ci" : "bg-orange-ci"}`}
          />
          <span className="text-xs font-medium">
            {marin.isActive ? t.profil.compteActif : t.profil.compteEnAttente}
          </span>
        </div>
      </header>

      <div className="space-y-4">
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
        {message && <Alerte ton="succes">{message}</Alerte>}

        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-navy">{t.profil.informations}</h2>
            <button
              type="button"
              onClick={function () {
                setEditionOuverte(!editionOuverte);
              }}
              className="text-xs font-semibold text-orange-ci hover:underline"
            >
              {editionOuverte ? t.commun.annuler : t.profil.modifier}
            </button>
          </div>

          <Ligne
            libelleChamp={t.tableauBordMarin.matricule}
            valeur={marin.matricule ?? t.profil.compteEnAttente}
          />
          <Ligne libelleChamp={t.auth.telephone} valeur={telephone(marin.phone)} />
          <Ligne libelleChamp={t.inscription.dateNaissance} valeur={dateCourte(marin.birthDate)} />
          <Ligne libelleChamp={t.inscription.lieuNaissance} valeur={marin.birthPlace} />
          <Ligne libelleChamp={t.inscription.nationalite} valeur={marin.nationality} />
          <Ligne libelleChamp={t.inscription.piece} valeur={marin.idNumber} />
          <Ligne libelleChamp={t.profil.region} valeur={marin.region ?? "—"} />
        </Card>

        {editionOuverte && (
          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-navy">{t.profil.contact}</h2>

            <InputField
              label={t.inscription.emailFacultatif}
              type="email"
              value={email}
              onChange={function (evenement) {
                setEmail(evenement.target.value);
              }}
            />

            <SelectField
              label={t.profil.fonction}
              value={fonctionId}
              onChange={function (evenement) {
                setFonctionId(evenement.target.value);
              }}
            >
              <option value="">—</option>
              {fonctions?.map(function afficherFonction(fonction) {
                return (
                  <option key={fonction.id} value={fonction.id}>
                    {fonction.label}
                  </option>
                );
              })}
            </SelectField>

            <Button pleineLargeur chargement={envoi} onClick={enregistrer}>
              {t.commun.enregistrer}
            </Button>
          </Card>
        )}

        {/* Preuve vérifiable présentée à un inspecteur ou à un armateur */}
        <Card className="text-center">
          <h2 className="text-sm font-semibold text-navy">{t.profil.qrProfessionnel}</h2>

          <div className="mx-auto my-4 flex h-40 w-40 items-center justify-center rounded-xl border-2 border-navy/10 bg-fond">
            <Icone nom="qrCode" taille={72} epaisseur={1.2} className="text-navy/25" />
          </div>

          <p className="matricule text-xs text-ardoise">
            pgmi.ci/v/{marin.matricule ? marin.matricule.slice(-9) : "…"}
          </p>

          <Button variante="discret" pleineLargeur className="mt-3">
            {t.profil.partagerQr}
          </Button>
        </Card>

        <Card>
          <h2 className="mb-1 text-sm font-semibold text-navy">{t.profil.notifications}</h2>

          <InterrupteurCanal
            etiquette={t.profil.notifSms}
            detail={t.profil.notifSmsDetail}
            actif
            verrouille
          />

          <InterrupteurCanal
            etiquette={t.profil.notifWhatsapp}
            actif={marin.preferences.whatsapp}
            onChange={function (valeur) {
              void basculerCanal("whatsapp", valeur);
            }}
          />

          <InterrupteurCanal
            etiquette={t.profil.notifEmail}
            detail={marin.email ? undefined : t.profil.emailRequis}
            actif={marin.preferences.email}
            desactive={!marin.email}
            onChange={function (valeur) {
              void basculerCanal("email", valeur);
            }}
          />
        </Card>

        <Button variante="danger" pleineLargeur onClick={deconnecter}>
          {t.commun.deconnexion}
        </Button>
      </div>
    </div>
  );
}
