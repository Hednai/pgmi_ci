// ============================================
// services/storage/signature.ts
// Contrôle du type réel d'un fichier reçu en base64.
//
// Le mimeType annoncé par le client n'est qu'une déclaration : rien
// n'empêche d'envoyer un fichier HTML en le présentant comme une image.
// Les premiers octets, eux, ne mentent pas.
// ============================================

// Premiers octets attendus pour chaque type accepté par le cahier des
// charges. Un type peut admettre plusieurs signatures.
export const SIGNATURES: Record<string, readonly number[][]> = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
  "application/pdf": [[0x25, 0x50, 0x44, 0x46, 0x2d]],
};

// Extension de fichier imposée pour chaque type accepté.
//
// L'extension ne doit jamais venir du nom envoyé par le navigateur : un PDF
// dont la signature est validée pouvait être écrit sous le nom
// « piece.html » et servi comme page web depuis le domaine de la
// plateforme. L'extension découle du type réel, contrôlé sur les octets.
export const EXTENSIONS_PAR_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

// Types acceptés par le cahier des charges. La liste vit ici, à côté des
// signatures : un type ne peut pas être autorisé sans que sa signature soit
// connue, et aucun fournisseur de stockage n'en tient une copie.
//
// La table des extensions est recoupée avec celle des signatures : un type
// déclaré d'un seul côté fait échouer le démarrage plutôt que de passer
// inaperçu jusqu'au premier dépôt.
export const MIME_AUTORISES = Object.keys(SIGNATURES);

// Type MIME retrouvé depuis l'extension du fichier stocké. La route des
// pièces jointes ne connaît qu'un chemin sur le disque : sans ce rappel,
// elle servait les octets sans en-tête de type, et le navigateur ne pouvait
// ni afficher le document ni l'enregistrer sous son vrai format.
const MIME_PAR_EXTENSION: Record<string, string> = Object.fromEntries(
  Object.entries(EXTENSIONS_PAR_MIME).map(function (paire) {
    return [paire[1], paire[0]];
  }),
);

export const mimeDepuisExtension = (chemin: string): string | null => {
  const point = chemin.lastIndexOf(".");
  if (point < 0) return null;
  return MIME_PAR_EXTENSION[chemin.slice(point).toLowerCase()] ?? null;
};
// Libellé des formats acceptés, dérivé des extensions déclarées.
// Les messages d'erreur annonçaient « JPG, PNG, PDF » alors que le WebP
// était accepté : un marin voyait son dépôt réussir après un message qui le
// lui déconseillait. Une seule source, plus de divergence possible.
export const FORMATS_LIBELLE = MIME_AUTORISES.map(function (mime) {
  return EXTENSIONS_PAR_MIME[mime].replace(".", "").toUpperCase();
}).join(", ");

const sansExtension = MIME_AUTORISES.filter(function (mime) {
  return !EXTENSIONS_PAR_MIME[mime];
});

if (sansExtension.length > 0) {
  throw new Error(
    `Types acceptés sans extension déclarée : ${sansExtension.join(", ")}. ` +
      "Complétez EXTENSIONS_PAR_MIME dans signature.ts.",
  );
}

// Vrai si le contenu commence réellement par une signature du type annoncé.
// Un type absent de la table est refusé : la liste est fermée, on n'accepte
// jamais un format inconnu par défaut.
export const signatureConcorde = (mimeType: string, contenu: Buffer): boolean => {
  const attendues = SIGNATURES[mimeType];
  if (!attendues) return false;

  return attendues.some(function (signature) {
    return signature.every(function (octet, index) {
      return contenu[index] === octet;
    });
  });
};