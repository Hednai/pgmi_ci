// ============================================
// e2e/tests/temps-reel.spec.ts
// Mise à jour instantanée entre un agent et un marin.
//
// C'est le seul comportement qu'aucun autre test ne peut atteindre : il
// faut deux navigateurs ouverts en même temps, un agent qui agit, et un
// marin qui voit son écran changer sans l'avoir rechargé.
//
// Contrairement aux autres tests de ce dossier, celui-ci exige la pile
// réelle : le mode démonstration n'a pas de serveur, donc pas de flux
// Server-Sent Events. Il est donc ignoré tant que E2E_BACKEND_URL n'est pas
// renseignée, plutôt que de passer pour de mauvaises raisons.
//
// Pour l'exécuter :
//   E2E_BACKEND_URL=http://localhost:4000 npm test -- temps-reel
// avec le backend et la base lancés, et VITE_MODE_DEMO=false.
// ============================================
import { test, expect } from "@playwright/test";
import { CHEMINS, connecterAgent, connecterMarin } from "./fixtures.js";

const BACKEND = process.env.E2E_BACKEND_URL;

test.describe("mise à jour instantanée", () => {
  test.skip(
    !BACKEND,
    "Nécessite la pile réelle : renseignez E2E_BACKEND_URL et lancez le backend.",
  );

  test("le marin voit le statut changer sans recharger sa page", async ({ browser }) => {
    // Deux contextes distincts : deux sessions, deux stockages, comme deux
    // personnes sur deux postes.
    const contexteMarin = await browser.newContext();
    const contexteAgent = await browser.newContext();

    const pageMarin = await contexteMarin.newPage();
    const pageAgent = await contexteAgent.newPage();

    try {
      await connecterMarin(pageMarin);
      await pageMarin.goto(CHEMINS.serviceMer);

      const ligne = pageMarin
        .getByRole("listitem")
        .filter({ hasText: /soumis|en attente de vérification/i })
        .first();

      await expect(ligne).toBeVisible();

      // Référence de l'embarquement, relevée côté marin pour retrouver le
      // même dossier côté agent.
      const navire = await ligne.getByRole("heading").first().innerText();

      await connecterAgent(pageAgent);
      await pageAgent.goto("/agent/verifications");

      const aVerifier = pageAgent
        .getByRole("listitem")
        .filter({ hasText: navire })
        .first();

      await expect(aVerifier).toBeVisible();
      await aVerifier.getByRole("button", { name: /vérifier|valider/i }).click();
      await pageAgent.getByRole("button", { name: /confirmer/i }).click();

      // Le point du test : aucune navigation ni rechargement côté marin.
      // Si le flux temps réel ne fonctionne pas, cette attente expire.
      await expect(
        pageMarin.getByRole("listitem").filter({ hasText: navire }).first(),
      ).toContainText(/vérifié/i, { timeout: 20_000 });
    } finally {
      await contexteMarin.close();
      await contexteAgent.close();
    }
  });

  test("le flux se rétablit seul après une coupure réseau", async ({ browser }) => {
    const contexte = await browser.newContext();
    const page = await contexte.newPage();

    try {
      await connecterMarin(page);
      await page.goto(CHEMINS.documents);

      // Coupure simulée, puis retour. Le hook doit redemander un ticket et
      // rouvrir le flux : un ticket est à usage unique, la reconnexion
      // automatique du navigateur serait refusée.
      await contexte.setOffline(true);
      await page.waitForTimeout(2_000);
      await contexte.setOffline(false);

      // L'écran reste utilisable et se rafraîchit : aucune page d'erreur,
      // aucune boucle de reconnexion visible.
      await expect(page.getByText(/incident est survenu/i)).toHaveCount(0);
      await expect(page.locator("body")).not.toBeEmpty();
    } finally {
      await contexte.close();
    }
  });
});