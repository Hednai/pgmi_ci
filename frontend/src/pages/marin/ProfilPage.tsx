// ============================================
// pages/marin/ProfilPage.tsx
// Profil du marin : identité, fonction, préférences de notification.
//
// Le canal SMS est affiché verrouillé : il porte les alertes de dernière
// année, que le marin ne peut pas désactiver (R17).
// ============================================
import { useEffect, useState } from "react";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card, SectionTitre } from "../../components/atoms/Card.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField, SelectField } from "../../components/atoms/Field.js";
import { Alerte } from "../../components/atoms/Feedback.js";
import { dateCourte, telephone } from "../../lib/format.js";
import type { Marin } from "../../types/api.js";

const Ligne = ({ libelleChamp, valeur }: { libelleChamp: string; valeur: string }) => (
  <div className="flex items-center justify-between border-b border-bordure py-2.5 last:border-0">
    <span className="text-sm text-ardoise">{libelleChamp}</span>
    <span className="text-sm font-medium text-navy">{valeur}</span>
  </div>
);

export const ProfilPage = () => {
  const { marin, majMarin, deconnecter } = useAuthStore();
  const { fonctions, charger } = useReferentielStore();

  const [email, setEmail] = useState(marin?.email ?? "");
  const [fonctionId, setFonctionId] = useState(marin?.fonction?.id ?? "");
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (!marin) return null;

  const enregistrer = async () => {
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
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setEnvoi(false);
    }
  };

  const basculerCanal = async (canal: "whatsapp" | "email", valeur: boolean) => {
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
  };

  return (
    <div className="space-y-4">
      <SectionTitre titre={t.profil.titre} />

      <Card>
        <h3 className="mb-1 text-sm font-semibold text-navy">{t.profil.identite}</h3>
        <Ligne libelleChamp={t.inscription.nom} valeur={marin.fullName} />
        <Ligne
          libelleChamp={t.tableauBordMarin.matricule}
          valeur={marin.matricule ?? t.tableauBordMarin.dossierEnAttente}
        />
        <Ligne libelleChamp={t.inscription.dateNaissance} valeur={dateCourte(marin.birthDate)} />
        <Ligne libelleChamp={t.inscription.lieuNaissance} valeur={marin.birthPlace} />
        <Ligne libelleChamp={t.inscription.piece} valeur={marin.idNumber} />
        <Ligne libelleChamp={t.auth.telephone} valeur={telephone(marin.phone)} />
      </Card>

      <Card className="space-y-4">
        <h3 className="text-sm font-semibold text-navy">{t.profil.contact}</h3>

        <InputField
          label={t.inscription.emailFacultatif}
          type="email"
          value={email}
          onChange={(evenement) => setEmail(evenement.target.value)}
        />

        <SelectField
          label={t.profil.fonction}
          value={fonctionId}
          onChange={(evenement) => setFonctionId(evenement.target.value)}
        >
          <option value="">—</option>
          {fonctions?.map((fonction) => (
            <option key={fonction.id} value={fonction.id}>
              {fonction.label}
            </option>
          ))}
        </SelectField>

        {message && <Alerte ton="succes">{message}</Alerte>}
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        <Button pleineLargeur chargement={envoi} onClick={enregistrer}>
          {t.commun.enregistrer}
        </Button>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-navy">{t.profil.notifications}</h3>

        <div className="flex items-center justify-between border-b border-bordure py-3">
          <div>
            <p className="text-sm font-medium text-navy">{t.profil.notifSms}</p>
            <p className="text-xs text-ardoise">{t.profil.notifSmsDetail}</p>
          </div>
          {/* Canal obligatoire : affiché actif et non modifiable */}
          <input type="checkbox" checked readOnly disabled className="h-5 w-5 accent-navy" />
        </div>

        <div className="flex items-center justify-between border-b border-bordure py-3">
          <p className="text-sm font-medium text-navy">{t.profil.notifWhatsapp}</p>
          <input
            type="checkbox"
            checked={marin.preferences.whatsapp}
            onChange={(evenement) => basculerCanal("whatsapp", evenement.target.checked)}
            className="h-5 w-5 accent-orange-ci"
          />
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-navy">{t.profil.notifEmail}</p>
            {!marin.email && <p className="text-xs text-ardoise">{t.profil.emailRequis}</p>}
          </div>
          <input
            type="checkbox"
            disabled={!marin.email}
            checked={marin.preferences.email}
            onChange={(evenement) => basculerCanal("email", evenement.target.checked)}
            className="h-5 w-5 accent-orange-ci"
          />
        </div>
      </Card>

      <Button variante="discret" pleineLargeur onClick={deconnecter}>
        {t.commun.deconnexion}
      </Button>
    </div>
  );
};
