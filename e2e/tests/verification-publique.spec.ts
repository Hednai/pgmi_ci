// ============================================
// e2e/tests/verification-publique.spec.ts
// Page publique de vérification d'un document par code.
//
// C'est l'écran le plus exposé de la plateforme : il est consultable sans
// authentification, par un inspecteur d'armement ou un officier de port. Le
// cas qui compte le plus n'est pas le document valide, c'est le document
// périmé : afficher « authentique » sur un certificat expiré serait un
// manquement grave devant la DGAM.
// ============================================
import { test, expect } from "@playwright/test";
import { CHEMINS, CODES_VERIFICATION } from "./fixtures.js";

test.describe("vérification publique", () => {
  test("reconnaît un document valide", async ({ page }) => {
    await page.goto(`${CHEMINS.verification}?code=${CODES_VERIFICATION.valide}`);

    await expect(page.getByText(/authentique/i)).toBeVisible();
  });

  test("signale un document qui n'est plus opposable", async ({ page }) => {
    await page.goto(`${CHEMINS.verification}?code=${CODES_VERIFICATION.expire}`);

    // L'écran doit annoncer l'invalidité, et surtout ne pas annoncer le
    // contraire. Les deux attentes sont posées : la première peut passer
    // alors que la page affiche les deux mentions.
    await expect(page.getByText(/non valide|expiré|plus opposable/i)).toBeVisible();
    await expect(page.getByText(/^Document authentique$/)).toHaveCount(0);
  });

  test("ne révèle rien sur un code inconnu", async ({ page }) => {
    await page.goto(`${CHEMINS.verification}?code=ZZZZZZZZZ`);

    await expect(page.getByText(/inconnu|introuvable/i)).toBeVisible();
  });

  test("reste lisible sans code fourni", async ({ page }) => {
    await page.goto(CHEMINS.verification);

    // Pas d'écran blanc, pas de chargement perpétuel : l'écran demande un
    // code ou propose la saisie.
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(page.getByText(/chargement/i)).toHaveCount(0);
  });
});