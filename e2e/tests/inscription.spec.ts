// ============================================
// e2e/tests/inscription.spec.ts
// Création d'un dossier marin, du formulaire au dossier créé.
//
// C'est le premier contact d'un marin avec la plateforme, et souvent le seul
// écran qu'il remplira en entier. Un champ obligatoire qui ne se signale pas,
// un bouton qui reste inactif sans dire pourquoi, et le marin abandonne pour
// retourner au guichet : exactement ce que la plateforme doit éviter.
//
// Le test vérifie aussi que le rappel sur l'activation au guichet est bien
// présent. Ce n'est pas un détail d'affichage : un marin qui croit son
// dossier actif se présentera à l'embarquement avec un dossier qui ne l'est
// pas.
// ============================================
import { test, expect } from "@playwright/test";
import { CHEMINS, NOUVEAU_MARIN } from "./fixtures.js";

test.describe("inscription d'un marin", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(CHEMINS.inscription);
  });

  test("annonce que le dossier sera activé au guichet", async ({ page }) => {
    // Le marin doit savoir, avant de remplir, que la création ne vaut pas
    // activation et que son matricule viendra plus tard.
    await expect(page.getByText(/guichet DGAM/i)).toBeVisible();
    await expect(page.getByText(/matricule/i).first()).toBeVisible();
  });

  test("crée le dossier à partir d'un formulaire complet", async ({ page }) => {
    await page.getByLabel(/^Prénoms$/i).fill(NOUVEAU_MARIN.prenom);
    await page.getByLabel(/^Nom$/i).fill(NOUVEAU_MARIN.nom);
    await page.getByLabel(/Date de naissance/i).fill(NOUVEAU_MARIN.dateNaissance);
    await page.getByLabel(/Lieu de naissance/i).fill(NOUVEAU_MARIN.lieuNaissance);
    await page.getByLabel(/Nationalité/i).fill(NOUVEAU_MARIN.nationalite);
    await page.getByLabel(/Numéro CNI ou passeport/i).fill(NOUVEAU_MARIN.piece);
    await page.getByLabel(/Région de rattachement/i).fill(NOUVEAU_MARIN.region);

    await page.getByRole("button", { name: /Créer mon dossier/i }).click();

    // Le succès se constate par la sortie de l'écran d'inscription, pas par
    // un message précis : la formulation peut changer, le parcours non.
    await page.waitForURL(function (url) {
      return !url.pathname.includes("inscription");
    });

    await expect(page.getByText(/chargement/i)).toHaveCount(0);
  });

  test("refuse un formulaire incomplet sans laisser deviner", async ({ page }) => {
    // Seul le prénom est renseigné : l'écran doit refuser et dire quoi.
    await page.getByLabel(/^Prénoms$/i).fill(NOUVEAU_MARIN.prenom);
    await page.getByRole("button", { name: /Créer mon dossier/i }).click();

    // On reste sur l'écran, et un message apparaît. L'un sans l'autre serait
    // un échec : rester sans message laisse le marin bloqué sans savoir.
    await expect(page).toHaveURL(new RegExp(CHEMINS.inscription));
    await expect(page.getByText(/obligatoire|requis|renseign/i).first()).toBeVisible();
  });

  test("permet de revenir à la connexion si le dossier existe déjà", async ({ page }) => {
    await page.getByRole("link", { name: /déjà un dossier|me connecter/i }).click();

    await expect(page).toHaveURL(new RegExp(CHEMINS.connexionMarin));
  });
});