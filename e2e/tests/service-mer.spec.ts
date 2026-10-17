// ============================================
// e2e/tests/service-mer.spec.ts
// Dépôt des justificatifs d'embarquement.
//
// La remarque de recette était qu'aucune indication n'existait sur les
// pièces attendues. Le test vérifie que la note est présente avant tout
// dépôt, que les contraintes sont annoncées, et que le dossier ne peut pas
// être soumis tant qu'une pièce obligatoire manque.
// ============================================
import { test, expect } from "@playwright/test";
import { CHEMINS, connecterMarin } from "./fixtures.js";

test.describe("justificatifs de service en mer", () => {
  test.beforeEach(async ({ page }) => {
    await connecterMarin(page);
    await page.goto(CHEMINS.serviceMer);
  });

  test("annonce les pièces attendues avant tout dépôt", async ({ page }) => {
    await expect(page.getByText(/Pièces justificatives/i).first()).toBeVisible();

    // Les deux pièces obligatoires du référentiel sont nommées.
    await expect(page.getByText(/livret maritime/i).first()).toBeVisible();
    await expect(page.getByText(/débarquement/i).first()).toBeVisible();
  });

  test("annonce les formats et la taille maximale", async ({ page }) => {
    // Le marin ne doit pas découvrir la limite au moment du rejet, après
    // avoir attendu la montée d'un fichier sur une connexion mobile.
    await expect(page.getByText(/Formats acceptés/i).first()).toBeVisible();
    await expect(page.getByText(/Taille maximale/i).first()).toBeVisible();
  });

  test("refuse la soumission tant qu'une pièce obligatoire manque", async ({ page }) => {
    const soumettre = page.getByRole("button", { name: /Soumettre le dossier/i }).first();

    await expect(soumettre).toBeVisible();
    await expect(soumettre).toBeDisabled();

    // Et l'écran nomme ce qui manque, au lieu de laisser deviner.
    await expect(page.getByText(/Pièces obligatoires manquantes/i).first()).toBeVisible();
  });
});