// ============================================
// pages/agent/TableauBordAgentPage.tsx
// Tableau de bord du poste agent DGAM.
//
// La lecture se fait de haut en bas : volumétrie du registre, files de
// travail du jour, puis traçabilité. Chaque indicateur est cliquable et
// mène directement à la file correspondante.
// ============================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { useAuthStore } from "../../stores/authStore.js";
import { Card, SectionTitre } from "../../components/atoms/Card.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Icone } from "../../components/atoms/Icone.js";
import type { NomIcone } from "../../components/atoms/Icone.js";
import { dateCourte, initiales } from "../../lib/format.js";
import type { Demande, Pagine, SyntheseAgent } from "../../types/api.js";

// Carte d'indicateur principale de la bande supérieure.
interface ProprietesIndicateur {
  valeur: number | string;
  libelle: string;
  detail?: string;
  icone: NomIcone;
  // Couleur du chiffre et de la pastille, portant le niveau d'urgence
  teinte: "navy" | "orange" | "erreur" | "teal";
  onClick?: () => void;
}

// Correspondance entre la teinte d'un indicateur et ses classes d'affichage.
const TEINTES_INDICATEUR = {
  navy: { chiffre: "text-navy", pastille: "bg-navy-soft text-navy", detail: "text-succes" },
  orange: {
    chiffre: "text-orange-ci",
    pastille: "bg-alerte-soft text-orange-ci",
    detail: "text-orange-ci",
  },
  erreur: { chiffre: "text-erreur", pastille: "bg-erreur-soft text-erreur", detail: "text-erreur" },
  teal: {
    chiffre: "text-teal-sea",
    pastille: "bg-succes-soft text-teal-sea",
    detail: "text-teal-sea",
  },
};

function Indicateur({ valeur, libelle, detail, icone, teinte, onClick }: ProprietesIndicateur) {
  const couleurs = TEINTES_INDICATEUR[teinte];

  const contenu = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-ardoise">{libelle}</span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${couleurs.pastille}`}
        >
          <Icone nom={icone} taille={16} />
        </span>
      </div>

      <p className={`mt-2 font-titre text-3xl font-bold ${couleurs.chiffre}`}>{valeur}</p>
      {detail && <p className={`mt-1 text-[11px] font-medium ${couleurs.detail}`}>{detail}</p>}
    </>
  );

  const classes = "rounded-carte border border-bordure bg-white px-5 py-4 text-left";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${classes} transition-shadow hover:shadow-md`}
      >
        {contenu}
      </button>
    );
  }

  return <div className={classes}>{contenu}</div>;
}

export function TableauBordAgentPage() {
  const [synthese, setSynthese] = useState<SyntheseAgent | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [erreur, setErreur] = useState("");
  const agent = useAuthStore(function (etat) {
    return etat.agent;
  });
  const naviguer = useNavigate();

  useEffect(function chargerTableauBord() {
    api
      .get<SyntheseAgent>("/api/dashboard")
      .then(setSynthese)
      .catch(function () {
        setErreur(t.commun.erreurReseau);
      });

    // Les demandes récentes complètent le tableau sans le bloquer.
    api
      .get<Pagine<Demande>>("/api/demandes")
      .then(function (page) {
        setDemandes(page.items);
      })
      .catch(function () {
        setDemandes([]);
      });
  }, []);

  if (erreur) {
    return <Alerte ton="erreur">{erreur}</Alerte>;
  }

  if (!synthese) {
    return <ChargementPage />;
  }

  const stats = synthese.statistiques;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-titre text-2xl font-bold text-navy">
          {t.agent.bienvenue} {agent ? agent.firstName : ""}
        </h1>
        <p className="text-sm text-ardoise">
          {agent ? agent.roleLabel : ""}
          {agent && agent.authority.name ? `, ${agent.authority.name}` : ""}
        </p>
      </div>

      {/* Volumétrie du registre national */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicateur
          valeur={stats.marinsActifs.toLocaleString("fr-FR")}
          libelle={t.agent.marinsActifs}
          detail={`+${stats.marinsEnAttente} ${t.agent.nouveauxCeMois}`}
          icone="marins"
          teinte="navy"
          onClick={function () {
            naviguer("/agent/marins");
          }}
        />
        <Indicateur
          valeur={stats.demandesAInstruire}
          libelle={t.agent.demandesAInstruire}
          detail={`${stats.mesDossiers} ${t.agent.mesDossiers.toLowerCase()}`}
          icone="demandes"
          teinte="orange"
          onClick={function () {
            naviguer("/agent/demandes");
          }}
        />
        <Indicateur
          valeur={stats.certificatsExpires}
          libelle={t.agent.certificatsExpires}
          detail={`${stats.certificatsBientotExpires} ${t.agent.sousQuatreVingtDix}`}
          icone="alerte"
          teinte="erreur"
        />
        <Indicateur
          valeur={stats.verificationsDuJour}
          libelle={t.agent.verificationsDuJour}
          icone="qrCode"
          teinte="teal"
        />
      </div>

      {/* Files de travail immédiates de l'agent */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Indicateur
          valeur={stats.documentsAVerifier}
          libelle={t.agent.documentsAVerifier}
          icone="documents"
          teinte="navy"
          onClick={function () {
            naviguer("/agent/verifications");
          }}
        />
        <Indicateur
          valeur={stats.embarquementsAVerifier}
          libelle={t.agent.embarquementsAVerifier}
          icone="serviceMer"
          teinte="navy"
          onClick={function () {
            naviguer("/agent/verifications");
          }}
        />
        <Indicateur
          valeur={stats.marinsEnAttente}
          libelle={t.agent.marinsEnAttente}
          icone="dossier"
          teinte="orange"
          onClick={function () {
            naviguer("/agent/marins");
          }}
        />
      </div>

      {/* Demandes récentes, toutes files confondues */}
      <section>
        <SectionTitre titre={t.agent.demandesRecentes} />
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-bordure bg-fond text-left">
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ardoise">
                  {t.agent.marin}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ardoise">
                  {t.agent.nature}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ardoise">
                  {t.agent.statut}
                </th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ardoise">
                  {t.agent.depot}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure">
              {demandes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-ardoise">
                    {t.agent.aucuneDemande}
                  </td>
                </tr>
              )}

              {demandes.map(function afficherLigne(demande) {
                return (
                  <tr
                    key={demande.id}
                    className="cursor-pointer transition-colors hover:bg-fond"
                    onClick={function () {
                      naviguer("/agent/demandes");
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[9px] font-bold text-white">
                          {initiales(demande.marin ? demande.marin.fullName : "")}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-navy">
                            {demande.marin ? demande.marin.fullName : ""}
                          </p>
                          <p className="matricule text-[10px] text-ardoise">
                            {demande.marin?.matricule ?? demande.reference}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-navy/80">{demande.certificateType.label}</td>
                    <td className="px-4 py-3">
                      <BadgeStatut statut={demande.status} />
                    </td>
                    <td className="px-4 py-3 text-ardoise">{dateCourte(demande.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </section>

      {/* Journal des dernières actions, lecture seule et immuable */}
      <section>
        <SectionTitre titre={t.agent.activiteRecente} />
        <Card className="divide-y divide-bordure p-0">
          {synthese.activite.map(function afficherEntree(entree) {
            return (
              <div key={entree.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-navy">
                    {t.journal.actions[entree.action] ?? entree.action}
                  </p>
                  <p className="truncate text-xs text-ardoise">
                    {entree.actorLabel ?? "Système"}
                    {entree.targetType ? `, ${entree.targetType}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-ardoise">{dateCourte(entree.createdAt)}</span>
              </div>
            );
          })}
        </Card>
      </section>
    </div>
  );
}
