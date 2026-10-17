// ============================================
// pages/marin/NouvelleDemandePage.tsx
// Assistant de demande en quatre étapes : objet, pièces, vérification,
// paiement.
//
// Le découpage en étapes courtes est délibéré : sur un téléphone, un
// formulaire unique de vingt champs fait abandonner. Le fil d'étapes reste
// visible dans le bandeau pour situer le marin à tout moment.
// ============================================
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { t, libelle } from "../../i18n/index.js";
import { api, lireFichier, ErreurApi } from "../../lib/apiClient.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card } from "../../components/atoms/Card.js";
import { Button } from "../../components/atoms/Button.js";
import { Icone } from "../../components/atoms/Icone.js";
import { SelectField, TextAreaField } from "../../components/atoms/Field.js";
import { Alerte } from "../../components/atoms/Feedback.js";
import { EnteteEcran } from "../../components/layouts/EnteteEcran.js";
import { montant } from "../../lib/format.js";
import type { Demande, DocumentMaritime } from "../../types/api.js";

const ETAPES = [t.demandes.etape1, t.demandes.etape2, t.demandes.etape3, t.demandes.etape4];

const TYPES_DEMANDE = ["FIRST_ISSUANCE", "RENEWAL", "DUPLICATE", "UPGRADE"];

// Taille maximale acceptée par pièce, alignée sur la contrainte serveur.
const TAILLE_MAX_OCTETS = 2 * 1024 * 1024;

// Nombre maximal de pièces jointes par demande.
const PIECES_MAX = 6;

// Fil d'étapes affiché dans le bandeau : segments remplis derrière la
// position courante, vides devant.
function FilEtapes({ etapeCourante }: { etapeCourante: number }) {
  return (
    <div>
      <div className="flex gap-1.5">
        {ETAPES.map(function afficherSegment(nom, index) {
          return (
            <span
              key={nom}
              className={`h-1.5 flex-1 rounded-full ${index <= etapeCourante ? "bg-orange-ci" : "bg-white/20"}`}
            />
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-white/60">
        {t.demandes.etapeCourante} {etapeCourante + 1} {t.commun.sur} {ETAPES.length},{" "}
        {ETAPES[etapeCourante]}
      </p>
    </div>
  );
}

// Taille de fichier en unité lisible.
function tailleLisible(octets: number): string {
  if (octets < 1024) {
    return `${octets} o`;
  }
  if (octets < 1024 * 1024) {
    return `${Math.round(octets / 1024)} Ko`;
  }
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export function NouvelleDemandePage() {
  const naviguer = useNavigate();
  const emplacement = useLocation();
  const preselection = (emplacement.state ?? {}) as { certificateTypeId?: string };

  const { certificats, baremes, charger } = useReferentielStore();

  const [etape, setEtape] = useState(0);
  const [certificateTypeId, setCertificateTypeId] = useState(preselection.certificateTypeId ?? "");
  const [type, setType] = useState("RENEWAL");
  const [sourceDocumentId, setSourceDocumentId] = useState("");
  const [reason, setReason] = useState("");
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [documents, setDocuments] = useState<DocumentMaritime[]>([]);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(
    function chargerContexte() {
      void charger();
      api
        .get<DocumentMaritime[]>("/api/documents/me")
        .then(setDocuments)
        .catch(function () {
          setDocuments([]);
        });
    },
    [charger],
  );

  // Frais lus dans le barème, exactement comme le serveur les calculera.
  const frais = useMemo(
    function trouverBareme() {
      return baremes?.find(function (bareme) {
        return bareme.certificateTypeId === certificateTypeId && bareme.requestType === type;
      });
    },
    [baremes, certificateTypeId, type],
  );

  const certificat = certificats?.find(function (valeur) {
    return valeur.id === certificateTypeId;
  });

  // Documents du marin du même type : candidats au renouvellement.
  const documentsCompatibles = documents.filter(function (document) {
    return document.certificateType.id === certificateTypeId;
  });

  // Ajout de pièces, avec refus des fichiers trop lourds côté client afin
  // d'éviter un envoi inutile sur une connexion mobile.
  function ajouterFichiers(selection: FileList | null) {
    if (!selection) {
      return;
    }

    const retenus: File[] = [];
    let refuse = false;

    Array.from(selection).forEach(function (fichier) {
      if (fichier.size > TAILLE_MAX_OCTETS) {
        refuse = true;
      } else {
        retenus.push(fichier);
      }
    });

    setErreur(refuse ? t.demandes.piecesAide : "");
    setFichiers(fichiers.concat(retenus).slice(0, PIECES_MAX));
  }

  function retirerFichier(index: number) {
    setFichiers(
      fichiers.filter(function (_, position) {
        return position !== index;
      }),
    );
  }

  async function soumettre() {
    setErreur("");
    setEnvoi(true);
    try {
      const pieces = await Promise.all(fichiers.map(lireFichier));
      const demande = await api.post<Demande>("/api/demandes/me", {
        certificateTypeId,
        type,
        sourceDocumentId: sourceDocumentId || undefined,
        reason: reason || undefined,
        attachments: pieces.length > 0 ? pieces : undefined,
      });

      // Une demande avec frais bascule directement sur l'écran de paiement.
      if (demande.feeAmount > 0) {
        naviguer(`/demandes/${demande.id}/paiement`, { replace: true });
      } else {
        naviguer("/demandes", { replace: true });
      }
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
      setEnvoi(false);
    }
  }

  return (
    <div>
      <EnteteEcran titre={t.demandes.nouvelle}>
        <FilEtapes etapeCourante={etape} />
      </EnteteEcran>

      <div className="space-y-4">
        {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

        {/* Étape 1 : objet de la demande */}
        {etape === 0 && (
          <Card className="space-y-4">
            <SelectField
              label={t.demandes.certificat}
              value={certificateTypeId}
              onChange={function (evenement) {
                setCertificateTypeId(evenement.target.value);
              }}
              obligatoire
            >
              <option value="">—</option>
              {certificats?.map(function afficherCertificat(valeur) {
                return (
                  <option key={valeur.id} value={valeur.id}>
                    {valeur.label}
                  </option>
                );
              })}
            </SelectField>

            <SelectField
              label={t.demandes.typeDemande}
              value={type}
              onChange={function (evenement) {
                setType(evenement.target.value);
              }}
            >
              {TYPES_DEMANDE.map(function afficherType(valeur) {
                return (
                  <option key={valeur} value={valeur}>
                    {libelle(t.demandes.type, valeur)}
                  </option>
                );
              })}
            </SelectField>

            {type === "RENEWAL" && documentsCompatibles.length > 0 && (
              <SelectField
                label={t.demandes.documentSource}
                value={sourceDocumentId}
                onChange={function (evenement) {
                  setSourceDocumentId(evenement.target.value);
                }}
              >
                <option value="">—</option>
                {documentsCompatibles.map(function afficherDocument(document) {
                  return (
                    <option key={document.id} value={document.id}>
                      {document.number ?? document.certificateType.label}
                    </option>
                  );
                })}
              </SelectField>
            )}

            <TextAreaField
              label={t.demandes.motif}
              value={reason}
              onChange={function (evenement) {
                setReason(evenement.target.value);
              }}
            />

            <Button
              pleineLargeur
              disabled={!certificateTypeId}
              onClick={function () {
                setEtape(1);
              }}
            >
              {t.commun.suivant}
            </Button>
          </Card>
        )}

        {/* Étape 2 : pièces justificatives */}
        {etape === 1 && (
          <div className="space-y-4">
            {/* Rappel de l'objet choisi à l'étape précédente */}
            <Card className="flex items-center gap-3 bg-navy-soft/60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
                <Icone nom="documents" taille={18} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] text-ardoise">{t.demandes.objetSelectionne}</p>
                <p className="truncate text-sm font-semibold text-navy">
                  {libelle(t.demandes.type, type)}, {certificat ? certificat.label : ""}
                </p>
              </div>
            </Card>

            {/* Pièces déjà ajoutées */}
            {fichiers.length === 0 ? (
              <p className="text-sm text-ardoise">{t.demandes.aucunePiece}</p>
            ) : (
              <div className="space-y-2">
                {fichiers.map(function afficherFichier(fichier, index) {
                  return (
                    <div
                      key={`${fichier.name}-${index}`}
                      className="flex items-center gap-3 rounded-carte border border-succes/30 bg-succes-soft/40 px-4 py-3"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-sea text-white">
                        <Icone nom="valide" taille={16} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-navy">{fichier.name}</p>
                        <p className="text-[11px] text-ardoise">{tailleLisible(fichier.size)}</p>
                      </div>

                      <button
                        type="button"
                        onClick={function () {
                          retirerFichier(index);
                        }}
                        aria-label={t.demandes.retirer}
                        className="shrink-0 rounded-lg p-1.5 text-ardoise transition-colors hover:bg-white hover:text-erreur"
                      >
                        <Icone nom="manquant" taille={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Zone de dépôt */}
            {fichiers.length < PIECES_MAX && (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-carte border-[1.5px] border-dashed border-navy/40 bg-fond px-4 py-7 text-center transition-colors hover:border-navy hover:bg-navy-soft">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-soft text-navy">
                  <Icone nom="televerser" taille={20} />
                </span>
                <span className="text-sm font-semibold text-navy">
                  {t.demandes.deposerFichier}
                </span>
                <span className="text-[11px] text-ardoise">{t.demandes.formatsAcceptes}</span>

                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={function (evenement) {
                    ajouterFichiers(evenement.target.files);
                  }}
                />
              </label>
            )}

            <Alerte ton="info">{t.demandes.compressionAuto}</Alerte>

            <div className="flex gap-2">
              <Button
                variante="discret"
                onClick={function () {
                  setEtape(0);
                }}
              >
                {t.commun.precedent}
              </Button>
              <Button
                pleineLargeur
                onClick={function () {
                  setEtape(2);
                }}
              >
                {t.commun.continuer}
              </Button>
            </div>
          </div>
        )}

        {/* Étape 3 : vérification avant envoi */}
        {etape === 2 && (
          <Card className="space-y-4">
            <h2 className="text-sm font-semibold text-navy">{t.demandes.recapitulatif}</h2>

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-bordure pb-2">
                <dt className="text-ardoise">{t.demandes.certificat}</dt>
                <dd className="font-medium text-navy">{certificat ? certificat.label : "—"}</dd>
              </div>
              <div className="flex justify-between border-b border-bordure pb-2">
                <dt className="text-ardoise">{t.demandes.typeDemande}</dt>
                <dd className="font-medium text-navy">{libelle(t.demandes.type, type)}</dd>
              </div>
              <div className="flex justify-between border-b border-bordure pb-2">
                <dt className="text-ardoise">{t.demandes.pieces}</dt>
                <dd className="font-medium text-navy">{fichiers.length}</dd>
              </div>
              <div className="flex items-baseline justify-between pt-1">
                <dt className="text-ardoise">{t.demandes.fraisDossier}</dt>
                <dd className="font-titre text-xl font-bold text-orange-ci">
                  {frais ? montant(frais.amount, frais.currency) : t.demandes.gratuit}
                </dd>
              </div>
            </dl>

            <div className="flex gap-2">
              <Button
                variante="discret"
                onClick={function () {
                  setEtape(1);
                }}
              >
                {t.commun.precedent}
              </Button>
              <Button pleineLargeur chargement={envoi} onClick={soumettre}>
                {t.demandes.soumettre}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
