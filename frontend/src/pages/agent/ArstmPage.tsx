// ============================================
// pages/agent/ArstmPage.tsx
// Espace ARSTM : file d'attente par module, sessions, inscription des
// élèves navigants.
//
// C'est l'écran qui matérialise l'apport du partenariat : l'institut voit
// la demande de formation se constituer avant même qu'un marin n'appelle.
// ============================================
import { useEffect, useState } from "react";
import { t, libelle } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card, EtatVide, SectionTitre } from "../../components/atoms/Card.js";
import { StatCard } from "../../components/molecules/StatCard.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField, SelectField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage, Progression } from "../../components/atoms/Feedback.js";
import { dateCourte } from "../../lib/format.js";
import type { Pagine, SessionFormation, SyntheseArstm } from "../../types/api.js";

type Onglet = "file" | "sessions" | "eleves";

export const ArstmPage = () => {
  const [onglet, setOnglet] = useState<Onglet>("file");
  const [synthese, setSynthese] = useState<SyntheseArstm | null>(null);
  const [sessions, setSessions] = useState<Pagine<SessionFormation> | null>(null);
  const [erreur, setErreur] = useState("");
  const [action, setAction] = useState(false);

  const { certificats, charger: chargerReferentiels } = useReferentielStore();

  // Ouverture d'une session
  const [nouvelleSession, setNouvelleSession] = useState({
    certificateTypeId: "",
    capacity: 20,
    minQuorum: 5,
  });

  // Programmation d'une session dont le quorum est atteint
  const [planification, setPlanification] = useState({
    sessionId: "",
    startDate: "",
    endDate: "",
    location: "",
    trainer: "",
  });

  // Inscription d'un élève navigant (module C)
  const [eleve, setEleve] = useState({
    phone: "+225",
    firstName: "",
    lastName: "",
    birthDate: "",
    birthPlace: "",
    idNumber: "",
    identityCheck: "",
  });

  const charger = async () => {
    const [donnees, listeSessions] = await Promise.all([
      api.get<SyntheseArstm>("/api/formations/synthese"),
      api.get<Pagine<SessionFormation>>("/api/formations/sessions"),
    ]);
    setSynthese(donnees);
    setSessions(listeSessions);
  };

  useEffect(() => {
    void chargerReferentiels();
    charger().catch(() => setErreur(t.commun.erreurReseau));
  }, [chargerReferentiels]);

  const gererErreur = (err: unknown) =>
    setErreur(
      err instanceof ErreurApi
        ? `${err.message}${err.regle ? ` (${err.regle})` : ""}`
        : t.commun.erreurReseau,
    );

  const ouvrirSession = async () => {
    setErreur("");
    setAction(true);
    try {
      await api.post("/api/formations/sessions", nouvelleSession);
      setNouvelleSession({ certificateTypeId: "", capacity: 20, minQuorum: 5 });
      await charger();
    } catch (err) {
      gererErreur(err);
    } finally {
      setAction(false);
    }
  };

  const planifier = async () => {
    setErreur("");
    setAction(true);
    try {
      const { sessionId, ...donnees } = planification;
      await api.post(`/api/formations/sessions/${sessionId}/planification`, donnees);
      setPlanification({ sessionId: "", startDate: "", endDate: "", location: "", trainer: "" });
      await charger();
    } catch (err) {
      gererErreur(err);
    } finally {
      setAction(false);
    }
  };

  const inscrireEleve = async () => {
    setErreur("");
    setAction(true);
    try {
      await api.post("/api/marins/eleves", eleve);
      setEleve({
        phone: "+225",
        firstName: "",
        lastName: "",
        birthDate: "",
        birthPlace: "",
        idNumber: "",
        identityCheck: "",
      });
      await charger();
    } catch (err) {
      gererErreur(err);
    } finally {
      setAction(false);
    }
  };

  if (!synthese || !sessions) return <ChargementPage />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-titre text-xl font-bold text-navy">{t.arstm.titre}</h1>
        <p className="text-sm text-ardoise">{t.arstm.sousTitre}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          valeur={synthese.sessionsAttente}
          libelle={t.arstm.sessionsAttente}
          ton="alerte"
        />
        <StatCard
          valeur={synthese.sessionsProgrammees}
          libelle={t.arstm.sessionsProgrammees}
          ton="succes"
        />
        <StatCard
          valeur={synthese.inscriptionsEnAttente}
          libelle={t.arstm.inscriptionsEnAttente}
        />
        <StatCard
          valeur={synthese.elevesEnAttenteValidation}
          libelle={t.arstm.elevesEnAttente}
          ton="alerte"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["file", t.arstm.fileAttente],
            ["sessions", t.formations.sessionsOuvertes],
            ["eleves", t.arstm.inscrireEleve],
          ] as [Onglet, string][]
        ).map(([cle, texte]) => (
          <button
            key={cle}
            type="button"
            onClick={() => setOnglet(cle)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${onglet === cle ? "bg-navy text-white" : "bg-white text-ardoise"}`}
          >
            {texte}
          </button>
        ))}
      </div>

      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      {onglet === "file" && (
        <section className="space-y-2">
          {synthese.fileAttente.length === 0 ? (
            <EtatVide message={t.commun.aucunResultat} />
          ) : (
            synthese.fileAttente.map((ligne) => (
              <Card key={ligne.certificateTypeId} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">{ligne.label}</p>
                    <p className="matricule mt-0.5 text-xs text-ardoise">{ligne.code}</p>
                  </div>
                  <span className="shrink-0 font-titre text-xl font-bold text-orange-ci">
                    {ligne.enAttente}
                  </span>
                </div>

                <p className="text-xs text-ardoise">
                  {ligne.enAttente} {t.arstm.marinsEnAttente}, {ligne.proposesNonRepondus}{" "}
                  {libelle(t.formations.statut, "PROPOSED").toLowerCase()}
                </p>

                {/* Progression vers le quorum type : visuel immédiat de la
                    possibilité d'ouvrir un groupe. */}
                <Progression
                  valeur={Math.min((ligne.enAttente / 5) * 100, 100)}
                  etiquette={t.arstm.quorum}
                />
              </Card>
            ))
          )}
        </section>
      )}

      {onglet === "sessions" && (
        <section className="space-y-4">
          <Card className="space-y-3">
            <h3 className="text-sm font-semibold text-navy">{t.arstm.ouvrirSession}</h3>

            <SelectField
              label={t.arstm.module}
              value={nouvelleSession.certificateTypeId}
              onChange={(evenement) =>
                setNouvelleSession((precedent) => ({
                  ...precedent,
                  certificateTypeId: evenement.target.value,
                }))
              }
            >
              <option value="">—</option>
              {certificats
                ?.filter((certificat) => certificat.requiresTraining)
                .map((certificat) => (
                  <option key={certificat.id} value={certificat.id}>
                    {certificat.label}
                  </option>
                ))}
            </SelectField>

            <div className="grid grid-cols-2 gap-3">
              <InputField
                label={t.arstm.capacite}
                type="number"
                min={1}
                value={nouvelleSession.capacity}
                onChange={(evenement) =>
                  setNouvelleSession((precedent) => ({
                    ...precedent,
                    capacity: Number(evenement.target.value),
                  }))
                }
              />
              <InputField
                label={t.arstm.quorum}
                type="number"
                min={1}
                value={nouvelleSession.minQuorum}
                onChange={(evenement) =>
                  setNouvelleSession((precedent) => ({
                    ...precedent,
                    minQuorum: Number(evenement.target.value),
                  }))
                }
              />
            </div>

            <Button
              pleineLargeur
              chargement={action}
              disabled={!nouvelleSession.certificateTypeId}
              onClick={ouvrirSession}
            >
              {t.arstm.ouvrirSession}
            </Button>
          </Card>

          {sessions.items.map((session) => {
            const quorum = session.quorum;
            return (
              <Card key={session.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">
                      {session.certificateType.label}
                    </p>
                    <p className="matricule mt-0.5 text-xs text-ardoise">{session.code}</p>
                  </div>
                  <BadgeStatut
                    statut={session.status}
                    libelle={libelle(t.formations.statutSession, session.status)}
                  />
                </div>

                {quorum && (
                  <>
                    <Progression
                      valeur={Math.min((quorum.confirmes / quorum.requis) * 100, 100)}
                      etiquette={`${quorum.confirmes} / ${quorum.requis} ${t.formations.inscrits}`}
                    />
                    {!quorum.atteint && (
                      <Alerte ton="alerte" titre={t.arstm.quorumNonAtteint}>
                        {t.arstm.quorumAide}
                      </Alerte>
                    )}
                  </>
                )}

                {session.startDate && (
                  <p className="text-xs text-ardoise">
                    {dateCourte(session.startDate)} → {dateCourte(session.endDate)} ·{" "}
                    {session.location}
                  </p>
                )}

                {quorum?.atteint && session.status === "WAITING_FOR_QUORUM" && (
                  <Button
                    taille="sm"
                    pleineLargeur
                    onClick={() =>
                      setPlanification((precedent) => ({ ...precedent, sessionId: session.id }))
                    }
                  >
                    {t.arstm.planifier}
                  </Button>
                )}
              </Card>
            );
          })}

          {planification.sessionId && (
            <Card className="space-y-3">
              <h3 className="text-sm font-semibold text-navy">{t.arstm.planifier}</h3>

              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label={t.serviceMer.debut}
                  type="date"
                  value={planification.startDate}
                  onChange={(evenement) =>
                    setPlanification((precedent) => ({
                      ...precedent,
                      startDate: evenement.target.value,
                    }))
                  }
                />
                <InputField
                  label={t.serviceMer.fin}
                  type="date"
                  value={planification.endDate}
                  onChange={(evenement) =>
                    setPlanification((precedent) => ({
                      ...precedent,
                      endDate: evenement.target.value,
                    }))
                  }
                />
              </div>

              <InputField
                label={t.formations.lieu}
                value={planification.location}
                onChange={(evenement) =>
                  setPlanification((precedent) => ({
                    ...precedent,
                    location: evenement.target.value,
                  }))
                }
              />
              <InputField
                label={t.formations.formateur}
                value={planification.trainer}
                onChange={(evenement) =>
                  setPlanification((precedent) => ({
                    ...precedent,
                    trainer: evenement.target.value,
                  }))
                }
              />

              <Button
                pleineLargeur
                chargement={action}
                disabled={
                  !planification.startDate || !planification.location || !planification.trainer
                }
                onClick={planifier}
              >
                {t.commun.confirmer}
              </Button>
            </Card>
          )}
        </section>
      )}

      {onglet === "eleves" && (
        <Card className="space-y-4">
          <SectionTitre titre={t.arstm.inscrireEleve} />
          <Alerte ton="info">{t.arstm.inscrireEleveDetail}</Alerte>

          <InputField
            label={t.auth.telephone}
            type="tel"
            value={eleve.phone}
            onChange={(evenement) =>
              setEleve((precedent) => ({ ...precedent, phone: evenement.target.value }))
            }
            obligatoire
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <InputField
              label={t.inscription.prenom}
              value={eleve.firstName}
              onChange={(evenement) =>
                setEleve((precedent) => ({ ...precedent, firstName: evenement.target.value }))
              }
              obligatoire
            />
            <InputField
              label={t.inscription.nom}
              value={eleve.lastName}
              onChange={(evenement) =>
                setEleve((precedent) => ({ ...precedent, lastName: evenement.target.value }))
              }
              obligatoire
            />
            <InputField
              label={t.inscription.dateNaissance}
              type="date"
              value={eleve.birthDate}
              onChange={(evenement) =>
                setEleve((precedent) => ({ ...precedent, birthDate: evenement.target.value }))
              }
              obligatoire
            />
            <InputField
              label={t.inscription.lieuNaissance}
              value={eleve.birthPlace}
              onChange={(evenement) =>
                setEleve((precedent) => ({ ...precedent, birthPlace: evenement.target.value }))
              }
              obligatoire
            />
          </div>

          <InputField
            label={t.inscription.piece}
            value={eleve.idNumber}
            onChange={(evenement) =>
              setEleve((precedent) => ({ ...precedent, idNumber: evenement.target.value }))
            }
            obligatoire
          />
          <InputField
            label={t.agent.pieceVerifiee}
            value={eleve.identityCheck}
            onChange={(evenement) =>
              setEleve((precedent) => ({ ...precedent, identityCheck: evenement.target.value }))
            }
            obligatoire
          />

          <Button
            pleineLargeur
            chargement={action}
            disabled={!eleve.firstName || !eleve.lastName || eleve.identityCheck.length < 3}
            onClick={inscrireEleve}
          >
            {t.arstm.inscrireEleve}
          </Button>
        </Card>
      )}
    </div>
  );
};
