// ============================================
// pages/marin/ConformitePage.tsx
// Checklist de conformité par brevet.
//
// Chaque prérequis porte sa propre couleur d'état : le marin voit ce qui
// est acquis, ce qui expire et ce qui manque sans avoir à lire un tableau.
// L'avertissement du moteur est affiché tel qu'il vient du serveur : cette
// page informe et ne décide pas (R13).
// ============================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { EtatVide } from "../../components/atoms/Card.js";
import { Icone } from "../../components/atoms/Icone.js";
import type { NomIcone } from "../../components/atoms/Icone.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { EnteteEcran } from "../../components/layouts/EnteteEcran.js";
import { dateCourte } from "../../lib/format.js";
import type { LignePrerequis, RapportConformite } from "../../types/api.js";

// Apparence d'une ligne selon son état, déclarée une fois pour que les
// quatre cas restent cohérents entre eux.
interface ApparenceEtat {
  carte: string;
  pastille: string;
  texte: string;
  icone: NomIcone;
}

const APPARENCES: Record<string, ApparenceEtat> = {
  VALIDE: {
    carte: "border-succes/30 bg-succes-soft/40",
    pastille: "bg-teal-sea text-white",
    texte: "text-teal-sea",
    icone: "valide",
  },
  BIENTOT_EXPIRE: {
    carte: "border-[1.5px] border-orange-ci bg-alerte-soft/50",
    pastille: "bg-alerte-soft text-orange-ci",
    texte: "text-orange-ci",
    icone: "alerte",
  },
  EXPIRE: {
    carte: "border-[1.5px] border-erreur bg-erreur-soft/50",
    pastille: "bg-erreur text-white",
    texte: "text-erreur",
    icone: "manquant",
  },
  MANQUANT: {
    carte: "border-[1.5px] border-erreur bg-erreur-soft/50",
    pastille: "bg-erreur text-white",
    texte: "text-erreur",
    icone: "manquant",
  },
  INSUFFISANT: {
    carte: "border-[1.5px] border-orange-ci bg-alerte-soft/50",
    pastille: "bg-alerte-soft text-orange-ci",
    texte: "text-orange-ci",
    icone: "alerte",
  },
  EN_ATTENTE: {
    carte: "border-bordure bg-white",
    pastille: "bg-navy-soft text-navy-light",
    texte: "text-navy-light",
    icone: "neutre",
  },
};

function apparenceDe(etat: string): ApparenceEtat {
  return APPARENCES[etat] ?? APPARENCES.EN_ATTENTE;
}

// Ligne de prérequis portant sur un certificat détenu ou manquant.
function LigneCertificat({ ligne }: { ligne: LignePrerequis }) {
  const apparence = apparenceDe(ligne.etat);

  // Le détail affiché dépend de l'état : échéance si le document existe,
  // mention d'absence sinon.
  let detail = t.conformite.etat[ligne.etat] ?? ligne.etat;
  if (ligne.etat === "VALIDE" && ligne.expireLe) {
    detail = `${t.conformite.valideJusquAu} ${dateCourte(ligne.expireLe)}`;
  }
  if (ligne.etat === "BIENTOT_EXPIRE" && typeof ligne.joursRestants === "number") {
    detail = `${t.conformite.expireDans} ${ligne.joursRestants} ${t.commun.jours}`;
  }

  return (
    <div className={`flex items-center gap-2.5 rounded-xl border p-3.5 ${apparence.carte}`}>
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${apparence.pastille}`}
      >
        <Icone nom={apparence.icone} taille={14} epaisseur={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight text-navy">{ligne.label}</p>
        <p className={`mt-0.5 text-[11px] font-medium ${apparence.texte}`}>{detail}</p>
      </div>
    </div>
  );
}

// Ligne de prérequis portant sur le service en mer : la progression chiffrée
// est plus parlante qu'un simple état.
function LigneServiceMer({ ligne }: { ligne: LignePrerequis }) {
  const acquis = ligne.joursAcquis ?? 0;
  const requis = ligne.joursRequis ?? 0;
  const pourcentage = requis > 0 ? Math.min(Math.round((acquis / requis) * 100), 100) : 0;
  const manquants = Math.max(requis - acquis, 0);
  const complet = manquants === 0;
  const apparence = apparenceDe(complet ? "VALIDE" : "INSUFFISANT");

  return (
    <div className={`rounded-xl border p-4 ${apparence.carte}`}>
      <div className="flex items-start gap-2.5">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${apparence.pastille}`}
        >
          <Icone nom={apparence.icone} taille={14} epaisseur={2.5} />
        </span>
        <div>
          <p className="text-[13px] font-semibold leading-tight text-navy">{ligne.label}</p>
          <p className="mt-0.5 text-xs text-ardoise">
            {t.conformite.minimumRequis} : {requis} {t.commun.jours}
          </p>
        </div>
      </div>

      <div className="ml-[34px] mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-fond">
          <div
            className={`h-full rounded-full ${complet ? "bg-teal-sea" : "bg-gradient-to-r from-orange-ci to-alerte"}`}
            style={{ width: `${pourcentage}%` }}
          />
        </div>

        <div className="mt-1.5 flex justify-between">
          <span className={`text-xs font-semibold ${apparence.texte}`}>
            {acquis} / {requis} {t.commun.jours}
          </span>
          {!complet && (
            <span className={`text-xs font-medium ${apparence.texte}`}>
              {manquants} {t.conformite.joursManquants}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function ConformitePage() {
  const [rapports, setRapports] = useState<RapportConformite[] | null>(null);
  const [erreur, setErreur] = useState("");
  const naviguer = useNavigate();

  useEffect(function chargerConformite() {
    api
      .get<RapportConformite[]>("/api/conformite/me")
      .then(setRapports)
      .catch(function () {
        setErreur(t.commun.erreurReseau);
      });
  }, []);

  if (erreur) {
    return <Alerte ton="erreur">{erreur}</Alerte>;
  }

  if (!rapports) {
    return <ChargementPage />;
  }

  if (rapports.length === 0) {
    return <EtatVide message={t.conformite.aucune} />;
  }

  return (
    <div className="space-y-6">
      {rapports.map(function afficherRapport(rapport) {
        return (
          <section key={rapport.certificat.id}>
            <EnteteEcran titre={t.conformite.titre}>
              <div className="rounded-carte bg-white/10 p-4">
                <p className="text-xs text-white/50">{t.conformite.votreDossierPour}</p>
                <p className="mt-1 font-titre text-lg font-bold">{rapport.certificat.label}</p>

                <div className="mt-3.5 flex items-center gap-2.5">
                  <div className="h-2 flex-1 overflow-hidden rounded-md bg-white/15">
                    <div
                      className="h-full rounded-md bg-orange-ci transition-all"
                      style={{ width: `${rapport.progression}%` }}
                    />
                  </div>
                  <span className="font-titre text-base font-bold text-orange-ci">
                    {rapport.progression} %
                  </span>
                </div>

                <p className="mt-2 text-[11px] text-white/50">
                  {rapport.satisfaits} {t.commun.sur} {rapport.total} {t.conformite.prerequis},{" "}
                  {rapport.eligible ? t.conformite.conforme : t.conformite.partiellementConforme}
                </p>
              </div>
            </EnteteEcran>

            <div className="space-y-3">
              {rapport.prerequis.map(function afficherLigne(ligne, index) {
                const cle = `${rapport.certificat.id}-${index}`;
                return ligne.type === "SEA_SERVICE" ? (
                  <LigneServiceMer key={cle} ligne={ligne} />
                ) : (
                  <LigneCertificat key={cle} ligne={ligne} />
                );
              })}

              {/* Rappel réglementaire : le moteur informe, l'autorité décide */}
              <div className="rounded-xl bg-fond p-3.5">
                <p className="text-[11px] leading-relaxed text-ardoise">{rapport.avertissement}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={function () {
                    naviguer("/formations");
                  }}
                  className="rounded-xl border border-bordure bg-white py-3 text-xs font-semibold text-navy transition-colors hover:bg-navy-soft"
                >
                  {t.conformite.centresFormation}
                </button>
                <button
                  type="button"
                  onClick={function () {
                    naviguer("/demandes/nouvelle");
                  }}
                  className="rounded-xl bg-orange-ci py-3 text-xs font-semibold text-white"
                >
                  {t.conformite.renouvelerMedical}
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
