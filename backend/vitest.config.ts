// ============================================
// vitest.config.ts
// Configuration des tests backend (environnement Node).
//
// Les variables d'environnement factices sont posées ici : config/env.ts
// valide au chargement et termine le processus si une variable manque. Les
// tests n'ouvrent aucune connexion réelle à la base.
// ============================================
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    env: {
      // Environnement de test : désactive les optimisations de production
      NODE_ENV: "test",
      // Base de données factice : les tests qui touchent Prisma sont mockés
      DATABASE_URL: "postgresql://test:test@localhost:5432/testdb",
      FRONTEND_URL: "http://localhost:5173",
      // Secrets factices : 32 caractères minimum requis par env.ts
      JWT_ACCESS_SECRET: "secret-de-test-de-plus-de-32-caracteres-aaaa",
      JWT_REFRESH_SECRET: "secret-de-test-de-plus-de-32-caracteres-bbbb",
      QR_SIGNING_SECRET: "secret-de-test-de-plus-de-32-caracteres-cccc",
      // Fournisseur console : aucun SMS ni email réel en test
      SMS_PROVIDER: "console",
      // Mode démonstration désactivé : les gardes de production s'appliquent
      DEMO_MODE: "false",
      // Le code OTP n'est jamais exposé dans les réponses de test
      EXPOSE_OTP_IN_RESPONSE: "false",
    },
  },
});