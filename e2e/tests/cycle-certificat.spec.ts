// ============================================
// e2e/tests/cycle-certificat.spec.ts
// Cycle complet d'une demande de certificat.
//
// C'est le parcours qui traverse le plus de code de la plateforme : dépôt
// par le marin, règlement en monnaie mobile, instruction par un agent de la
// DGAM, délivrance, puis vérification du QR produit sur la page publique.
// Chaque étape s'appuie sur la précédente, et c'est précisément ce qu'aucun
// test unitaire ne peut vérifier.
//
// Le test est découpé en étapes nommées plutôt qu'écrit d'un bloc : quand il
// échoue, le rapport dit à quelle étape, ce qui vaut mieux qu'une pile
// d'appels au milieu de deux cents lignes.
//
// Les étapes « agent » tournent dans un second contexte de navigateur : un
// agent et un marin ne partagent ni session ni stockage, les simuler dans le
// même contexte masquerait une fuite de session.
// ============================================
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { CHEMINS, connecterAgent, connecterMarin } from "./fixtures.js";

// Relève la référence d'une demande sur la liste du marin. La référence sert
// ensuite à retrouver le même dossier côté agent : chercher « la première
// demande » des deux côtés ferait passer le test même si les deux écrans
// parlaient de dossiers différents.
async function premiereReference(page: Page): Promise<string> {
  const ligne = page.getByRole("listitem").first();
  await expect(ligne).toBeVisible();

  const texte = await ligne.innerText();
  const reference = /REN-\d{4}-[A-Z0-9]+/.exec(texte)?.[0];

  expect(reference, "Aucune référence de demande lisible sur la liste").toBeTruthy();
  return reference as string;
}

test.describe("cycle de vie d'une demande de certificat", () => {
  test("du dépôt par le marin à la vérification publique du QR", async ({ browser }) => {
    const contexteMarin = await browser.newContext();
    const contexteAgent = await browser.newContext();
    const pageMarin = await contexteMarin.newPage();
    const pageAgent = await contexteAgent.newPage();

    let reference = "";

    try {
      await test.step("le marin dépose une demande", async () => {
        await connecterMarin(pageMarin);
        await pageMarin.goto(CHEMINS.nouvelleDemande);

        // Le type de certificat vient du référentiel servi par l'API : le
        // test prend la première option proposée au lieu d'en coder une.
        const typeCertificat = pageMarin.getByLabel(/Type de document|Certificat/i).first();
        await expect(typeCertificat).toBeVisible();
        await typeCertificat.selectOption({ index: 1 });

        await pageMarin.getByRole("button", { name: /déposer|soumettre|valider/i }).click();

        await pageMarin.goto(CHEMINS.demandes);
        reference = await premiereReference(pageMarin);
      });

      await test.step("la demande attend le paiement", async () => {
        const ligne = pageMarin.getByRole("listitem").filter({ hasText: reference });
        await expect(ligne).toContainText(/attente de paiement/i);
      });

      await test.step("le marin règle les frais en monnaie mobile", async () => {
        const ligne = pageMarin.getByRole("listitem").filter({ hasText: reference });
        await ligne.getByRole("button", { name: /payer|régler/i }).click();

        await pageMarin.getByRole("button", { name: /Orange Money/i }).click();
        await pageMarin.getByRole("button", { name: /confirmer|payer/i }).last().click();

        // Le statut doit quitter l'attente de paiement : c'est la remarque
        // de recette qui a motivé tout le lot.
        await pageMarin.goto(CHEMINS.demandes);
        await expect(
          pageMarin.getByRole("listitem").filter({ hasText: reference }),
        ).not.toContainText(/attente de paiement/i);
      });

      await test.step("l'agent de la DGAM retrouve la demande à instruire", async () => {
        await connecterAgent(pageAgent);
        await pageAgent.goto(CHEMINS.agentDemandes);

        // Le même dossier, retrouvé par sa référence et non par sa position.
        await expect(
          pageAgent.getByRole("listitem").filter({ hasText: reference }),
        ).toBeVisible();
      });

      await test.step("l'agent approuve et délivre le document", async () => {
        const dossier = pageAgent.getByRole("listitem").filter({ hasText: reference });

        await dossier.getByRole("button", { name: /instruire|ouvrir|traiter/i }).first().click();
        await pageAgent.getByRole("button", { name: /approuver|délivrer|valider/i }).first().click();

        const confirmation = pageAgent.getByRole("button", { name: /confirmer/i });
        if ((await confirmation.count()) > 0) {
          await confirmation.first().click();
        }
      });

      await test.step("le marin obtient un code de vérification", async () => {
        await pageMarin.goto(CHEMINS.documents);

        const document = pageMarin.getByRole("listitem").first();
        await document.getByRole("button", { name: /QR|vérification/i }).first().click();

        // Le code doit s'afficher, qu'une vignette ait été produite ou non :
        // l'absence d'image ne doit jamais laisser un indicateur de
        // chargement tourner indéfiniment.
        await expect(pageMarin.getByText(/chargement/i)).toHaveCount(0);
        await expect(pageMarin.getByText(/[A-Z0-9]{9}/).first()).toBeVisible();
      });

      await test.step("le code se vérifie sur la page publique", async () => {
        const codeAffiche = await pageMarin.getByText(/^[A-Z0-9]{9}$/).first().innerText();

        // Contexte neuf, sans session : la page publique doit répondre à
        // n'importe qui, c'est tout son objet.
        const contextePublic = await browser.newContext();
        const pagePublique = await contextePublic.newPage();

        try {
          await pagePublique.goto(`${CHEMINS.verification}?code=${codeAffiche}`);
          await expect(pagePublique.getByText(/authentique/i)).toBeVisible();
        } finally {
          await contextePublic.close();
        }
      });
    } finally {
      await contexteMarin.close();
      await contexteAgent.close();
    }
  });
});