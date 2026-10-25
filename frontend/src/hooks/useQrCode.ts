// ============================================
// hooks/useQrCode.ts
// Génère un QR code en data URL à partir d'un contenu textuel.
// Utilise la lib qrcode côté client pour un rendu immédiat
// sans appel réseau au backend.
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

// Retourne la data URL de l'image QR, ou null si le contenu est absent.
// Le recalcul n'a lieu que si contenu change.
export function useQrCode(contenu: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(
    function genererQr() {
      if (!contenu) {
        setDataUrl(null);
        return;
      }
      void QRCode.toDataURL(contenu, OPTIONS_QR).then(setDataUrl);
    },
    [contenu],
  );

  return dataUrl;
}