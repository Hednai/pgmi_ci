// ============================================
// pages/marin/AccueilPage.tsx
// Écran d'accueil du marin.
//
// L'ordre des blocs suit l'urgence terrain : ce qui expire d'abord, les
// actions ensuite, l'historique en dernier. La grille d'actions reste à
// portée du pouce sur un téléphone d'entrée de gamme.
// ============================================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../../i18n/index.js";
import { api } from "../../lib/apiClient.js";
import { Card, SectionTitre } from "../../components/atoms/Card.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Icone } from "../../components/atoms/Icone.js";
import type { NomIcone } from "../../components/atoms/Icone.js";
import { dateCourte } from "../../lib/format.js";
import type { Demande, RapportConformite, SyntheseMarin } from "../../types/api.js";

// Description d'une tuile de la grille d'actions rapides.
interface ActionRapide {
  cle: string;
  libelle: string;
  chemin: string;
  icone: NomIcone;
  couleur: string;
}

const ACTIONS_RAPIDES: ActionRapide[] = [
  {
    cle: "documents",
    libelle: t.navigation.documents,
    chemin: "/documents",
    icone: "documents",
    couleur: "bg-navy",
  },
  {
    cle: "service-mer",
    libelle: t.navigation.serviceMer,
    chemin: "/service-mer",
    icone: "serviceMer",
    couleur: "bg-teal-sea",
  },
  {
    cle: "demande",
    libelle: t.tableauBordMarin.nouvelleDemande,
    chemin: "/demandes/nouvelle",
    icone: "nouvelleDemande",
    couleur: "bg-navy-light",
  },
  {
    cle: "qr",
    libelle: t.tableauBordMarin.monQrCode,
    chemin: "/profil",
    icone: "qrCode",
    couleur: "bg-ardoise",
  },
];

// Indicateur chiffré affiché dans la bande d'en-tête.
function ChiffreEntete({ valeur, libelle }: { valeur: number | string; libelle: string }) {
  return (
    <div className="flex-1 text-center">
      <p className="font-titre text-xl font-bold text-white">{valeur}</p>
      <p className="mt-0.5 text-[10px] font-medium leading-tight text-white/60">{libelle}</p>
    </div>
  );
}

export function AccueilPage() {
  const [synthese, setSynthese] = useState<SyntheseMarin | null>(null);
  const [conformite, setConformite] = useState<RapportConformite | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [erreur, setErreur] = useState("");
  const naviguer = useNavigate();

  useEffect(function chargerAccueil() {
    // La synthèse porte le contenu indispensable de l'écran. La conformité et
    // les demandes l'enrichissent : leur absence n'empêche pas l'affichage.
    api
      .get<SyntheseMarin>("/api/marins/me/synthese")
      .then(setSynthese)
      .catch(function () {
        setErreur(t.commun.erreurReseau);
      });

    // Le moteur renvoie un rapport par brevet ; l'accueil n'affiche que le premier.
    api
      .get<RapportConformite[]>("/api/conformite/me")
      .then(function (rapports) {
        setConformite(rapports.length > 0 ? rapports[0] : null);
      })
      .catch(function () {
        setConformite(null);
      });

    api
      .get<Demande[]>("/api/demandes/me")
      .then(setDemandes)
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

  const { marin, statistiques, alertes } = synthese;

  return (
    <div className="space-y-5">
      {/* Bande d'identité et chiffres clés du dossier */}
      <section className="-mx-4 -mt-4 bg-gradient-to-br from-navy to-navy-light px-4 pb-5 pt-4 text-white">
        <p className="text-[11px] uppercase tracking-wide text-white/60">
          {t.tableauBordMarin.salutation}
        </p>
        <p className="font-titre text-lg font-bold">{marin.fullName}</p>
        <p className="text-xs text-white/70">
          {marin.fonction ? marin.fonction.label : ""}
          {marin.region ? `, ${marin.region}` : ""}
        </p>
        {marin.matricule && (
          <p className="matricule mt-1 text-xs font-semibold text-orange-ci">{marin.matricule}</p>
        )}

        <div className="mt-4 flex divide-x divide-white/15 rounded-carte bg-white/10 py-3">
          <ChiffreEntete
            valeur={statistiques.documents}
            libelle={t.tableauBordMarin.documentsValides}
          />
          <ChiffreEntete valeur={statistiques.joursVerifies} libelle={t.serviceMer.totalVerifie} />
          <ChiffreEntete
            valeur={statistiques.demandesEnCours}
            libelle={t.tableauBordMarin.demandesEnCours}
          />
        </div>
      </section>

      {/* Un dossier non activé bloque la plupart des actions : l'information
          passe avant tout le reste. */}
      {!marin.isActive && (
        <Alerte ton="alerte" titre={t.tableauBordMarin.dossierEnAttente}>
          {t.tableauBordMarin.dossierEnAttenteDetail}
        </Alerte>
      )}

      {/* Échéances proches, triées par urgence côté serveur */}
      {alertes.map(function afficherAlerte(alerte) {
        return (
          <button
            key={alerte.documentId}
            type="button"
            onClick={function () {
              naviguer("/documents");
            }}
            className="flex w-full items-start gap-3 rounded-carte border border-orange-ci/30 bg-alerte-soft px-4 py-3 text-left"
          >
            <Icone nom="alerte" taille={18} className="mt-0.5 shrink-0 text-orange-ci" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-navy">{alerte.certificat}</span>
              <span className="mt-0.5 block text-xs text-ardoise">
                {t.tableauBordMarin.expireLe} {dateCourte(alerte.expiryDate)}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-orange-ci px-2.5 py-1 text-[11px] font-semibold text-white">
              {alerte.joursRestants} {t.commun.jours}
            </span>
          </button>
        );
      })}

      {/* Grille d'accès aux fonctions principales */}
      <section>
        <SectionTitre titre={t.tableauBordMarin.actionsRapides} />
        <div className="grid grid-cols-2 gap-3">
          {ACTIONS_RAPIDES.map(function afficherAction(action) {
            return (
              <button
                key={action.cle}
                type="button"
                disabled={!marin.isActive && action.cle !== "documents"}
                onClick={function () {
                  naviguer(action.chemin);
                }}
                className={`flex flex-col items-start gap-2 rounded-carte ${action.couleur} px-4 py-4 text-left text-white transition-opacity disabled:opacity-40`}
              >
                <Icone nom={action.icone} taille={22} />
                <span className="text-sm font-semibold leading-tight">{action.libelle}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Progression vers le brevet visé, calculée par le moteur de conformité */}
      {conformite && (
        <section>
          <SectionTitre titre={t.tableauBordMarin.maConformite} />
          <Card
            onClick={function () {
              naviguer("/conformite");
            }}
          >
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-navy">{conformite.certificat.label}</p>
              <p className="font-titre text-lg font-bold text-orange-ci">
                {conformite.progression} %
              </p>
            </div>

            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-navy-soft">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-ci to-vert-ci transition-all"
                style={{ width: `${conformite.progression}%` }}
              />
            </div>

            <p className="mt-2 text-xs text-ardoise">
              {conformite.satisfaits} {t.commun.sur} {conformite.total} {t.conformite.prerequis}
            </p>
          </Card>
        </section>
      )}

      {/* Suivi des démarches déjà engagées */}
      <section>
        <SectionTitre titre={t.tableauBordMarin.dernieresDemandes} />
        {demandes.length === 0 ? (
          <Card>
            <p className="text-sm text-ardoise">{t.tableauBordMarin.aucuneDemande}</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {demandes.slice(0, 3).map(function afficherDemande(demande) {
              return (
                <Card
                  key={demande.id}
                  onClick={function () {
                    naviguer("/demandes");
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">
                        {demande.certificateType.label}
                      </p>
                      <p className="matricule mt-0.5 text-xs text-ardoise">{demande.reference}</p>
                      <p className="mt-0.5 text-[11px] text-ardoise">
                        {dateCourte(demande.createdAt)}
                      </p>
                    </div>
                    <BadgeStatut statut={demande.status} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
