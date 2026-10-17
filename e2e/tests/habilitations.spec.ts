// ============================================
// e2e/tests/habilitations.spec.ts
// Cloisonnement entre autorités et entre rôles, vu des écrans.
//
// La matrice des habilitations est déjà vérifiée en test unitaire : on sait
// que la fonction de décision répond correctement. Ce que ces tests ajoutent,
// c'est que les écrans l'appliquent réellement.
//
// Les deux sont nécessaires et ne se remplacent pas. Une règle juste n'est
// d'aucun secours si un écran affiche un bouton qu'elle interdit, ou si une
// route rend un dossier qu'elle refuse. Sur un registre d'État, un agent de
// l'ARSTM qui consulterait les dossiers de la DGAM serait un manquement
// signalable, pas un défaut d'ergonomie.
//
// Un test de cloisonnement doit vérifier deux choses, et jamais une seule :
// que l'habilité accède, et que le non-habilité est refusé. Vérifier
// uniquement le refus passerait sur une plateforme qui refuse tout le monde.
// ============================================
import { test, expect } from "@playwright/test";
import { accesRefuse, CHEMINS, COMPTES, connecterAgent, connecterMarin } from "./fixtures.js";

test.describe("cloisonnement entre autorités", () => {
  test("un agent de la DGAM accède bien à l'instruction des demandes", async ({ page }) => {
    // Le témoin positif. Sans lui, le test suivant passerait même si la
    // plateforme refusait l'accès à tout le monde.
    await connecterAgent(page, COMPTES.agentDgam);
    await page.goto(CHEMINS.agentDemandes);

    await expect(page).toHaveURL(new RegExp(CHEMINS.agentDemandes));
    expect(await accesRefuse(page, CHEMINS.agentDemandes)).toBe(false);
  });

  test("un agent de l'ARSTM n'accède pas à l'instruction des demandes", async ({ page }) => {
    await connecterAgent(page, COMPTES.agentArstm);
    await page.goto(CHEMINS.agentDemandes);

    expect(await accesRefuse(page, CHEMINS.agentDemandes)).toBe(true);
  });

  test("un agent de l'ARSTM n'accède pas au registre des marins", async ({ page }) => {
    await connecterAgent(page, COMPTES.agentArstm);
    await page.goto(CHEMINS.agentMarins);

    expect(await accesRefuse(page, CHEMINS.agentMarins)).toBe(true);
  });

  test("un agent de l'ARSTM accède bien à son propre espace formation", async ({ page }) => {
    // Second témoin positif : le refus précédent vient de l'habilitation,
    // pas d'une session qui n'aurait jamais été ouverte.
    await connecterAgent(page, COMPTES.agentArstm);
    await page.goto(CHEMINS.agentArstm);

    expect(await accesRefuse(page, CHEMINS.agentArstm)).toBe(false);
  });
});

test.describe("cloisonnement entre un marin et l'administration", () => {
  test("un marin n'accède à aucun écran de l'administration", async ({ page }) => {
    await connecterMarin(page);

    // Les trois écrans les plus sensibles : instruction, registre, journal
    // d'audit. Le journal est le plus grave des trois, il contient la trace
    // de toutes les consultations de pièces d'identité.
    for (const chemin of [CHEMINS.agentDemandes, CHEMINS.agentMarins, CHEMINS.agentJournal]) {
      await page.goto(chemin);
      expect(await accesRefuse(page, chemin), `écran accessible à tort : ${chemin}`).toBe(true);
    }
  });

  test("un visiteur non authentifié n'accède à aucun espace privé", async ({ page }) => {
    for (const chemin of [CHEMINS.documents, CHEMINS.demandes, CHEMINS.agentDemandes]) {
      await page.goto(chemin);

      // Sans session, l'application doit renvoyer vers une connexion, pas
      // afficher un écran vide qui laisserait croire à un dossier sans
      // données.
      await expect(page, `écran servi sans session : ${chemin}`).toHaveURL(/connexion/);
    }
  });
});

test.describe("l'interface ne propose pas ce qu'elle interdit", () => {
  test("un agent sans droit d'instruction ne voit pas le bouton d'approbation", async ({
    page,
  }) => {
    await connecterAgent(page, COMPTES.agentArstm);
    await page.goto(CHEMINS.agentTableauBord);

    // Masquer un bouton n'est pas une protection, le serveur reste l'autorité.
    // Mais proposer une action qui sera refusée est une faute d'interface :
    // l'agent croit pouvoir agir, et apprend le contraire après coup.
    await expect(page.getByRole("button", { name: /approuver|délivrer/i })).toHaveCount(0);
  });
});