// ============================================
// __tests__/suppressionDifferee.test.ts
// Règle de report entre deux tentatives de suppression.
//
// La suppression elle-même touche la base et le stockage : elle se vérifie
// en recette, pas ici. Le calcul du report, lui, est une règle pure, et
// c'est celle qui décide si une panne longue épuise les tentatives en
// quelques minutes ou tient plusieurs heures.
// ============================================
import { describe, it, expect } from "vitest";
import { calculerReportMs } from "../services/storage/reportSuppression.js";
import { STOCKAGE } from "../config/constants.js";

describe("report des tentatives de suppression", () => {
  it("part du report de base à la première tentative", () => {
    expect(calculerReportMs(0)).toBe(STOCKAGE.SUPPRESSION_REPORT_BASE_MS);
  });

  it("double à chaque tentative", () => {
    expect(calculerReportMs(1)).toBe(STOCKAGE.SUPPRESSION_REPORT_BASE_MS * 2);
    expect(calculerReportMs(2)).toBe(STOCKAGE.SUPPRESSION_REPORT_BASE_MS * 4);
  });

  it("ne dépasse jamais le plafond", () => {
    expect(calculerReportMs(50)).toBe(STOCKAGE.SUPPRESSION_REPORT_MAX_MS);
  });

  it("tient plus de six heures avant d'épuiser les tentatives", () => {
    // Une panne de stockage d'une matinée ne doit pas faire abandonner la
    // suppression d'une pièce d'identité.
    let cumul = 0;
    for (let tentative = 0; tentative < STOCKAGE.SUPPRESSION_TENTATIVES_MAX; tentative += 1) {
      cumul += calculerReportMs(tentative);
    }
    expect(cumul).toBeGreaterThan(6 * 60 * 60 * 1000);
  });
});