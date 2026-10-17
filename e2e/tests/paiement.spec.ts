// ============================================
// e2e/tests/paiement.spec.ts
// Parcours de règlement d'une demande.
//
// C'est la remarque de recette la plus visible : « j'ai fini de payer mais
// ça met toujours en attente de paiement ». Le test suit le parcours
// complet, depuis la liste des demandes jusqu'au retour après règlement.
// ============================================
import { test, expect } from "@playwright/test";
import { CHEMINS, connecterMarin } from "./fixtures.js";

test.describe("règlement d'une demande", () => {
  test.beforeEach(async ({ page }) => {
    await connecterMarin(page);
  });

  test("le statut quitte l'attente de paiement une fois le règlement confirmé", async ({
    page,
  }) => {
    await page.goto(CHEMINS.demandes);

    const demandeAPayer = page
      .getByRole("listitem")
      .filter({ hasText: /attente de paiement/i })
      .first();

    await expect(demandeAPayer).toBeVisible();
    await demandeAPayer.getByRole("button", { name: /payer|régler/i }).click();

    // Choix de l'opérateur de monnaie mobile, puis confirmation.
    await page.getByRole("button", { name: /Orange Money/i }).click();
    await page.getByRole("button", { name: /confirmer|payer/i }).last().click();

    // Retour sur la liste : la demande ne doit plus être en attente de
    // paiement. L'attente porte sur le changement, pas sur un délai.
    await page.goto(CHEMINS.demandes);
    await expect(
      page.getByRole("listitem").filter({ hasText: /attente de paiement/i }),
    ).toHaveCount(0);
  });

  test("un règlement déjà effectué n'est pas proposé deux fois", async ({ page }) => {
    await page.goto(CHEMINS.demandes);

    const dejaReglee = page
      .getByRole("listitem")
      .filter({ hasText: /instruction|en cours/i })
      .first();

    if ((await dejaReglee.count()) > 0) {
      await expect(dejaReglee.getByRole("button", { name: /payer|régler/i })).toHaveCount(0);
    }
  });
});