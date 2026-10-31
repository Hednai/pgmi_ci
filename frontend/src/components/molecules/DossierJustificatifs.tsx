// ============================================
// components/molecules/DossierJustificatifs.tsx
// Dépôt des pièces justificatives d'un embarquement.
//
// Le marin voit ce qu'il doit fournir avant de déposer quoi que ce soit, et
// ce qu'il lui reste à fournir après chaque dépôt. C'était la remarque de
// recette : un champ de fichier nu sur la ligne, sans indication des pièces
// attendues, laissait le marin deviner et la DGAM rejeter.
//
// Aucun libellé de pièce n'est écrit ici : le référentiel vient du serveur,
// qui s'en sert aussi pour refuser une soumission incomplète. Les deux ne
// peuvent donc pas dire des choses différentes.
// ============================================
import { useEffect, useState } from "react";
import { t } from "../../i18n/index.js";
import { api, lireFichier, ErreurApi } from "../../lib/apiClient.js";
import { Button } from "../atoms/Button.js";
import { Icone } from "../atoms/Icone.js";
import { Alerte } from "../atoms/Feedback.js";
import {
  obtenirContraintesDepot,
  tailleLisible,
} from "../../lib/contraintesDepot.js";
import { dossierModifiable, reglementAttendu } from "../../lib/embarquements.js";
import { ReglementMouvement } from "./ReglementMouvement.js";
import type { ContraintesDepot } from "../../lib/contraintesDepot.js";
import type { Embarquement, PieceAttendue, PieceDeposee } from "../../types/api.js";

interface ProprietesDossier {
  embarquement: Embarquement;
  // Frais de validation du mouvement, lus dans la grille tarifaire par
  // l'écran appelant. Zéro signifie gratuit, le dossier part alors
  // directement en vérification.
  montantValidation: number;
  deviseValidation: string;
  surChangement: () => Promise<void> | void;
}

export function DossierJustificatifs({
  embarquement,
  montantValidation,
  deviseValidation,
  surChangement,
}: ProprietesDossier) {
  const [attendues, setAttendues] = useState<PieceAttendue[] | null>(null);
  const [contraintes, setContraintes] = useState<ContraintesDepot | null>(null);
  const [referentielIndisponible, setReferentielIndisponible] = useState(false);
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [soumission, setSoumission] = useState(false);

  useEffect(function chargerReferentiel() {
    Promise.all([
      api.get<PieceAttendue[]>("/api/sea-service/pieces-attendues"),
      obtenirContraintesDepot(),
    ])
      .then(function ([pieces, limites]) {
        setAttendues(pieces);
        setContraintes(limites);
      })
      .catch(function () {
        setReferentielIndisponible(true);
      });
  }, []);

  const deposees: PieceDeposee[] = embarquement.proofs ?? [];

  // Un dossier transmis à la DGAM ne se modifie plus : les gestes de dépôt,
  // de retrait et de soumission disparaissent au lieu d'échouer au serveur.
  const modifiable = dossierModifiable(embarquement.status);

  const piecesDe = (code: string): PieceDeposee[] =>
    deposees.filter(function (piece) { return piece.kind === code; });

  const manquantes = (attendues ?? []).filter(function (piece) {
    return piece.obligatoire && piecesDe(piece.code).length === 0;
  });

  const complet = attendues !== null && manquantes.length === 0;

  // Un dossier complet dont les frais ne sont pas encore réglés passe par le
  // paiement ; tout autre retour du marin, après rejet ou demande de pièces,
  // est gratuit et se resoumet directement (R23).
  const aRegler = complet && reglementAttendu(embarquement.status, montantValidation);

  async function deposer(code: string, fichier: File) {
    setErreur("");
    setEnCours(code);
    try {
      await api.post(`/api/sea-service/me/${embarquement.id}/pieces`, {
        kind: code,
        fichier: await lireFichier(fichier),
      });
      await surChangement();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setEnCours(null);
    }
  }

  async function retirer(pieceId: string) {
    setErreur("");
    try {
      await api.delete(`/api/sea-service/me/${embarquement.id}/pieces/${pieceId}`);
      await surChangement();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    }
  }

  async function soumettre() {
    setErreur("");
    setSoumission(true);
    try {
      await api.post(`/api/sea-service/me/${embarquement.id}/soumission`);
      await surChangement();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setSoumission(false);
    }
  }

  if (referentielIndisponible) {
    return (
      <div className="mt-3">
        <Alerte ton="erreur">{t.serviceMer.justificatifs.referentielIndisponible}</Alerte>
      </div>
    );
  }

  if (!attendues || !contraintes) {
    return <p className="mt-3 text-xs text-ardoise">{t.commun.chargement}</p>;
  }

  return (
    <div className="mt-3 rounded-lg border border-bordure p-3">
      <p className="font-titre text-sm font-semibold text-navy">
        {t.serviceMer.justificatifs.titre}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-ardoise">
        {t.serviceMer.justificatifs.note}
      </p>
      <p className="mt-1 text-[11px] text-ardoise">
        {t.serviceMer.justificatifs.contraintes
          .replace("{formats}", contraintes.formats)
          .replace("{taille}", tailleLisible(contraintes.tailleMaxOctets))}
      </p>

      <ul className="mt-3 space-y-3">
        {attendues.map(function (piece) {
          const fournies = piecesDe(piece.code);
          const fournie = fournies.length > 0;
          const remplacable = modifiable && fournie && !piece.multiple;
          // Identifiant unique du champ, dérivé des données : plusieurs
          // embarquements coexistent sur l'écran, chacun avec ses pièces.
          const identifiantChamp = `depot-${embarquement.id}-${piece.code}`;

          return (
            <li key={piece.code}>
              <div className="flex items-start gap-2">
                <Icone
                  nom={fournie ? "verifie" : "documents"}
                  taille={14}
                  className={`mt-0.5 shrink-0 ${fournie ? "text-teal-sea" : "text-ardoise"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-navy">
                    {piece.libelle}
                    {piece.obligatoire ? (
                      <span className="ml-1 text-erreur">{t.serviceMer.justificatifs.requis}</span>
                    ) : (
                      <span className="ml-1 text-ardoise">{t.serviceMer.justificatifs.facultatif}</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ardoise">{piece.precision}</p>

                  {fournies.map(function (fichier) {
                    return (
                      <div key={fichier.id} className="mt-1.5 flex items-center gap-2">
                        <span className="truncate text-[11px] text-navy-light">{fichier.fileName}</span>
                        {modifiable && (
                          <button
                            type="button"
                            className="shrink-0 text-[11px] font-medium text-erreur underline"
                            onClick={function () { void retirer(fichier.id); }}
                          >
                            {t.commun.retirer}
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Le champ natif est masqué et piloté par un libellé placé
                      à côté de lui, jamais autour : un champ enveloppé dans
                      son propre label reçoit le clic deux fois. L'identifiant
                      est dérivé de l'embarquement et du code de la pièce, il
                      reste donc unique sur un écran qui en affiche plusieurs. */}
                  {modifiable && (
                    <div className="mt-1.5">
                      <input
                        id={identifiantChamp}
                        type="file"
                        accept={contraintes.typesAcceptes.join(",")}
                        disabled={enCours !== null}
                        className="hidden"
                        onChange={function (evenement) {
                          const fichier = evenement.target.files?.[0];
                          // Le champ est remis à zéro : sans cela, redéposer
                          // le même fichier après un retrait ne déclenche
                          // aucun événement de changement.
                          evenement.target.value = "";
                          if (fichier) { void deposer(piece.code, fichier); }
                        }}
                      />
                      <label
                        htmlFor={identifiantChamp}
                        className="inline-block cursor-pointer rounded-lg border border-navy px-3 py-1.5 text-[11px] font-semibold text-navy transition-colors hover:bg-navy-soft"
                      >
                        {fournie
                          ? t.serviceMer.justificatifs.choisirAutreFichier
                          : t.serviceMer.justificatifs.choisirFichier}
                      </label>
                      {remplacable && (
                        <span className="ml-2 text-[10px] text-ardoise">
                          {t.serviceMer.justificatifs.remplacement}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Message de l'agent quand il attend des pièces complémentaires. Le
          marin doit lire ce qui lui est demandé avant de redéposer. */}
      {embarquement.additionalInfo && (
        <div className="mt-3">
          <Alerte ton="alerte" titre={t.serviceMer.complementDemande}>
            {embarquement.additionalInfo}
          </Alerte>
        </div>
      )}

      {erreur && <div className="mt-3"><Alerte ton="erreur">{erreur}</Alerte></div>}

      {/* Le dossier verrouillé n'affiche ni ce qui manque ni le bouton
          d'envoi : il n'y a plus rien à compléter ni à transmettre. */}
      {modifiable ? (
        <>
          {!complet && (
            <p className="mt-3 text-[11px] font-medium text-orange-ci">
              {t.serviceMer.justificatifs.incomplet}{" "}
              {manquantes.map(function (piece) { return piece.libelle; }).join(" ; ")}
            </p>
          )}

          {aRegler ? (
            <ReglementMouvement
              embarquementId={embarquement.id}
              montantDu={montantValidation}
              devise={deviseValidation}
              surReglement={surChangement}
            />
          ) : (
            <Button pleineLargeur chargement={soumission} disabled={!complet} onClick={soumettre} className="mt-3">
              {t.serviceMer.justificatifs.soumettre}
            </Button>
          )}
        </>
      ) : (
        <div className="mt-3">
          <Alerte ton="info">{t.serviceMer.justificatifs.dossierVerrouille}</Alerte>
        </div>
      )}
    </div>
  );
}