// ============================================
// molecules/PhotoProfil.tsx
// Dépôt, remplacement et suppression de la photo du marin.
//
// Le composant ne connaît ni l'écran qui l'accueille ni la mise en page :
// il reçoit le marin courant et remonte le dossier mis à jour.
// ============================================
import { useRef, useState } from "react";
import { t } from "../../i18n/index.js";
import { api, lireFichier, ErreurApi } from "../../lib/apiClient.js";
import { Button } from "../atoms/Button.js";
import { Alerte } from "../atoms/Feedback.js";
import { Icone } from "../atoms/Icone.js";
import type { Marin } from "../../types/api.js";

// Formats et taille acceptés, alignés sur le contrôle du serveur
const FORMATS_ACCEPTES = "image/jpeg,image/png,image/webp";
const TAILLE_MAX_OCTETS = 2 * 1024 * 1024;

interface ProprietesPhotoProfil {
  marin: Marin;
  // Appelé avec le dossier à jour après dépôt ou suppression
  surChangement: (marin: Marin) => void;
}

export function PhotoProfil({ marin, surChangement }: ProprietesPhotoProfil) {
  const champFichier = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  // Contrôle local avant l'envoi : inutile de faire monter deux mégaoctets
  // sur une connexion mobile pour recevoir un refus.
  async function deposer(fichier: File) {
    setErreur("");

    if (fichier.size > TAILLE_MAX_OCTETS) {
      setErreur(t.profil.photoTropLourde);
      return;
    }

    setChargement(true);
    try {
      const charge = await lireFichier(fichier);
      const actualise = await api.post<Marin>("/api/marins/me/photo", { fichier: charge });
      surChangement(actualise);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setChargement(false);
      if (champFichier.current) champFichier.current.value = "";
    }
  }

  async function supprimer() {
    setErreur("");
    setChargement(true);
    try {
      const actualise = await api.delete<Marin>("/api/marins/me/photo");
      surChangement(actualise);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {marin.photoUrl ? (
          <img
            src={marin.photoUrl}
            alt={t.profil.photoAlternative}
            className="h-20 w-20 shrink-0 rounded-xl border border-bordure object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed border-bordure bg-fond text-ardoise">
            <Icone nom="profil" taille={28} />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-navy">{t.profil.photoTitre}</p>
          <p className="mt-0.5 text-xs text-ardoise">{t.profil.photoAide}</p>
        </div>
      </div>

      {/* Le champ natif reste masqué : le bouton pilote l'ouverture du
          sélecteur, ce qui permet de garder le style de l'application. */}
      <input
        ref={champFichier}
        type="file"
        accept={FORMATS_ACCEPTES}
        className="hidden"
        onChange={function (evenement) {
          const fichier = evenement.target.files?.[0];
          if (fichier) void deposer(fichier);
        }}
      />

      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      <div className="flex gap-2">
        <Button
          variante="secondaire"
          chargement={chargement}
          onClick={function () {
            champFichier.current?.click();
          }}
        >
          {marin.photoUrl ? t.profil.photoRemplacer : t.profil.photoAjouter}
        </Button>

        {marin.photoUrl && (
          <Button variante="danger" disabled={chargement} onClick={supprimer}>
            {t.profil.photoSupprimer}
          </Button>
        )}
      </div>
    </div>
  );
}