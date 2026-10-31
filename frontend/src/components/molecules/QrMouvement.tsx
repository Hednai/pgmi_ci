// ============================================
// components/molecules/QrMouvement.tsx
// QR code d'un mouvement vérifié, présenté au contrôle.
//
// Le scan vaut original : un inspecteur au port lit le QR et obtient le
// navire, la période et les jours comptabilisés sans que le marin ait à
// sortir un papier (R26).
//
// La vignette est produite dans le navigateur à partir de l'adresse donnée
// par le serveur, comme pour un document. Le code court reste lisible
// dessous : si le rendu échoue, l'inspecteur le saisit à la main.
// ============================================
import { useEffect, useState } from "react";
import { t } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Card } from "../atoms/Card.js";
import { Button } from "../atoms/Button.js";
import { Alerte, Spinner } from "../atoms/Feedback.js";
import { useQrCode } from "../../hooks/useQrCode.js";

// Réponse de GET /api/sea-service/me/:id/qr
interface DonneesQrMouvement {
  code: string;
  url: string;
  image: string;
  navire: string;
  jours: number;
}

interface ProprietesQrMouvement {
  embarquementId: string;
  onFermer: () => void;
}

export function QrMouvement({ embarquementId, onFermer }: ProprietesQrMouvement) {
  const [donnees, setDonnees] = useState<DonneesQrMouvement | null>(null);
  const [erreur, setErreur] = useState("");

  // La vignette n'est demandée qu'une fois l'adresse connue.
  const { image, enCours } = useQrCode(donnees ? donnees.url : null);

  useEffect(
    function chargerQr() {
      api
        .get<DonneesQrMouvement>(`/api/sea-service/me/${embarquementId}/qr`)
        .then(setDonnees)
        .catch(function (err) {
          setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
        });
    },
    [embarquementId],
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
              {donnees.navire}, {donnees.jours} {t.commun.jours}
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-ardoise">
              {t.serviceMer.qr.instruction}
            </p>
          </>
        )}

        <Button variante="secondaire" pleineLargeur className="mt-4" onClick={onFermer}>
          {t.commun.fermer}
        </Button>
      </Card>
    </div>
  );
}