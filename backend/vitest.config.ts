// ============================================
// vitest.config.ts
// Configuration des tests backend (environnement Node).
// ============================================
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
  },
});
