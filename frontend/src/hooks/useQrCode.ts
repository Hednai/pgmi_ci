// ============================================
// hooks/useQrCode.ts
// Génère un QR code en data URL à partir d'un contenu textuel.
//
// La vignette est produite dans le navigateur, à partir de l'adresse que
// le serveur a donnée. L'écran ne dépend donc plus d'une image renvoyée
// par l'API : quand celle-ci manquait, le QR tournait indéfiniment sans
// qu'aucun message n'explique pourquoi.
//
// Le code de vérification reste lisible sous la vignette : si le rendu
// échoue, l'inspecteur peut toujours saisir le code à la main.
// ============================================
import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Couleurs navy PGMI pour un QR lisible par les scanners d'entrée de gamme
const OPTIONS_QR: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: "M", // niveau M : résiste aux petites dégradations (poussière, rayures)
  margin: 1,                 // zone blanche autour du QR, requis pour la lisibilité
  width: 320,
  color: {
    dark: "#1B2A4A",         // modules sombres : couleur navy PGMI
    light: "#FFFFFF",        // fond blanc
  },
};

// État du rendu, pour que l'écran distingue l'attente de l'échec.
export interface EtatQrCode {
  image: string | null;
  // Vrai pendant la génération, faux dès qu'elle aboutit ou échoue
  enCours: boolean;
  // Vrai si la vignette n'a pas pu être produite
  echec: boolean;
}

// Retourne la vignette du contenu fourni. Un contenu nul laisse l'état au
// repos : ce n'est pas une attente, il n'y a simplement rien à produire.
export function useQrCode(contenu: string | null): EtatQrCode {
  const [etat, setEtat] = useState<EtatQrCode>({
    image: null,
    enCours: false,
    echec: false,
  });

  useEffect(
    function genererQr() {
      if (!contenu) {
        setEtat({ image: null, enCours: false, echec: false });
        return;
      }

      // Le rendu suivant ne doit pas écraser un rendu plus récent si le
      // contenu change pendant la génération.
      let vivant = true;
      setEtat({ image: null, enCours: true, echec: false });

      QRCode.toDataURL(contenu, OPTIONS_QR)
        .then(function (dataUrl) {
          if (vivant) setEtat({ image: dataUrl, enCours: false, echec: false });
        })
        .catch(function () {
          if (vivant) setEtat({ image: null, enCours: false, echec: true });
        });

      return function annuler() {
        vivant = false;
      };
    },
    [contenu],
  );

  return etat;
}