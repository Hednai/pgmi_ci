// ============================================
// pages/marin/DocumentsPage.tsx
// Coffre documentaire du marin : dépôt, consultation, QR code.
// ============================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { t, libelle } from "../../i18n/index.js";
import { api, lireFichier, ErreurApi } from "../../lib/apiClient.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card, EtatVide } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { Icone } from "../../components/atoms/Icone.js";
import { InputField, SelectField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage, Spinner } from "../../components/atoms/Feedback.js";
import { EnteteEcran } from "../../components/layouts/EnteteEcran.js";
import { PieceJointe } from "../../components/molecules/PieceJointe.js";
import { useQrCode } from "../../hooks/useQrCode.js";
import { useFluxTempsReel } from "../../hooks/useFluxTempsReel.js";
import { EVENEMENTS_ECRAN } from "../../lib/evenements.js";
import { dateCourte } from "../../lib/format.js";
import type { DocumentMaritime } from "../../types/api.js";

interface DonneesQr {
  code: string;
  url: string;
  image: string;
  certificat: string;
  statut: string;
}

// Filtres proposés au marin.
const FILTRES = [
  { valeur: "TOUS", libelle: t.documents.filtreTous },
  { valeur: "STCW", libelle: t.documents.filtreStcw },
  { valeur: "MEDICAL", libelle: t.documents.filtreMedical },
  { valeur: "NATIONAL", libelle: t.documents.filtreNational },
];

const SEUIL_ALERTE_JOURS = 90;

function PastilleDocument({ code, categorie }: { code: string; categorie: string }) {
  const fond = categorie === "MEDICAL" ? "bg-orange-ci" : categorie === "STCW" ? "bg-teal-sea" : "bg-navy";
  return (
    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${fond} text-white`}>
      {categorie === "STCW" ? (
        <span className="text-[11px] font-bold leading-none">{code.slice(0, 5)}</span>
      ) : (
        <Icone nom={categorie === "MEDICAL" ? "medical" : "livret"} taille={20} />
      )}
    </div>
  );
}

// Vignette du QR d'un document, calculée dans le navigateur.
function VignetteQr({ url }: { url: string }) {
  const { image, enCours } = useQrCode(url);
  if (image) return <img src={image} alt="" className="mx-auto my-4 h-56 w-56" />;
  if (enCours) return <div className="my-10 flex justify-center"><Spinner classe="h-10 w-10" /></div>;
  return <div className="my-4"><Alerte ton="alerte">{t.documents.qrIndisponible}</Alerte></div>;
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentMaritime[] | null>(null);
  const [filtreActif, setFiltreActif] = useState("TOUS");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [qr, setQr] = useState<DonneesQr | null>(null);
  const [qrEnCours, setQrEnCours] = useState<string | null>(null);
  // Identifiant du document dont les versions précédentes sont dépliées
  const [historiqueOuvert, setHistoriqueOuvert] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const naviguer = useNavigate();
  const { certificats, charger } = useReferentielStore();

  const [formulaire, setFormulaire] = useState({
    certificateTypeId: "",
    number: "",
    issueDate: "",
    expiryDate: "",
  });
  const [fichier, setFichier] = useState<File | null>(null);

  const rafraichir = useCallback(function () {
    return api
      .get<DocumentMaritime[]>("/api/documents/me")
      .then(setDocuments)
      .catch(function () { setErreur(t.commun.erreurReseau); });
  }, []);

  useEffect(function chargerDocuments() {
    void charger();
    void rafraichir();
  }, [charger, rafraichir]);

  // Le coffre se met à jour pendant que le marin le regarde.
  useFluxTempsReel({
    evenements: EVENEMENTS_ECRAN.DOCUMENTS_MARIN,
    surEvenement: function () { void rafraichir(); },
  });

  // Un renouvellement approuvé laisse l'ancien document en base au statut
  // REPLACED, en pointant vers son remplaçant. Affichés côte à côte, les
  // deux se ressemblent et rien ne dit lequel fait foi. La version courante
  // est donc seule dans la liste, les précédentes se déplient sous elle.
  const { courants, versionsParDocument } = useMemo(function regrouper() {
    const tous = documents ?? [];
    const parId = new Map(tous.map(function (document) { return [document.id, document]; }));

    const remplaces = tous.filter(function (document) {
      return document.status === "REPLACED" && document.replacedById
        && parId.has(document.replacedById);
    });

    // Index inverse : à quel document chaque version remplacée se rattache.
    const precedentDe = new Map<string, DocumentMaritime[]>();
    remplaces.forEach(function (ancien) {
      const cible = ancien.replacedById as string;
      const liste = precedentDe.get(cible);
      if (liste) { liste.push(ancien); } else { precedentDe.set(cible, [ancien]); }
    });

    // Chaîne complète : un remplaçant peut lui-même avoir été remplacé.
    const chaine = (documentId: string): DocumentMaritime[] => {
      const directs = precedentDe.get(documentId) ?? [];
      return directs.flatMap(function (ancien) { return [ancien, ...chaine(ancien.id)]; });
    };

    const idsRemplaces = new Set(remplaces.map(function (document) { return document.id; }));
    // Une version remplacée dont le remplaçant est introuvable reste
    // affichée : mieux vaut un doublon qu'un document disparu.
    const visibles = tous.filter(function (document) { return !idsRemplaces.has(document.id); });

    const versions = new Map<string, DocumentMaritime[]>();
    visibles.forEach(function (document) {
      const precedentes = chaine(document.id);
      if (precedentes.length > 0) versions.set(document.id, precedentes);
    });

    return { courants: visibles, versionsParDocument: versions };
  }, [documents]);

  const documentsAffiches = useMemo(function filtrerDocuments() {
    if (filtreActif === "TOUS") return courants;
    return courants.filter(function (document) {
      return document.certificateType.category.toUpperCase() === filtreActif;
    });
  }, [courants, filtreActif]);

  async function deposer() {
    setErreur("");
    setEnvoi(true);
    try {
      await api.post("/api/documents/me", {
        certificateTypeId: formulaire.certificateTypeId,
        number: formulaire.number || undefined,
        issueDate: formulaire.issueDate || undefined,
        expiryDate: formulaire.expiryDate || undefined,
        fichier: fichier ? await lireFichier(fichier) : undefined,
      });
      setFormulaireOuvert(false);
      setFormulaire({ certificateTypeId: "", number: "", issueDate: "", expiryDate: "" });
      setFichier(null);
      await rafraichir();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setEnvoi(false);
    }
  }

  async function afficherQr(documentId: string) {
    setErreur("");
    setQrEnCours(documentId);
    try {
      setQr(await api.get<DonneesQr>(`/api/documents/me/${documentId}/qr`));
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setQrEnCours(null);
    }
  }

  function fermerQr() {
    setQr(null);
    setQrEnCours(null);
  }

  if (!documents) return <ChargementPage />;

  return (
    <div>
      <EnteteEcran titre={t.documents.titre}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTRES.map(function afficherFiltre(filtre) {
            const actif = filtre.valeur === filtreActif;
            const compte = filtre.valeur === "TOUS"
              ? courants.length
              : courants.filter(function (d) { return d.certificateType.category.toUpperCase() === filtre.valeur; }).length;
            return (
              <button key={filtre.valeur} type="button"
                onClick={function () { setFiltreActif(filtre.valeur); }}
                className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${actif ? "bg-white/20 text-white" : "bg-white/[0.08] text-white/60"}`}
              >
                {filtre.libelle} ({compte})
              </button>
            );
          })}
        </div>
      </EnteteEcran>

      <div className="space-y-3">
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        <Button pleineLargeur variante={formulaireOuvert ? "discret" : "principal"}
          onClick={function () { setFormulaireOuvert(!formulaireOuvert); }}>
          {formulaireOuvert ? t.commun.annuler : t.documents.ajouter}
        </Button>

        {formulaireOuvert && (
          <Card className="space-y-4">
            <SelectField label={t.documents.type} value={formulaire.certificateTypeId}
              onChange={function (e) { setFormulaire({ ...formulaire, certificateTypeId: e.target.value }); }}
              obligatoire>
              <option value="">—</option>
              {certificats?.map(function (c) { return <option key={c.id} value={c.id}>{c.label}</option>; })}
            </SelectField>
            <InputField label={t.documents.numero} value={formulaire.number}
              onChange={function (e) { setFormulaire({ ...formulaire, number: e.target.value }); }} />
            <div className="grid grid-cols-2 gap-3">
              <InputField label={t.documents.delivreLe} type="date" value={formulaire.issueDate}
                onChange={function (e) { setFormulaire({ ...formulaire, issueDate: e.target.value }); }} />
              <InputField label={t.documents.expireLe} type="date" value={formulaire.expiryDate}
                onChange={function (e) { setFormulaire({ ...formulaire, expiryDate: e.target.value }); }} />
            </div>
            <InputField label={t.documents.fichier} aide={t.documents.fichierAide}
              type="file" accept="image/jpeg,image/png,application/pdf"
              onChange={function (e) { setFichier(e.target.files?.[0] ?? null); }} />
            <Button pleineLargeur chargement={envoi} disabled={!formulaire.certificateTypeId} onClick={deposer}>
              {t.commun.enregistrer}
            </Button>
          </Card>
        )}

        {documentsAffiches.length === 0 ? <EtatVide message={t.documents.aucun} /> : (
          documentsAffiches.map(function afficherDocument(document) {
            const statut = document.statutEffectif ?? document.status;
            const jours = document.joursRestants;
            const urgent = typeof jours === "number" && jours >= 0 && jours <= SEUIL_ALERTE_JOURS;
            const verifie = statut === "VERIFIED" || statut === "OFFICIAL_DIGITAL";
            const versions = versionsParDocument.get(document.id) ?? [];
            const deplie = historiqueOuvert === document.id;

            return (
              <div key={document.id}
                className={`flex gap-3.5 rounded-carte border p-4 ${urgent ? "border-[1.5px] border-orange-ci bg-alerte-soft/40" : "border-bordure bg-white"}`}>
                <PastilleDocument code={document.certificateType.code} categorie={document.certificateType.category.toUpperCase()} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight text-navy">{document.certificateType.label}</p>
                    {urgent && typeof jours === "number" ? (
                      <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase text-orange-ci ring-1 ring-orange-ci/30">
                        {jours} {t.commun.jours}
                      </span>
                    ) : (
                      <BadgeStatut statut={statut} libelle={libelle(t.documents.statut, statut)} />
                    )}
                  </div>

                  {document.number && (
                    <p className="matricule mt-1 text-xs text-ardoise">
                      {document.number}{document.certificateType.category ? `, ${document.certificateType.category}` : ""}
                    </p>
                  )}

                  <p className={`mt-0.5 text-[11px] ${urgent ? "font-medium text-orange-ci" : "text-ardoise"}`}>
                    {t.documents.expireLe} {dateCourte(document.expiryDate)}
                  </p>

                  {verifie && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <Icone nom="verifie" taille={14} className="shrink-0 text-teal-sea" />
                      <span className="text-[10px] font-medium text-teal-sea">{t.documents.verifieParDgam}</span>
                    </div>
                  )}

                  {urgent && (
                    <button type="button" onClick={function () { naviguer("/demandes/nouvelle"); }}
                      className="mt-2.5 w-full rounded-lg bg-orange-ci py-2 text-xs font-semibold text-white">
                      {t.documents.renouveler}
                    </button>
                  )}

                  {/* Le QR reste accessible même sur un document proche de
                      l'échéance : il est encore opposable à un contrôle. */}
                  {document.verificationCode && (
                    <button type="button" disabled={qrEnCours === document.id}
                      onClick={function () { void afficherQr(document.id); }}
                      className="mt-2.5 w-full rounded-lg border border-bordure py-2 text-xs font-semibold text-navy transition-colors hover:bg-navy-soft disabled:opacity-50">
                      {t.documents.voirQr}
                    </button>
                  )}

                  {/* Le marin consulte la pièce qu'il a lui-même déposée */}
                  {document.fileUrl && (
                    <div className="mt-2.5">
                      <PieceJointe fileUrl={document.fileUrl} nom={`${document.certificateType.code}.pdf`} libelleLien={t.documents.fichier} />
                    </div>
                  )}

                  {/* Versions remplacées de ce même certificat, repliées par
                      défaut : elles restent consultables sans prêter à
                      confusion avec la version qui fait foi. */}
                  {versions.length > 0 && (
                    <div className="mt-2.5 border-t border-bordure pt-2.5">
                      <button type="button"
                        onClick={function () { setHistoriqueOuvert(deplie ? null : document.id); }}
                        className="flex w-full items-center justify-between text-[11px] font-semibold text-ardoise transition-colors hover:text-navy">
                        <span>
                          {deplie ? t.documents.masquerVersions : t.documents.versionsPrecedentes} ({versions.length})
                        </span>
                        {/* Pas de chevron bas dans le catalogue d'icônes :
                            le chevron droit pivote, ce qui évite d'en ajouter un. */}
                        <Icone nom="suivant" taille={14}
                          className={`transition-transform ${deplie ? "rotate-90" : ""}`} />
                      </button>

                      {deplie && (
                        <div className="mt-2 space-y-2">
                          {versions.map(function afficherVersion(ancienne) {
                            return (
                              <div key={ancienne.id} className="rounded-lg bg-fond px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="matricule text-[11px] text-ardoise">
                                    {ancienne.number ?? t.documents.numero}
                                  </p>
                                  <BadgeStatut statut="REPLACED" libelle={libelle(t.documents.statut, "REPLACED")} />
                                </div>
                                <p className="mt-0.5 text-[10px] text-ardoise">
                                  {t.documents.expireLe} {dateCourte(ancienne.expiryDate)}
                                </p>
                                {ancienne.fileUrl && (
                                  <div className="mt-1.5">
                                    <PieceJointe fileUrl={ancienne.fileUrl}
                                      nom={`${ancienne.certificateType.code}.pdf`}
                                      libelleLien={t.documents.fichier} />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                          <p className="text-[10px] leading-relaxed text-ardoise">
                            {t.documents.versionRemplacee}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Le QR est affiché en superposition plein écran. */}
      {(qr || qrEnCours) && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-navy/80 p-5">
          <Card className="w-full max-w-sm text-center">
            <p className="font-titre text-base font-semibold text-navy">{t.documents.qrTitre}</p>
            <p className="mt-1 text-xs text-ardoise">{qr ? qr.certificat : t.commun.chargement}</p>

            {qr ? (
              <VignetteQr url={qr.url} />
            ) : (
              <div className="my-10 flex justify-center"><Spinner classe="h-10 w-10" /></div>
            )}

            {qr && (
              <>
                <p className="text-xs text-ardoise">{t.documents.codeVerification}</p>
                <p className="matricule text-xl font-bold text-navy">{qr.code}</p>
                <p className="mt-3 text-[11px] leading-relaxed text-ardoise">{t.documents.qrInstruction}</p>
              </>
            )}

            <Button variante="secondaire" pleineLargeur className="mt-4" onClick={fermerQr}>
              {t.commun.fermer}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}