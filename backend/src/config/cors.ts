// ============================================
// config/cors.ts
// CORS restreint aux origines déclarées dans FRONTEND_URL.
// Les requêtes sans origine (curl, sondes de santé, scan QR en HTML statique)
// sont acceptées : elles ne portent pas de cookie de session.
// ============================================
import cors from "cors";
import { ORIGINES_AUTORISEES } from "./env.js";

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin || ORIGINES_AUTORISEES.includes(origin)) {
      return callback(null, true);
    }
    // Refus sans lever : le navigateur bloque déjà la réponse. Lever une
    // erreur ici produirait un 500 et une alerte serveur pour un simple
    // appel depuis une origine non déclarée.
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});