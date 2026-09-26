// ============================================
// pages/marin/NouvelleDemandePage.tsx
// Assistant de demande en quatre étapes : objet, pièces, vérification,
// paiement.
//
// Le découpage en étapes courtes est délibéré : sur un téléphone, un
// formulaire unique de vingt champs fait abandonner.
// ============================================
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { t, libelle } from "../../i18n/index.js";
import { api, lireFichier, ErreurApi } from "../../lib/apiClient.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card } from "../../components/atoms/Card.js";
import { Button } from "../../components/atoms/Button.js";
import { SelectField, TextAreaField, InputField } from "../../components/atoms/Field.js";
import { Alerte } from "../../components/atoms/Feedback.js";
import { montant } from "../../lib/format.js";
import type { Demande, DocumentMaritime } from "../../types/api.js";

const ETAPES = [t.demandes.etape1, t.demandes.etape2, t.demandes.etape3, t.demandes.etape4];

const TYPES_DEMANDE = ["FIRST_ISSUANCE", "RENEWAL", "DUPLICATE", "UPGRADE"];

export const NouvelleDemandePage = () => {
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

  useEffect(() => {
    void charger();
    api.get<DocumentMaritime[]>("/api/documents/me").then(setDocuments).catch(() => undefined);
  }, [charger]);

  // Frais lus dans le barème, exactement comme le serveur les calculera
  const frais = useMemo(
    () =>
      baremes?.find(
        (bareme) => bareme.certificateTypeId === certificateTypeId && bareme.requestType === type,
      ),
    [baremes, certificateTypeId, type],
  );

  const certificat = certificats?.find((valeur) => valeur.id === certificateTypeId);

  // Documents du marin du même type : candidats au renouvellement
  const documentsCompatibles = documents.filter(
    (document) => document.certificateType.id === certificateTypeId,
  );

  const soumettre = async () => {
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

      // Une demande avec frais bascule directement sur l'écran de paiement
      if (demande.feeAmount > 0) {
        naviguer(`/demandes/${demande.id}/paiement`, { replace: true });
      } else {
        naviguer("/demandes", { replace: true });
      }
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
      setEnvoi(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Fil d'étapes : le marin voit toujours où il en est */}
      <div className="flex gap-1.5">
        {ETAPES.map((nom, index) => (
          <div key={nom} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${index <= etape ? "bg-orange-ci" : "bg-navy-soft"}`}
            />
            <p
              className={`mt-1 text-[10px] leading-tight ${index === etape ? "font-semibold text-navy" : "text-ardoise"}`}
            >
              {nom}
            </p>
          </div>
        ))}
      </div>

      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      {etape === 0 && (
        <Card className="space-y-4">
          <SelectField
            label={t.demandes.certificat}
            value={certificateTypeId}
            onChange={(evenement) => setCertificateTypeId(evenement.target.value)}
            obligatoire
          >
            <option value="">—</option>
            {certificats?.map((valeur) => (
              <option key={valeur.id} value={valeur.id}>
                {valeur.label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={t.demandes.typeDemande}
            value={type}
            onChange={(evenement) => setType(evenement.target.value)}
          >
            {TYPES_DEMANDE.map((valeur) => (
              <option key={valeur} value={valeur}>
                {libelle(t.demandes.type, valeur)}
              </option>
            ))}
          </SelectField>

          {type === "RENEWAL" && documentsCompatibles.length > 0 && (
            <SelectField
              label={t.demandes.documentSource}
              value={sourceDocumentId}
              onChange={(evenement) => setSourceDocumentId(evenement.target.value)}
            >
              <option value="">—</option>
              {documentsCompatibles.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.number ?? document.certificateType.label}
                </option>
              ))}
            </SelectField>
          )}

          <TextAreaField
            label={t.demandes.motif}
            value={reason}
            onChange={(evenement) => setReason(evenement.target.value)}
          />

          <Button pleineLargeur disabled={!certificateTypeId} onClick={() => setEtape(1)}>
            {t.commun.suivant}
          </Button>
        </Card>
      )}

      {etape === 1 && (
        <Card className="space-y-4">
          <InputField
            label={t.demandes.pieces}
            aide={t.demandes.piecesAide}
            type="file"
            multiple
            accept="image/jpeg,image/png,application/pdf"
            onChange={(evenement) => setFichiers(Array.from(evenement.target.files ?? []).slice(0, 6))}
          />

          {fichiers.length > 0 && (
            <ul className="space-y-1 text-xs text-ardoise">
              {fichiers.map((fichier) => (
                <li key={fichier.name}>{fichier.name}</li>
              ))}
            </ul>
          )}

          <div className="flex gap-2">
            <Button variante="discret" onClick={() => setEtape(0)}>
              {t.commun.precedent}
            </Button>
            <Button pleineLargeur onClick={() => setEtape(2)}>
              {t.commun.suivant}
            </Button>
          </div>
        </Card>
      )}

      {etape === 2 && (
        <Card className="space-y-4">
          <h3 className="text-sm font-semibold text-navy">{t.demandes.recapitulatif}</h3>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-bordure pb-2">
              <dt className="text-ardoise">{t.demandes.certificat}</dt>
              <dd className="font-medium text-navy">{certificat?.label ?? "—"}</dd>
            </div>
            <div className="flex justify-between border-b border-bordure pb-2">
              <dt className="text-ardoise">{t.demandes.typeDemande}</dt>
              <dd className="font-medium text-navy">{libelle(t.demandes.type, type)}</dd>
            </div>
            <div className="flex justify-between border-b border-bordure pb-2">
              <dt className="text-ardoise">{t.demandes.pieces}</dt>
              <dd className="font-medium text-navy">{fichiers.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ardoise">{t.demandes.fraisDossier}</dt>
              <dd className="font-semibold text-orange-ci">
                {frais ? montant(frais.amount, frais.currency) : t.demandes.gratuit}
              </dd>
            </div>
          </dl>

          <div className="flex gap-2">
            <Button variante="discret" onClick={() => setEtape(1)}>
              {t.commun.precedent}
            </Button>
            <Button pleineLargeur chargement={envoi} onClick={soumettre}>
              {t.demandes.soumettre}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
