// ============================================
// vite.config.ts
// Configuration du client PGMI.
//
// Trois points structurants :
//   - alias @ vers src, pour éviter les chemins relatifs profonds ;
//   - proxy /api vers le backend en développement, donc pas de CORS local ;
//   - PWA installable, mobile-first et portrait (cahier des charges 3.1).
// ============================================
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "PGMI, Plateforme de Gestion des Marins Ivoiriens",
        short_name: "PGMI",
        description:
          "Dossier maritime numérique des gens de mer de Côte d'Ivoire.",
        lang: "fr",
        start_url: "/",
        display: "standalone",
        // Verrouillage en portrait : l'application est conçue pour une main
        orientation: "portrait",
        background_color: "#f1f5f9",
        theme_color: "#003049",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Le référentiel change peu : servi depuis le cache, rafraîchi en fond
        runtimeCaching: [
          {
            urlPattern: /\/api\/referentiels/,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "pgmi-referentiels" },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/uploads": { target: "http://localhost:4000", changeOrigin: true },
    },
  },
});
