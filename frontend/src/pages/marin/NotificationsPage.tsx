// ============================================
// pages/marin/NotificationsPage.tsx
// Centre de notifications du marin (remarque PGMI-07).
//
// Les messages étaient déjà écrits en base à chaque envoi, sans qu'aucun
// écran ne les montre : il fallait parcourir toute l'application pour
// savoir quoi faire. Ils sont ici en un point unique, les non-lus en tête
// de liste par leur marquage visuel, avec le geste « tout marquer lu ».
// ============================================
import { useCallback, useEffect, useState } from "react";
import { t } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { repartirErreurs } from "../../lib/erreursFormulaire.js";
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { Button } from "../../components/atoms/Button.js";
import { Icone } from "../../components/atoms/Icone.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { EnteteEcran } from "../../components/layouts/EnteteEcran.js";
import { dateCourte } from "../../lib/format.js";
import type { PageNotifications } from "../../types/api.js";

// Libellé lisible d'un canal d'acheminement. Le marin n'a pas à lire
// WHATSAPP en capitales.
const CANAUX: Record<string, string> = {
  SMS: t.notifications.canalSms,
  WHATSAPP: t.notifications.canalWhatsapp,
  EMAIL: t.notifications.canalEmail,
};

export function NotificationsPage() {
  const [page, setPage] = useState<PageNotifications | null>(null);
  const [erreur, setErreur] = useState("");
  const [action, setAction] = useState(false);

  const rafraichir = useCallback(function () {
    return api
      .get<PageNotifications>("/api/marins/me/notifications")
      .then(setPage)
      .catch(function (err) {
        setErreur(repartirErreurs(err, t.commun.erreurReseau).global);
      });
  }, []);

  useEffect(function chargerMessages() {
    void rafraichir();
  }, [rafraichir]);

  // Marquer un message lu ne doit pas faire disparaître la ligne : le marin
  // vient de la lire, la voir sauter sous ses yeux serait déroutant. Seul
  // le marquage visuel change.
  async function marquerLu(notificationId: string) {
    setErreur("");
    try {
      await api.post(`/api/marins/me/notifications/${notificationId}/lecture`);
      await rafraichir();
    } catch (err) {
      setErreur(repartirErreurs(err, t.commun.erreurReseau).global);
    }
  }

  async function toutMarquerLu() {
    setErreur("");
    setAction(true);
    try {
      await api.post("/api/marins/me/notifications/lecture");
      await rafraichir();
    } catch (err) {
      setErreur(repartirErreurs(err, t.commun.erreurReseau).global);
    } finally {
      setAction(false);
    }
  }

  if (!page) return <ChargementPage />;

  return (
    <div>
      <EnteteEcran titre={t.notifications.titre}>
        <p className="text-xs text-white/80">
          {page.nonLus > 0
            ? `${page.nonLus} ${t.notifications.nonLus}`
            : t.notifications.toutLu}
        </p>
      </EnteteEcran>

      <div className="space-y-3">
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {page.nonLus > 0 && (
          <Button variante="discret" pleineLargeur chargement={action} onClick={toutMarquerLu}>
            {t.notifications.toutMarquerLu}
          </Button>
        )}

        {page.items.length === 0 ? (
          <EtatVide message={t.notifications.aucune} />
        ) : (
          page.items.map(function afficherMessage(message) {
            return (
              <Card
                key={message.id}
                className={message.lu ? "" : "border-[1.5px] border-orange-ci bg-alerte-soft/30"}
              >
                <div className="flex items-start gap-3">
                  {/* Pastille de non-lu : le repère se voit sans lire. */}
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${message.lu ? "bg-bordure" : "bg-orange-ci"}`}
                    aria-hidden="true"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-navy">{message.contenu}</p>

                    <p className="mt-1 text-[11px] text-ardoise">
                      {dateCourte(message.creeLe)}
                      {message.canaux.length > 0 && ", "}
                      {message.canaux
                        .map(function (canal) { return CANAUX[canal] ?? canal; })
                        .join(", ")}
                    </p>

                    {!message.lu && (
                      <button
                        type="button"
                        onClick={function () { void marquerLu(message.id); }}
                        className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-navy hover:underline"
                      >
                        <Icone nom="valide" taille={13} />
                        {t.notifications.marquerLu}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}