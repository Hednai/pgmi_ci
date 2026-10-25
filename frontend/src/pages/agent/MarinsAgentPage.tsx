// ============================================
// pages/agent/MarinsAgentPage.tsx
// Registre des marins au guichet : recherche, activation, attribution du
// matricule.
//
// L'activation demande une trace écrite de la pièce vérifiée : c'est ce qui
// donne sa valeur à la règle R1 lors d'un contrôle ultérieur.
//
// L'ouverture d'un marin charge aussi son dossier : documents déposés et
// embarquements déclarés, avec les justificatifs consultables. Le panneau
// ne proposait que l'activation, et l'agent devait décider sans voir une
// seule pièce du dossier qu'il validait.
// ============================================
import { useEffect, useState } from "react";
import { t, libelle } from "../../i18n/index.js";
import { api, ErreurApi } from "../../lib/apiClient.js";
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage } from "../../components/atoms/Feedback.js";
import { Icone } from "../../components/atoms/Icone.js";
import { EnteteAgent, PanneauTraitement } from "../../components/layouts/EnteteAgent.js";
import { PieceJointe } from "../../components/molecules/PieceJointe.js";
import { useFluxTempsReel } from "../../hooks/useFluxTempsReel.js";
import { EVENEMENTS_ECRAN } from "../../lib/evenements.js";
import { dateCourte, initiales } from "../../lib/format.js";
import type {
  DocumentMaritime,
  DossierServiceMer,
  MarinResume,
  Pagine,
} from "../../types/api.js";

const STATUTS_MARIN: Record<string, string> = {
  PENDING: "En attente d'activation",
  PENDING_DGAM_VALIDATION: "À valider (ARSTM)",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
};

export function MarinsAgentPage() {
  const [resultat, setResultat] = useState<Pagine<MarinResume> | null>(null);
  const [recherche, setRecherche] = useState("");
  const [statut, setStatut] = useState("");
  const [selection, setSelection] = useState<MarinResume | null>(null);
  const [controle, setControle] = useState("");
  const [erreur, setErreur] = useState("");
  const [action, setAction] = useState(false);
  // Dossier du marin sélectionné. Nul pendant le chargement.
  const [documents, setDocuments] = useState<DocumentMaritime[] | null>(null);
  const [serviceMer, setServiceMer] = useState<DossierServiceMer | null>(null);

  const charger = async () => {
    const parametres = new URLSearchParams();
    if (recherche) parametres.set("q", recherche);
    if (statut) parametres.set("status", statut);
    setResultat(await api.get<Pagine<MarinResume>>(`/api/marins?${parametres.toString()}`));
  };

  useEffect(() => {
    const minuterie = setTimeout(() => {
      charger().catch(() => setErreur(t.commun.erreurReseau));
    }, 300);
    return () => clearTimeout(minuterie);
  }, [recherche, statut]);

  // Le registre reste à jour pendant que l'agent y travaille.
  useFluxTempsReel({
    evenements: EVENEMENTS_ECRAN.VERIFICATIONS_AGENT,
    surEvenement: function () {
      void charger();
      if (selection) void chargerDossier(selection.id);
    },
  });

  // Charger le dossier du marin ouvert.
  async function chargerDossier(marinId: string) {
    setDocuments(null);
    setServiceMer(null);
    try {
      const [listeDocuments, dossier] = await Promise.all([
        api.get<DocumentMaritime[]>(`/api/documents/marin/${marinId}`),
        api.get<DossierServiceMer>(`/api/sea-service/marin/${marinId}`),
      ]);
      setDocuments(listeDocuments);
      setServiceMer(dossier);
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
      setDocuments([]);
      setServiceMer({ embarquements: [], totaux: { joursVerifies: 0, joursEnAttente: 0, embarquements: 0 } });
    }
  }

  // Ouvrir un marin : sélection et chargement du dossier vont ensemble.
  function ouvrirMarin(marin: MarinResume) {
    setErreur("");
    setSelection(marin);
    void chargerDossier(marin.id);
  }

  function fermerPanneau() {
    setSelection(null);
    setDocuments(null);
    setServiceMer(null);
  }

  const activer = async () => {
    if (!selection) return;
    setErreur("");
    setAction(true);
    try {
      await api.post(`/api/marins/${selection.id}/activation`, { identityCheck: controle });
      setSelection(null);
      setControle("");
      await charger();
    } catch (err) {
      setErreur(
        err instanceof ErreurApi
          ? `${err.message}${err.regle ? ` (${err.regle})` : ""}`
          : t.commun.erreurReseau,
      );
    } finally {
      setAction(false);
    }
  };

  if (!resultat) return <ChargementPage />;

  return (
    <div>
      <EnteteAgent titre={t.navigation.marins}
        sousTitre={`${resultat.total} ${t.agent.marinsInscrits}`} icone="marins" />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-bordure bg-white px-3.5 py-2.5 focus-within:border-navy-light">
            <Icone nom="recherche" taille={16} className="shrink-0 text-ardoise" />
            <input type="search" placeholder={t.commun.rechercher} value={recherche}
              onChange={function (e) { setRecherche(e.target.value); }}
              className="w-full bg-transparent text-sm text-navy outline-none" />
          </div>
          <select value={statut} onChange={function (e) { setStatut(e.target.value); }}
            className="rounded-xl border border-bordure bg-white px-3.5 py-2.5 text-sm text-navy outline-none">
            <option value="">{t.commun.voirTout}</option>
            {Object.entries(STATUTS_MARIN).map(function ([cle, val]) {
              return <option key={cle} value={cle}>{val}</option>;
            })}
          </select>
        </div>

        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {resultat.items.length === 0 ? <EtatVide message={t.commun.aucunResultat} /> : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-bordure bg-fond text-left">
                  {[t.agent.marin, t.profil.fonction, t.profil.region, t.agent.statut, t.agent.depot].map(function (col) {
                    return <th key={col} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-wide text-ardoise">{col}</th>;
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure">
                {resultat.items.map(function afficherMarin(marin) {
                  return (
                    <tr key={marin.id} onClick={function () { ouvrirMarin(marin); }}
                      className="cursor-pointer transition-colors hover:bg-fond">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${marin.status === "ACTIVE" ? "bg-teal-sea" : "bg-orange-ci"}`}>
                            {initiales(marin.fullName)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-navy">{marin.fullName}</p>
                            <p className="matricule text-[10px] text-ardoise">{marin.matricule ?? "\u2014"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-navy/80">
                        {marin.fonction ?? "\u2014"}
                        {marin.isCadet && (
                          <span className="ml-1.5 rounded bg-navy-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase text-navy-light">{t.arstm.eleve}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-navy/80">{marin.region ?? "\u2014"}</td>
                      <td className="px-4 py-3"><BadgeStatut statut={marin.status} libelle={libelle(STATUTS_MARIN, marin.status)} /></td>
                      <td className="px-4 py-3 text-[12px] text-ardoise">{dateCourte(marin.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}

        {selection && (
          <PanneauTraitement titre={selection.fullName}
            sousTitre={selection.matricule ?? t.tableauBordMarin.dossierEnAttente}
            onFermer={fermerPanneau}>
            {selection.status !== "ACTIVE" ? (
              <>
                <InputField label={t.agent.pieceVerifiee} aide="CNI n° …, passeport n° …"
                  value={controle} onChange={(e) => setControle(e.target.value)} obligatoire />
                {erreur && <Alerte ton="erreur">{erreur}</Alerte>}
                <Button pleineLargeur variante="succes" chargement={action}
                  disabled={controle.trim().length < 3} onClick={activer}>
                  {t.agent.activerDossier}
                </Button>
              </>
            ) : (
              <Alerte ton="succes">{t.agent.matriculeAttribue}</Alerte>
            )}

            {/* Documents du dossier, avec le justificatif déposé par le marin */}
            <section className="space-y-2 border-t border-bordure pt-4">
              <h3 className="text-sm font-semibold text-navy">{t.agent.documentsDuMarin}</h3>
              {documents === null ? (
                <p className="text-xs text-ardoise">{t.agent.chargementDossier}</p>
              ) : documents.length === 0 ? (
                <p className="text-xs text-ardoise">{t.agent.aucunDocument}</p>
              ) : (
                documents.map(function afficherDocument(document) {
                  return (
                    <div key={document.id} className="rounded-lg border border-bordure p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-navy">{document.certificateType.label}</p>
                        <BadgeStatut statut={document.statutEffectif ?? document.status}
                          libelle={libelle(t.documents.statut, document.statutEffectif ?? document.status)} />
                      </div>
                      <p className="matricule mt-0.5 text-[11px] text-ardoise">
                        {document.number ?? "\u2014"}, {t.documents.expireLe} {dateCourte(document.expiryDate)}
                      </p>
                      <div className="mt-1.5">
                        <PieceJointe fileUrl={document.fileUrl}
                          nom={`${document.certificateType.code}-${document.number ?? document.id}`}
                          libelleLien={t.documents.fichier} />
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            {/* Service en mer, avec toutes les pièces de chaque embarquement */}
            <section className="space-y-2 border-t border-bordure pt-4">
              <h3 className="text-sm font-semibold text-navy">{t.agent.serviceMerDuMarin}</h3>
              {serviceMer === null ? (
                <p className="text-xs text-ardoise">{t.agent.chargementDossier}</p>
              ) : serviceMer.embarquements.length === 0 ? (
                <p className="text-xs text-ardoise">{t.agent.aucunEmbarquement}</p>
              ) : (
                serviceMer.embarquements.map(function afficherEmbarquement(embarquement) {
                  return (
                    <div key={embarquement.id} className="rounded-lg border border-bordure p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-semibold text-navy">{embarquement.vesselName}</p>
                        <BadgeStatut statut={embarquement.status} libelle={libelle(t.serviceMer.statut, embarquement.status)} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-ardoise">
                        {dateCourte(embarquement.startDate)} au {dateCourte(embarquement.endDate)}, {embarquement.days} {t.commun.jours}
                      </p>
                      <div className="mt-1.5 space-y-1">
                        {(embarquement.proofs ?? []).map(function afficherPiece(piece) {
                          return <PieceJointe key={piece.id} fileUrl={piece.fileUrl} nom={piece.fileName} />;
                        })}
                        {embarquement.proofUrl && (embarquement.proofs ?? []).length === 0 && (
                          <PieceJointe fileUrl={embarquement.proofUrl} libelleLien={t.serviceMer.joindrePreuve} />
                        )}
                        {!embarquement.proofUrl && (embarquement.proofs ?? []).length === 0 && (
                          <p className="text-[11px] text-ardoise">{t.pieces.aucunFichier}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </PanneauTraitement>
        )}
      </div>
    </div>
  );
}