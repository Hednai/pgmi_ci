// ============================================
// components/molecules/PieceJointe.tsx
// Lien de consultation d'une pièce du registre.
//
// Un seul composant pour les quatre écrans qui donnent accès à un
// justificatif : coffre du marin, file de contrôle, dossier marin côté
// guichet et panneau d'instruction. L'en-tête d'authentification, le
// message d'échec et l'état d'attente sont traités ici une fois, et non
// réécrits dans chaque écran.
// ============================================
import { useState } from "react";
import { t } from "../../i18n/index.js";
import { ErreurApi } from "../../lib/apiClient.js";
import { ouvrirPieceJointe, enregistrerPieceJointe } from "../../lib/fichiers.js";
import { Icone } from "../atoms/Icone.js";

interface ProprietesPieceJointe {
  // Chemin servi par l'API, au format /uploads/<...>
  fileUrl: string | null | undefined;
  // Nom affiché et proposé à l'enregistrement
  nom?: string;
  // Libellé du lien quand le nom du fichier n'a pas de sens pour le lecteur
  libelleLien?: string;
  // Ajoute un bouton d'enregistrement à côté de la consultation
  avecTelechargement?: boolean;
}

export function PieceJointe({
  fileUrl,
  nom,
  libelleLien,
  avecTelechargement = true,
}: ProprietesPieceJointe) {
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  if (!fileUrl) {
    return <p className="text-[11px] text-ardoise">{t.pieces.aucunFichier}</p>;
  }

  const nomFichier = nom && nom.length > 0 ? nom : t.pieces.nomParDefaut;

  async function executer(action: () => Promise<void>) {
    setErreur("");
    setEnCours(true);
    try {
      await action();
    } catch (err) {
      setErreur(err instanceof ErreurApi ? err.message : t.commun.erreurReseau);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {/* Le nom du fichier identifie la pièce, il n'agit pas. Les deux
            gestes de l'agent, regarder et garder une copie, portent chacun
            leur propre libellé. */}
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-navy">
          <Icone nom="documents" taille={13} className="shrink-0" />
          <span className="max-w-[220px] truncate">
            {libelleLien ?? nomFichier}
          </span>
        </span>

        <button
          type="button"
          disabled={enCours}
          onClick={function () {
            void executer(function () {
              return ouvrirPieceJointe(fileUrl as string);
            });
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-navy px-2.5 py-1 text-[11px] font-semibold text-navy transition-colors hover:bg-navy-soft disabled:opacity-50"
        >
          {t.pieces.consulter}
        </button>

        {avecTelechargement && (
          <button
            type="button"
            disabled={enCours}
            onClick={function () {
              void executer(function () {
                return enregistrerPieceJointe(fileUrl as string, nomFichier);
              });
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-ardoise hover:underline disabled:opacity-50"
          >
            <Icone nom="televerser" taille={11} className="shrink-0" />
            {t.pieces.telecharger}
          </button>
        )}
      </div>

      {erreur && (
        <p className="mt-1 text-[11px] text-erreur">{erreur}</p>
      )}
    </div>
  );
}