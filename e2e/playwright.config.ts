// ============================================
// e2e/playwright.config.ts
// Tests de bout en bout du parcours PGMI.
//
// Les tests unitaires vérifient des règles isolées. Ils ne vérifient pas
// qu'un marin se connecte, dépose ses pièces, qu'un agent de la DGAM les
// approuve, et que l'écran du marin se met à jour sans rechargement. Ce
// dernier point demande deux navigateurs en parallèle : il ne peut être
// vérifié qu'ici.
//
// Les tests tournent contre le mode démonstration du frontend, sans backend
// ni base de données. C'est volontaire : un test de bout en bout qui exige
// PostgreSQL et Supabase ne tournerait jamais en intégration continue, donc
// ne tournerait jamais. Le parcours et le rendu sont vérifiés ici ; les
// règles serveur le sont par les tests unitaires, et la chaîne complète par
// la recette manuelle de la partie I.7 du guide.
// ============================================
import { defineConfig, devices } from "@playwright/test";

// Port de l'aperçu Vite lancé pour les tests. Déclaré une fois, utilisé par
// le serveur et par l'adresse de base.
const PORT = Number(process.env.PORT_E2E ?? 4173);
const ADRESSE = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests",

  // Chaque test est indépendant : il ouvre ses propres contextes de
  // navigateur et ne partage aucun état avec les autres.
  fullyParallel: true,

  // Un test marqué .only oublié ne doit pas réduire la couverture en silence
  forbidOnly: Boolean(process.env.CI),

  // Une seule reprise en intégration continue : elle absorbe la lenteur des
  // exécuteurs partagés sans masquer un test réellement instable.
  retries: process.env.CI ? 1 : 0,

  // Un seul exécuteur en CI : les exécuteurs gratuits ont deux coeurs, et
  // paralléliser y rend les attentes réseau imprévisibles.
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: ADRESSE,
    // Trace conservée seulement à la première reprise : elle est volumineuse
    // et n'a d'intérêt que sur un échec.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    // Les réseaux ivoiriens étant lents, les écrans tolèrent l'attente. Les
    // délais sont donc larges, mais bornés.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Le cahier des charges impose le mobile d'abord : au moins un
      // parcours doit être vérifié sur un format téléphone.
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],

  // Playwright démarre lui-même l'aperçu du frontend construit, en mode
  // démonstration. reuseExistingServer évite de relancer un serveur déjà
  // ouvert pendant le développement.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    cwd: "../frontend",
    url: ADRESSE,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_MODE_DEMO: "true",
      VITE_API_URL: "",
    },
  },
});