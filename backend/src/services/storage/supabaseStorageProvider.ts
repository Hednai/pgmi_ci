// ============================================
// services/storage/SupabaseStorageProvider.ts
// Stockage des pièces jointes sur Supabase Storage, en bucket privé.
//
// Pourquoi Supabase et pas un hébergeur d'images grand public : les pièces
// déposées ici sont des livrets maritimes, des certificats et des pages de
// discharge book, donc des données personnelles d'un registre d'État. Elles
// ne doivent jamais être lisibles par URL devinable. Le bucket est privé et
// chaque lecture passe par une URL signée de courte durée, délivrée
// seulement après le contrôle d'habilitation du serveur.
//
// Aucun paquet supplémentaire : l'API REST de Supabase Storage suffit et
// fetch est natif depuis Node 18. Une dépendance de moins à maintenir et à
// auditer sur un projet ministériel.
// ============================================
import { randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { STOCKAGE } from "../../config/constants.js";
import { logger } from "../../lib/logger.js";
import { ServiceUnavailableError } from "../../utils/errors.js";
import { extraireCheminStocke, validerDossier, validerPieceEntrante } from "./validation.js";
import type { FichierEntrant, FichierStocke, StorageProvider } from "./storage.service.js";

// Configuration, résolue à chaque appel plutôt que figée au chargement du
// module : le fournisseur peut être importé avant que l'environnement soit
// complet en test.
const base = (): string => (env.SUPABASE_URL ?? "").replace(/\/$/, "");
const bucket = (): string => env.SUPABASE_BUCKET ?? STOCKAGE.BUCKET_PAR_DEFAUT;

// En-têtes d'appel. La clé de service ne quitte jamais le serveur : elle
// n'est transmise ni au navigateur, ni dans une URL, ni dans un journal.
const entetes = (supplement: Record<string, string> = {}): Record<string, string> => {
  const cle = env.SUPABASE_SERVICE_KEY;

  if (!cle) {
    // La validation d'environnement empêche normalement ce cas. Le contrôle
    // reste ici : sans lui, l'appel partirait avec un en-tête vide et
    // Supabase répondrait 401, erreur bien plus difficile à diagnostiquer.
    throw new ServiceUnavailableError("Stockage mal configuré sur le serveur.");
  }

  return { Authorization: `Bearer ${cle}`, ...supplement };
};

// Lire le corps d'une réponse en échec sans jamais le propager au client :
// il peut contenir le nom du bucket et des éléments de configuration.
const detailErreur = async (reponse: Response): Promise<string> => {
  try {
    return (await reponse.text()).slice(0, STOCKAGE.DETAIL_ERREUR_MAX);
  } catch {
    return "(corps illisible)";
  }
};

export const supabaseStorageProvider: StorageProvider = {
  code: "SUPABASE",

  async enregistrer(dossier: string, fichier: FichierEntrant): Promise<FichierStocke> {
    // Mêmes contrôles que le disque local, depuis le même module.
    const sousDossier = validerDossier(dossier);
    const { contenu, extension } = validerPieceEntrante(fichier);

    // Nom aléatoire, extension déduite du type réel. Le nom d'origine n'est
    // jamais repris dans la clé d'objet.
    const chemin = `${sousDossier}/${randomUUID()}${extension}`;

    let reponse: Response;
    try {
      reponse = await fetch(`${base()}/storage/v1/object/${bucket()}/${chemin}`, {
        method: "POST",
        headers: entetes({
          "Content-Type": fichier.mimeType,
          "Cache-Control": `max-age=${STOCKAGE.CACHE_OBJET_SECONDES}`,
        }),
        body: new Uint8Array(contenu),
      });
    } catch (err) {
      // Réseau coupé, DNS, délai dépassé : une panne d'infrastructure, pas
      // une pièce invalide. Le client ne doit pas lire « fichier invalide »
      // et réessayer dix fois avec dix fichiers différents.
      logger.error({ err }, "Stockage injoignable au dépôt");
      throw new ServiceUnavailableError("Le stockage est momentanément injoignable.");
    }

    if (!reponse.ok) {
      logger.error(
        { statut: reponse.status, detail: await detailErreur(reponse) },
        "Dépôt de fichier refusé par le stockage",
      );
      throw new ServiceUnavailableError("Le dépôt du fichier a échoué. Réessayez dans un instant.");
    }

    return {
      // Le préfixe reste celui du disque local : les URL déjà en base
      // gardent la même forme, aucune migration de données n'est nécessaire.
      url: `${STOCKAGE.PREFIXE_URL}${chemin}`,
      nom: fichier.nom,
      mimeType: fichier.mimeType,
      taille: contenu.byteLength,
    };
  },

  async supprimer(url: string): Promise<void> {
    const chemin = extraireCheminStocke(url);

    let reponse: Response;
    try {
      reponse = await fetch(`${base()}/storage/v1/object/${bucket()}/${chemin}`, {
        method: "DELETE",
        headers: entetes(),
      });
    } catch (err) {
      logger.error({ err, chemin }, "Stockage injoignable à la suppression");
      throw new ServiceUnavailableError("Le stockage est momentanément injoignable.");
    }

    // 404 : l'objet n'existe plus, la suppression est idempotente.
    if (reponse.status === 404) {
      logger.warn({ chemin }, "Objet déjà absent au moment de la suppression");
      return;
    }

    if (!reponse.ok) {
      // Échec réel. Il est remonté, et non avalé : une pièce d'identité
      // restée dans le bucket alors que l'application la croit effacée est
      // précisément ce qu'un audit reproche.
      logger.error(
        { statut: reponse.status, chemin, detail: await detailErreur(reponse) },
        "Suppression de fichier refusée par le stockage",
      );
      throw new ServiceUnavailableError("La suppression du fichier a échoué.");
    }
  },

  // URL de lecture temporaire. Elle n'est demandée qu'après le contrôle
  // d'habilitation et après la trace d'audit : sa seule existence ne donne
  // aucun droit, et sa durée de vie est trop courte pour être partagée.
  //
  // Un échec renvoie null plutôt que de lever : l'appelant retombe alors sur
  // la lecture directe, et une panne de signature ne transforme pas une
  // consultation en erreur 503 pour le marin.
  async urlDeLecture(url: string): Promise<string | null> {
    const chemin = extraireCheminStocke(url);

    let reponse: Response;
    try {
      reponse = await fetch(`${base()}/storage/v1/object/sign/${bucket()}/${chemin}`, {
        method: "POST",
        headers: entetes({ "Content-Type": "application/json" }),
        body: JSON.stringify({ expiresIn: STOCKAGE.URL_SIGNEE_SECONDES }),
      });
    } catch (err) {
      logger.error({ err, chemin }, "Stockage injoignable à la signature");
      return null;
    }

    if (!reponse.ok) {
      logger.warn(
        { statut: reponse.status, chemin, detail: await detailErreur(reponse) },
        "Signature d'URL de lecture impossible",
      );
      return null;
    }

    let corps: { signedURL?: string; signedUrl?: string };
    try {
      corps = (await reponse.json()) as { signedURL?: string; signedUrl?: string };
    } catch (err) {
      logger.warn({ err, chemin }, "Réponse de signature illisible");
      return null;
    }

    // Supabase a renvoyé signedURL puis signedUrl selon les versions : les
    // deux sont acceptés plutôt que de dépendre d'une version précise.
    const signee = corps.signedURL ?? corps.signedUrl;
    if (!signee) {
      logger.warn({ chemin }, "Réponse de signature sans URL");
      return null;
    }

    return `${base()}/storage/v1/${signee.replace(/^\/+/, "")}`;
  },
};