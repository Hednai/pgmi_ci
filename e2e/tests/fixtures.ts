// ============================================
// e2e/tests/fixtures.ts
// Données et gestes partagés par les tests de bout en bout.
//
// Aucun identifiant, libellé ni code n'est écrit dans un test : tout vient
// d'ici. Un changement de jeu de démonstration se répercute en un endroit,
// et un test qui échoue le fait pour une raison métier, pas parce qu'un
// libellé a bougé.
// ============================================
import type { Page } from "@playwright/test";

// Comptes du jeu de démonstration. Ils correspondent à donneesDemo.ts.
export const COMPTES = {
  marin: {
    telephone: "07 01 02 03 04",
    codeOtp: "123456",
  },
  // Agent instructeur de la DGAM : voit et instruit les demandes.
  agentDgam: {
    email: "m.kone@dgam.ci",
    motDePasse: "Pgmi2026!",
  },
  // Agent de l'ARSTM : autorité de formation, pas la DGAM. Il sert à
  // vérifier qu'une autorité ne voit pas les dossiers d'une autre.
  agentArstm: {
    email: "formation@arstm.ci",
    motDePasse: "Pgmi2026!",
  },
} as const;

// Nouveau marin, pour le parcours d'inscription. Le numéro est distinct de
// celui du compte de démonstration : deux tests ne doivent pas se disputer
// le même dossier.
export const NOUVEAU_MARIN = {
  prenom: "Koffi",
  nom: "Adjoumani",
  dateNaissance: "1990-04-17",
  lieuNaissance: "Sassandra",
  nationalite: "Ivoirienne",
  piece: "CI00987654",
  region: "Abidjan",
  telephone: "07 55 66 77 88",
} as const;

// Codes de vérification publique du jeu de démonstration.
// Le second porte un document dont la date est dépassée : c'est le cas que
// la plateforme existe pour détecter.
export const CODES_VERIFICATION = {
  valide: "8F72K9X4P",
  expire: "4K67B2Z5H",
} as const;

// Chemins des écrans, repris de App.tsx. Les disperser dans les tests
// garantirait qu'un changement de route en casse plusieurs sans qu'on sache
// lesquels.
export const CHEMINS = {
  // Espace public et authentification
  verification: "/verification",
  connexionMarin: "/connexion",
  inscription: "/inscription",
  connexionAgent: "/agent/connexion",

  // Espace marin
  accueil: "/accueil",
  documents: "/documents",
  demandes: "/demandes",
  nouvelleDemande: "/demandes/nouvelle",
  serviceMer: "/service-mer",
  conformite: "/conformite",
  formations: "/formations",

  // Espace agent
  agentTableauBord: "/agent",
  agentDemandes: "/agent/demandes",
  agentMarins: "/agent/marins",
  agentVerifications: "/agent/verifications",
  agentArstm: "/agent/arstm",
  agentJournal: "/agent/journal",
  agentReferentiels: "/agent/referentiels",
} as const;

// Connexion d'un marin par code à usage unique.
//
// Le geste est écrit une fois : chaque test qui a besoin d'un marin
// authentifié l'appelle, au lieu de recopier la séquence et de diverger.
export async function connecterMarin(page: Page): Promise<void> {
  await page.goto(CHEMINS.connexionMarin);

  await page.getByLabel(/Numéro de téléphone/i).fill(COMPTES.marin.telephone);
  await page.getByRole("button", { name: /Recevoir mon code/i }).click();

  // Le champ de code est découpé en six cases : la saisie se fait au clavier
  // sur le groupe, pas case par case.
  await page.getByRole("group", { name: /Code de vérification/i }).click();
  await page.keyboard.type(COMPTES.marin.codeOtp);

  await page.getByRole("button", { name: /^Valider$/i }).click();

  // L'attente porte sur la disparition de l'écran de connexion, pas sur un
  // délai : c'est le seul signal fiable que la session est ouverte.
  await page.waitForURL(function (url) {
    return !url.pathname.includes("connexion");
  });
}

// Connexion d'un agent de la DGAM.
export async function connecterAgent(
  page: Page,
  compte: { email: string; motDePasse: string } = COMPTES.agentDgam,
): Promise<void> {
  await page.goto(CHEMINS.connexionAgent);

  await page.getByLabel(/Adresse professionnelle|Courriel|Email/i).fill(compte.email);
  await page.getByLabel(/Mot de passe/i).fill(compte.motDePasse);
  await page.getByRole("button", { name: /Se connecter/i }).click();

  await page.waitForURL(function (url) {
    return !url.pathname.includes("connexion");
  });
}

// Vrai si l'écran affiche un refus d'accès plutôt que le contenu demandé.
// Deux formes sont acceptées : un message d'interdiction, ou une
// redirection hors de l'écran visé. Les deux sont des refus valables ;
// exiger une forme précise rendrait le test dépendant d'un choix
// d'interface qui peut évoluer.
export async function accesRefuse(page: Page, cheminVise: string): Promise<boolean> {
  const redirige = !new URL(page.url()).pathname.startsWith(cheminVise);
  if (redirige) return true;

  const messageRefus = page.getByText(/accès refusé|non autorisé|habilitation|interdit/i);
  return (await messageRefus.count()) > 0;
}