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