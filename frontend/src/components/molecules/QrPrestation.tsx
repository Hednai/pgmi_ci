// ============================================
// components/molecules/QrPrestation.tsx
// QR code d'une pièce opposable : mouvement vérifié ou relevé délivré.
//
// Le scan vaut original : l'autorité lit le QR et obtient le contenu
// opposable sans papier (R26). La vignette est produite dans le navigateur
// à partir de l'adresse donnée par le serveur, et le code court reste
// lisible dessous : si le rendu échoue, il se saisit à la main.
//
// Le composant ne connaît pas l'objet qu'il atteste, il reçoit le chemin à
// interroger. Les trois routes QR de la plateforme renvoient la même forme.
// ============================================
import { useEffect, useState } from "react";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Card } from "../atoms/Card.js";
import { Button } from "../atoms/Button.js";
import { Alerte, Spinner } from "../atoms/Feedback.js";
import { useQrCode } from "../../hooks/useQrCode.js";

// Forme commune des réponses QR de la plateforme. Les champs de contexte
// diffèrent d'un objet à l'autre, le code et l'adresse ne changent pas.
interface DonneesQrPrestation {
  code: string;
  url: string;
  image: string;
  navire?: string;
  reference?: string;
  jours?: number;
}

interface ProprietesQrPrestation {
  // Route du QR, par exemple /api/releves/me/<id>/qr
  chemin: string;
  instruction: string;
  onFermer: () => void;
}

export function QrPrestation({ chemin, instruction, onFermer }: ProprietesQrPrestation) {
  const [donnees, setDonnees] = useState<DonneesQrPrestation | null>(null);
  const [erreur, setErreur] = useState("");

  // La vignette n'est demandée qu'une fois l'adresse connue.
  const { image, enCours } = useQrCode(donnees ? donnees.url : null);

  useEffect(
    function chargerQr() {
      api
        .get<DonneesQrPrestation>(chemin)
        .then(setDonnees)
        .catch(function (err) {
          setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
        });
    },
    [chemin],
  );

  return (
    <div className="mt-3">
      <Card className="text-center">
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {!erreur && !donnees && (
          <div className="my-8 flex justify-center">
            <Spinner classe="h-8 w-8" />
          </div>
        )}

        {donnees && (
          <>
            {image ? (
              <img src={image} alt="" className="mx-auto my-4 h-56 w-56" />
            ) : enCours ? (
              <div className="my-10 flex justify-center">
                <Spinner classe="h-10 w-10" />
              </div>
            ) : (
              <div className="my-4">
                <Alerte ton="alerte">{t.serviceMer.qr.indisponible}</Alerte>
              </div>
            )}

            <p className="text-xs text-ardoise">{t.serviceMer.qr.codeVerification}</p>
            <p className="matricule text-xl font-bold text-navy">{donnees.code}</p>
            <p className="mt-1 text-xs text-ardoise">
              {donnees.navire ?? donnees.reference}
              {donnees.jours !== undefined ? `, ${donnees.jours} ${t.commun.jours}` : ""}
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-ardoise">{instruction}</p>
          </>
        )}

        <Button variante="secondaire" pleineLargeur className="mt-4" onClick={onFermer}>
          {t.commun.fermer}
        </Button>
      </Card>
    </div>
  );
}