// ============================================
// __tests__/piecesServiceMer.test.ts
// Référentiel des pièces justificatives d'un embarquement.
//
// La même fonction décide de ce qui manque côté serveur et de ce que
// l'écran affiche : elle est testée une fois, pour les deux.
// ============================================
import { describe, it, expect } from "vitest";
import {
  PIECE_SERVICE_MER,
  PIECES_SERVICE_MER,
  definitionPiece,
  piecesObligatoiresManquantes,
} from "../domain/piecesServiceMer.js";

describe("référentiel des pièces du service en mer", () => {
  it("décrit chaque pièce avec un libellé et une précision", () => {
    for (const piece of PIECES_SERVICE_MER) {
      expect(piece.libelle.length).toBeGreaterThan(0);
      expect(piece.precision.length).toBeGreaterThan(0);
    }
  });

  it("retrouve une pièce par son code et ignore un code inconnu", () => {
    expect(definitionPiece(PIECE_SERVICE_MER.BON_DEBARQUEMENT)?.obligatoire).toBe(true);
    expect(definitionPiece("PIECE_INVENTEE")).toBeUndefined();
  });
});

describe("piecesObligatoiresManquantes", () => {
  it("signale les deux pièces obligatoires sur un dossier vide", () => {
    expect(piecesObligatoiresManquantes([])).toEqual([
      PIECE_SERVICE_MER.LIVRET_MOUVEMENTS,
      PIECE_SERVICE_MER.BON_DEBARQUEMENT,
    ]);
  });

  it("ne signale plus une pièce obligatoire une fois déposée", () => {
    const manquantes = piecesObligatoiresManquantes([
      { kind: PIECE_SERVICE_MER.LIVRET_MOUVEMENTS },
    ]);
    expect(manquantes).toEqual([PIECE_SERVICE_MER.BON_DEBARQUEMENT]);
  });

  it("ne compte pas une pièce facultative comme suffisante", () => {
    const manquantes = piecesObligatoiresManquantes([
      { kind: PIECE_SERVICE_MER.AUTRE_JUSTIFICATIF },
    ]);
    expect(manquantes).toHaveLength(2);
  });

  it("considère le dossier complet quand les deux pièces obligatoires sont là", () => {
    const manquantes = piecesObligatoiresManquantes([
      { kind: PIECE_SERVICE_MER.LIVRET_MOUVEMENTS },
      { kind: PIECE_SERVICE_MER.BON_DEBARQUEMENT },
    ]);
    expect(manquantes).toHaveLength(0);
  });
});