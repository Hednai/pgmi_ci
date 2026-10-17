// ============================================
// __tests__/paiement.test.ts
// R8, pas d'instruction avant règlement des frais.
//
// La règle est testée sur la fonction de domaine, sans base de données :
// c'est tout l'intérêt de l'avoir sortie du service.
// ============================================
import { describe, it, expect } from "vitest";
import { instructionAutorisee } from "../domain/rules.js";

describe("R8, instruction et règlement des frais", () => {
  // Cas principal : des frais sont dus mais le paiement n'est pas confirmé.
  // Un agent ne doit pas pouvoir prendre ce dossier en instruction.
  it("refuse l'instruction quand des frais sont dus et non réglés", () => {
    expect(instructionAutorisee({ feeAmount: 15000, paiementConfirme: false })).toBe(false);
  });

  // Cas nominal : les frais sont réglés, l'instruction peut démarrer.
  it("autorise l'instruction quand les frais dus sont réglés", () => {
    expect(instructionAutorisee({ feeAmount: 15000, paiementConfirme: true })).toBe(true);
  });

  // Certaines démarches sont exonérées : aucun frais, aucun paiement attendu.
  // L'instruction ne doit pas être bloquée par un paiement qui n'existe pas.
  it("autorise l'instruction quand aucun frais n'est dû", () => {
    expect(instructionAutorisee({ feeAmount: 0, paiementConfirme: false })).toBe(true);
  });

  // Garde-fou sur une valeur inattendue : un montant négatif ne doit pas
  // bloquer l'instruction, il est traité comme une absence de frais.
  it("traite un montant négatif comme une absence de frais", () => {
    expect(instructionAutorisee({ feeAmount: -1, paiementConfirme: false })).toBe(true);
  });
});