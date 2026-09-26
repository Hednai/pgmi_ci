// ============================================
// pages/marin/DocumentsPage.tsx
// Coffre documentaire du marin : dépôt, consultation, QR code.
// ============================================
import { useEffect, useState } from "react";
import { t, libelle } from "../../i18n/index.js";
import { api, lireFichier, ErreurApi } from "../../lib/apiClient.js";
import { useReferentielStore } from "../../stores/referentielStore.js";
import { Card, SectionTitre, EtatVide } from "../../components/atoms/Card.js";
import { BadgeStatut } from "../../components/atoms/Badge.js";
import { Button } from "../../components/atoms/Button.js";
import { InputField, SelectField } from "../../components/atoms/Field.js";
import { Alerte, ChargementPage, Spinner } from "../../components/atoms/Feedback.js";
import { dateCourte, dureeEnJours } from "../../lib/format.js";
import type { DocumentMaritime } from "../../types/api.js";

interface DonneesQr {
  code: string;
  url: string;
  image: string;
  certificat: string;
  statut: string;
}

export const DocumentsPage = () => {
  const [documents, setDocuments] = useState<DocumentMaritime[] | null>(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [qr, setQr] = useState<DonneesQr | null>(null);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const { certificats, charger } = useReferentielStore();

  const [formulaire, setFormulaire] = useState({
    certificateTypeId: "",
    number: "",
    issueDate: "",
    expiryDate: "",
  });
  const [fichier, setFichier] = useState<File | null>(null);

  const rafraichir = () =>
    api
      .get<DocumentMaritime[]>("/api/documents/me")
      .then(setDocuments)
      .catch(() => setErreur(t.commun.erreurReseau));

  useEffect(() => {
    void charger();
    void rafraichir();
  }, [charger]);

  const deposer = async () => {
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
  };

  const afficherQr = async (documentId: string) => {
    try {
      setQr(await api.get<DonneesQr>(`/api/documents/me/${documentId}/qr`));
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    }
  };

  if (!documents) return <ChargementPage />;

  return (
    <div className="space-y-4">
      <SectionTitre
        titre={t.documents.titre}
        action={
          <Button taille="sm" onClick={() => setFormulaireOuvert((ouvert) => !ouvert)}>
            {formulaireOuvert ? t.commun.annuler : t.documents.ajouter}
          </Button>
        }
      />

      {erreur && <Alerte ton="erreur">{erreur}</Alerte>}

      {formulaireOuvert && (
        <Card className="space-y-4">
          <SelectField
            label={t.documents.type}
            value={formulaire.certificateTypeId}
            onChange={(evenement) =>
              setFormulaire((precedent) => ({
                ...precedent,
                certificateTypeId: evenement.target.value,
              }))
            }
            obligatoire
          >
            <option value="">—</option>
            {certificats?.map((certificat) => (
              <option key={certificat.id} value={certificat.id}>
                {certificat.label}
              </option>
            ))}
          </SelectField>

          <InputField
            label={t.documents.numero}
            value={formulaire.number}
            onChange={(evenement) =>
              setFormulaire((precedent) => ({ ...precedent, number: evenement.target.value }))
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <InputField
              label={t.documents.delivreLe}
              type="date"
              value={formulaire.issueDate}
              onChange={(evenement) =>
                setFormulaire((precedent) => ({ ...precedent, issueDate: evenement.target.value }))
              }
            />
            <InputField
              label={t.documents.expireLe}
              type="date"
              value={formulaire.expiryDate}
              onChange={(evenement) =>
                setFormulaire((precedent) => ({ ...precedent, expiryDate: evenement.target.value }))
              }
            />
          </div>

          <InputField
            label={t.documents.fichier}
            aide={t.documents.fichierAide}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            onChange={(evenement) => setFichier(evenement.target.files?.[0] ?? null)}
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

      {documents.length === 0 ? (
        <EtatVide message={t.documents.aucun} />
      ) : (
        <div className="space-y-2">
          {documents.map((document) => {
            const statut = document.statutEffectif ?? document.status;
            return (
              <Card key={document.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy">
                      {document.certificateType.label}
                    </p>
                    {document.number && (
                      <p className="matricule mt-0.5 text-xs text-ardoise">{document.number}</p>
                    )}
                  </div>
                  <BadgeStatut statut={statut} libelle={libelle(t.documents.statut, statut)} />
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-ardoise">
                  <span>
                    {t.documents.expireLe} {dateCourte(document.expiryDate)}
                  </span>
                  {typeof document.joursRestants === "number" && document.joursRestants >= 0 && (
                    <span className="font-medium text-navy">
                      {dureeEnJours(document.joursRestants)}
                    </span>
                  )}
                </div>

                {document.verificationCode && (
                  <Button
                    variante="discret"
                    taille="sm"
                    className="mt-3"
                    pleineLargeur
                    onClick={() => afficherQr(document.id)}
                  >
                    {t.documents.voirQr}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

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
              <Spinner classe="my-10" />
            )}

            <p className="text-xs text-ardoise">{t.documents.codeVerification}</p>
            <p className="matricule text-xl font-bold text-navy">{qr.code}</p>
            <p className="mt-3 text-[11px] leading-relaxed text-ardoise">
              {t.documents.qrInstruction}
            </p>

            <Button variante="secondaire" pleineLargeur className="mt-4" onClick={() => setQr(null)}>
              {t.commun.fermer}
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};
