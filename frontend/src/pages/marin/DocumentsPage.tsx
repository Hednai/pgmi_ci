// ============================================
// pages/marin/DocumentsPage.tsx
// Coffre documentaire du marin : dépôt, consultation, QR code.
//
// Les documents dont l'échéance approche remontent visuellement : bordure
// orange et action de renouvellement intégrée à la carte, pour qu'un marin
// en escale comprenne son dossier en un coup d'oeil.
// ============================================
import { useEffect, useMemo, useState } from "react";
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
import { dateCourte } from "../../lib/format.js";
import type { DocumentMaritime } from "../../types/api.js";

interface DonneesQr {
  code: string;
  url: string;
  image: string;
  certificat: string;
  statut: string;
}

// Filtres proposés au marin. La valeur correspond à la catégorie du
// référentiel des types de certificat, "TOUS" affichant la liste entière.
const FILTRES = [
  { valeur: "TOUS", libelle: t.documents.filtreTous },
  { valeur: "STCW", libelle: t.documents.filtreStcw },
  { valeur: "MEDICAL", libelle: t.documents.filtreMedical },
  { valeur: "NATIONAL", libelle: t.documents.filtreNational },
];

// Seuil à partir duquel un document est mis en avant comme urgent.
const SEUIL_ALERTE_JOURS = 90;

// Pastille de gauche d'une carte document. Les certificats STCW portent leur
// code, les autres une icône de la famille correspondante.
function PastilleDocument({ code, categorie }: { code: string; categorie: string }) {
  const fond = categorie === "MEDICAL" ? "bg-orange-ci" : categorie === "STCW" ? "bg-teal-sea" : "bg-navy";

  // Les certificats STCW portent leur code, les autres familles une icône.
  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${fond} text-white`}
    >
      {categorie === "STCW" ? (
        <span className="text-[11px] font-bold leading-none">{code.slice(0, 5)}</span>
      ) : (
        <Icone nom={categorie === "MEDICAL" ? "medical" : "livret"} taille={20} />
      )}
    </div>
  );
}

export function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentMaritime[] | null>(null);
  const [filtreActif, setFiltreActif] = useState("TOUS");
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [qr, setQr] = useState<DonneesQr | null>(null);
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

  function rafraichir() {
    return api
      .get<DocumentMaritime[]>("/api/documents/me")
      .then(setDocuments)
      .catch(function () {
        setErreur(t.commun.erreurReseau);
      });
  }

  useEffect(
    function chargerDocuments() {
      void charger();
      void rafraichir();
    },
    [charger],
  );

  // Liste filtrée par catégorie, recalculée uniquement quand la source change.
  const documentsAffiches = useMemo(
    function filtrerDocuments() {
      if (!documents) {
        return [];
      }
      if (filtreActif === "TOUS") {
        return documents;
      }
      return documents.filter(function (document) {
        return document.certificateType.category.toUpperCase() === filtreActif;
      });
    },
    [documents, filtreActif],
  );

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
    try {
      setQr(await api.get<DonneesQr>(`/api/documents/me/${documentId}/qr`));
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    }
  }

  if (!documents) {
    return <ChargementPage />;
  }

  return (
    <div>
      <EnteteEcran titre={t.documents.titre}>
        {/* Filtres par famille de document */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTRES.map(function afficherFiltre(filtre) {
            const actif = filtre.valeur === filtreActif;
            const compte =
              filtre.valeur === "TOUS"
                ? documents.length
                : documents.filter(function (document) {
                    return document.certificateType.category.toUpperCase() === filtre.valeur;
                  }).length;

            return (
              <button
                key={filtre.valeur}
                type="button"
                onClick={function () {
                  setFiltreActif(filtre.valeur);
                }}
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

        <Button
          pleineLargeur
          variante={formulaireOuvert ? "discret" : "principal"}
          onClick={function () {
            setFormulaireOuvert(!formulaireOuvert);
          }}
        >
          {formulaireOuvert ? t.commun.annuler : t.documents.ajouter}
        </Button>

        {formulaireOuvert && (
          <Card className="space-y-4">
            <SelectField
              label={t.documents.type}
              value={formulaire.certificateTypeId}
              onChange={function (evenement) {
                setFormulaire({ ...formulaire, certificateTypeId: evenement.target.value });
              }}
              obligatoire
            >
              <option value="">—</option>
              {certificats?.map(function afficherOption(certificat) {
                return (
                  <option key={certificat.id} value={certificat.id}>
                    {certificat.label}
                  </option>
                );
              })}
            </SelectField>

            <InputField
              label={t.documents.numero}
              value={formulaire.number}
              onChange={function (evenement) {
                setFormulaire({ ...formulaire, number: evenement.target.value });
              }}
            />

            <div className="grid grid-cols-2 gap-3">
              <InputField
                label={t.documents.delivreLe}
                type="date"
                value={formulaire.issueDate}
                onChange={function (evenement) {
                  setFormulaire({ ...formulaire, issueDate: evenement.target.value });
                }}
              />
              <InputField
                label={t.documents.expireLe}
                type="date"
                value={formulaire.expiryDate}
                onChange={function (evenement) {
                  setFormulaire({ ...formulaire, expiryDate: evenement.target.value });
                }}
              />
            </div>

            <InputField
              label={t.documents.fichier}
              aide={t.documents.fichierAide}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={function (evenement) {
                setFichier(evenement.target.files?.[0] ?? null);
              }}
            />

            <Button
              pleineLargeur
              chargement={envoi}
              disabled={!formulaire.certificateTypeId}
              onClick={deposer}
            >
              {t.commun.enregistrer}
            </Button>
          </Card>
        )}

        {documentsAffiches.length === 0 ? (
          <EtatVide message={t.documents.aucun} />
        ) : (
          documentsAffiches.map(function afficherDocument(document) {
            const statut = document.statutEffectif ?? document.status;
            const jours = document.joursRestants;
            const urgent = typeof jours === "number" && jours >= 0 && jours <= SEUIL_ALERTE_JOURS;
            const verifie = statut === "VERIFIED" || statut === "OFFICIAL_DIGITAL";

            return (
              <div
                key={document.id}
                className={`flex gap-3.5 rounded-carte border p-4 ${urgent ? "border-[1.5px] border-orange-ci bg-alerte-soft/40" : "border-bordure bg-white"}`}
              >
                <PastilleDocument
                  code={document.certificateType.code}
                  categorie={document.certificateType.category.toUpperCase()}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-tight text-navy">
                      {document.certificateType.label}
                    </p>
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
                      {document.number}
                      {document.certificateType.category
                        ? `, ${document.certificateType.category}`
                        : ""}
                    </p>
                  )}

                  <p
                    className={`mt-0.5 text-[11px] ${urgent ? "font-medium text-orange-ci" : "text-ardoise"}`}
                  >
                    {t.documents.expireLe} {dateCourte(document.expiryDate)}
                  </p>

                  {/* Marque de vérification par l'autorité, gage d'authenticité */}
                  {verifie && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <Icone nom="verifie" taille={14} className="shrink-0 text-teal-sea" />
                      <span className="text-[10px] font-medium text-teal-sea">
                        {t.documents.verifieParDgam}
                      </span>
                    </div>
                  )}

                  {urgent && (
                    <button
                      type="button"
                      onClick={function () {
                        naviguer("/demandes/nouvelle");
                      }}
                      className="mt-2.5 w-full rounded-lg bg-orange-ci py-2 text-xs font-semibold text-white"
                    >
                      {t.documents.renouveler}
                    </button>
                  )}

                  {document.verificationCode && !urgent && (
                    <button
                      type="button"
                      onClick={function () {
                        void afficherQr(document.id);
                      }}
                      className="mt-2.5 w-full rounded-lg border border-bordure py-2 text-xs font-semibold text-navy transition-colors hover:bg-navy-soft"
                    >
                      {t.documents.voirQr}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Le QR est affiché en superposition plein écran : à présenter
          directement au contrôleur, sans quitter la liste. */}
      {qr && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-navy/80 p-5">
          <Card className="w-full max-w-sm text-center">
            <p className="font-titre text-base font-semibold text-navy">{t.documents.qrTitre}</p>
            <p className="mt-1 text-xs text-ardoise">{qr.certificat}</p>

            {qr.image ? (
              <img src={qr.image} alt="" className="mx-auto my-4 h-56 w-56" />
            ) : (
              <div className="my-10 flex justify-center">
                <Spinner classe="h-10 w-10" />
              </div>
            )}

            <p className="text-xs text-ardoise">{t.documents.codeVerification}</p>
            <p className="matricule text-xl font-bold text-navy">{qr.code}</p>
            <p className="mt-3 text-[11px] leading-relaxed text-ardoise">
              {t.documents.qrInstruction}
            </p>

            <Button
              variante="secondaire"
              pleineLargeur
              className="mt-4"
              onClick={function () {
                setQr(null);
              }}
            >
              {t.commun.fermer}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
