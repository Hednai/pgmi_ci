// ============================================
// pages/marin/FormationsPage.tsx
// Formations ARSTM côté marin : propositions reçues, inscriptions en cours,
// sessions ouvertes.
//
// La proposition automatique du scan d'expiration (module B) arrive ici :
// le marin répond en une touche, sans formulaire.
// ============================================
import { useEffect, useState } from "react";
import { t, libelle } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Card, SectionTitre, EtatVide } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { dateCourte } from "../../lib/format.js";
import type { InscriptionFormation, SessionFormation } from "../../types/api.js";

export const FormationsPage = () => {
  const [inscriptions, setInscriptions] = useState<InscriptionFormation[] | null>(null);
  const [sessions, setSessions] = useState<SessionFormation[]>([]);
  const [erreur, setErreur] = useState("");
  const [action, setAction] = useState<string | null>(null);

  const rafraichir = async () => {
    const [mesInscriptions, ouvertes] = await Promise.all([
      api.get<InscriptionFormation[]>("/api/formations/me"),
      api.get<SessionFormation[]>("/api/formations/sessions-ouvertes"),
    ]);
    setInscriptions(mesInscriptions);
    setSessions(ouvertes);
  };

  useEffect(() => {
    rafraichir().catch(() => setErreur(t.commun.erreurReseau));
  }, []);

  const repondre = async (inscriptionId: string, accepte: boolean) => {
    setAction(inscriptionId);
    setErreur("");
    try {
      await api.post(`/api/formations/me/${inscriptionId}/reponse`, { accepte });
      await rafraichir();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setAction(null);
    }
  };

  const sInscrire = async (session: SessionFormation) => {
    setAction(session.id);
    setErreur("");
    try {
      await api.post("/api/formations/me", {
        certificateTypeId: session.certificateType.id,
        sessionId: session.id,
      });
      await rafraichir();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setAction(null);
    }
  };

  if (!inscriptions) return <ChargementPage />;

  const propositions = inscriptions.filter((inscription) => inscription.status === "PROPOSED");
  const encours = inscriptions.filter((inscription) => inscription.status !== "PROPOSED");

  return (
    <div className="space-y-5">
      <div>
        <SectionTitre titre={t.formations.titre} />
        <p className="-mt-2 text-sm text-ardoise">{t.formations.sousTitre}</p>
      </div>

      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      {propositions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-navy">{t.formations.proposition}</h3>
          {propositions.map((inscription) => (
            <Card key={inscription.id} className="border-orange-ci/40 bg-alerte-soft">
              <p className="text-sm font-semibold text-navy">
                {inscription.certificateType.label}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ardoise">
                {t.formations.propositionDetail}
              </p>

              <div className="mt-3 flex gap-2">
                <Button
                  taille="sm"
                  chargement={action === inscription.id}
                  onClick={() => repondre(inscription.id, true)}
                >
                  {t.formations.accepter}
                </Button>
                <Button
                  taille="sm"
                  variante="discret"
                  onClick={() => repondre(inscription.id, false)}
                >
                  {t.formations.refuser}
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-navy">{t.formations.mesInscriptions}</h3>
        {encours.length === 0 ? (
          <EtatVide message={t.formations.aucune} />
        ) : (
          encours.map((inscription) => (
            <Card key={inscription.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-navy">
                    {inscription.certificateType.label}
                  </p>
                  {inscription.session?.startDate ? (
                    <p className="mt-0.5 text-xs text-ardoise">
                      {dateCourte(inscription.session.startDate)} →{" "}
                      {dateCourte(inscription.session.endDate)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-ardoise">{t.formations.enAttenteGroupe}</p>
                  )}
                  {inscription.session?.location && (
                    <p className="mt-0.5 text-xs text-ardoise">
                      {t.formations.lieu} : {inscription.session.location}
                    </p>
                  )}
                </div>
                <BadgeStatut
                  statut={inscription.status}
                  libelle={libelle(t.formations.statut, inscription.status)}
                />
              </div>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-navy">{t.formations.sessionsOuvertes}</h3>
        {sessions.length === 0 ? (
          <EtatVide message={t.commun.aucunResultat} />
        ) : (
          sessions.map((session) => {
            const inscrits = session._count?.enrollments ?? 0;
            return (
              <Card key={session.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">
                      {session.certificateType.label}
                    </p>
                    <p className="mt-0.5 text-xs text-ardoise">
                      {session.startDate
                        ? `${dateCourte(session.startDate)} → ${dateCourte(session.endDate)}`
                        : t.formations.enAttenteGroupe}
                    </p>
                    <p className="mt-0.5 text-xs text-ardoise">
                      {inscrits} {t.formations.inscrits}, {session.minQuorum}{" "}
                      {t.formations.requis}
                    </p>
                  </div>
                  <BadgeStatut
                    statut={session.status}
                    libelle={libelle(t.formations.statutSession, session.status)}
                  />
                </div>

                <Button
                  taille="sm"
                  variante="discret"
                  pleineLargeur
                  className="mt-3"
                  chargement={action === session.id}
                  onClick={() => sInscrire(session)}
                >
                  {t.formations.sInscrire}
                </Button>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
};
