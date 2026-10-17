// ============================================
// domain/piecesServiceMer.ts
// Référentiel des pièces justificatives attendues pour un embarquement.
//
// Ce fichier est la seule source de vérité : le serveur s'en sert pour
// refuser une soumission incomplète, et le client l'affiche avant tout
// dépôt. Les deux ne peuvent donc pas diverger.
// ============================================

export interface DefinitionPiece {
  code: string;
  libelle: string;
  precision: string;
  obligatoire: boolean;
  // Plusieurs fichiers admis pour cette pièce (livret de plusieurs pages)
  multiple: boolean;
}

// Codes des pièces, cités dans le code plutôt qu'écrits en clair.
export const PIECE_SERVICE_MER = {
  LIVRET_MOUVEMENTS: "LIVRET_MOUVEMENTS",
  BON_DEBARQUEMENT: "BON_DEBARQUEMENT",
  AUTRE_JUSTIFICATIF: "AUTRE_JUSTIFICATIF",
} as const;

export type CodePiece = (typeof PIECE_SERVICE_MER)[keyof typeof PIECE_SERVICE_MER];

export const PIECES_SERVICE_MER: DefinitionPiece[] = [
  {
    code: PIECE_SERVICE_MER.LIVRET_MOUVEMENTS,
    libelle: "Page du livret maritime portant les mouvements",
    precision:
      "La page doit montrer l'embarquement et le débarquement, signés et revêtus du cachet du bord.",
    obligatoire: true,
    multiple: true,
  },
  {
    code: PIECE_SERVICE_MER.BON_DEBARQUEMENT,
    libelle: "Document de bord justifiant le débarquement",
    precision:
      "Bon de débarquement, attestation de l'armateur ou extrait du rôle d'équipage portant vos dates.",
    obligatoire: true,
    multiple: false,
  },
  {
    code: PIECE_SERVICE_MER.AUTRE_JUSTIFICATIF,
    libelle: "Autre justificatif",
    precision:
      "Contrat d'engagement, certificat de service ou toute pièce complétant votre dossier.",
    obligatoire: false,
    multiple: true,
  },
];

// Codes exportés pour la validation Zod : la liste est dérivée du catalogue,
// elle ne peut pas en diverger.
export const CODES_PIECES_SERVICE_MER = PIECES_SERVICE_MER.map(function (piece) {
  return piece.code;
}) as [string, ...string[]];

// Trouver une pièce par son code. Renvoie undefined si le code est inconnu :
// l'appelant refuse alors la pièce plutôt que d'en créer une fantôme.
export const definitionPiece = (code: string): DefinitionPiece | undefined =>
  PIECES_SERVICE_MER.find(function (piece) {
    return piece.code === code;
  });

// Codes des pièces obligatoires absentes de la liste fournie.
// Même règle que côté client : une pièce obligatoire bloque la soumission.
export const piecesObligatoiresManquantes = (
  pieces: { kind: string }[],
): string[] => {
  const presentes = new Set(pieces.map(function (piece) { return piece.kind; }));
  return PIECES_SERVICE_MER
    .filter(function (definition) {
      return definition.obligatoire && !presentes.has(definition.code);
    })
    .map(function (definition) {
      return definition.code;
    });
};