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
    return callback(new Error("Origine non autorisée par la politique CORS."));
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
