// ============================================
// app.ts
// Construction de l'application Express.
//
// Séparée de server.ts : l'application est ainsi testable avec Supertest
// sans ouvrir de port.
//
// Ordre des middlewares (une inversion ici affaiblirait la chaîne) :
//   sécurité, compression, corps, nettoyage, routes, 404, erreurs.
// ============================================
import express from "express";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { join } from "node:path";
import { corsMiddleware } from "./config/cors.js";
import { REQUETE, RATE_LIMIT } from "./config/constants.js";
import { env } from "./config/env.js";
import xssClean from "./middleware/xssClean.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";
import { requireAgent, requireMarin } from "./middleware/auth.js";
import { asyncHandler } from "./utils/asyncHandler.js";

import { authRouter, profilCourant } from "./features/auth/auth.route.js";
import { marinsRouter } from "./features/marins/marins.route.js";
import { documentsRouter } from "./features/documents/documents.route.js";
import { seaServiceRouter } from "./features/embarkations/embarkations.route.js";
import { demandesRouter } from "./features/requests/requests.route.js";
import { verificationRouter } from "./features/verification/verification.route.js";
import { referentielsRouter } from "./features/referentials/referentials.route.js";
import { conformiteRouter } from "./features/compliance/compliance.route.js";
import { formationsRouter } from "./features/training/training.route.js";
import { dashboardRouter } from "./features/dashboard/dashboard.route.js";
import { auditRouter } from "./features/audit/audit.route.js";
import { verifierCode } from "./features/verification/verification.service.js";

const app = express();

// Derrière le proxy de l'hébergeur : nécessaire pour que req.ip soit
// l'adresse réelle et non celle du proxy.
app.set("trust proxy", 1);

// ---- Sécurité ----
app.use(
  helmet({
    // La page de vérification est servie par ce même serveur et charge la
    // photo du marin depuis /uploads : la politique reste stricte mais
    // autorise ces deux sources.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(corsMiddleware);
app.use(compression());

// ---- Corps de requête ----
app.use(express.json({ limit: REQUETE.TAILLE_MAX_JSON }));
app.use(express.urlencoded({ extended: true, limit: REQUETE.TAILLE_MAX_JSON }));
app.use(xssClean);

// Plafond général des routes API, en complément des limites spécifiques
app.use(
  "/api",
  rateLimit({
    windowMs: RATE_LIMIT.FENETRE_MS,
    limit: RATE_LIMIT.API_MAX,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message: "Trop de requêtes. Réessayez dans un instant." },
  }),
);

// Pièces jointes stockées sur disque en développement
app.use("/uploads", express.static(join(process.cwd(), "uploads"), { maxAge: "7d" }));

// ---- Sonde de santé ----
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "pgmi-api",
    environnement: env.NODE_ENV,
    horodatage: new Date().toISOString(),
  });
});

// ---- Page publique de vérification ----
// Servie en HTML statique par le backend : un seul aller-retour, aucun
// framework à charger, ouverture sous une seconde en 2G (ENF-008).
app.get("/v/:code", (_req, res) => {
  res.sendFile(join(process.cwd(), "public", "verify.html"));
});

// ---- API ----
app.use("/api/auth", authRouter);
app.get("/api/auth/me", requireAgent, profilCourant);
app.get("/api/auth/me/marin", requireMarin, profilCourant);

app.use("/api/marins", marinsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/sea-service", seaServiceRouter);
app.use("/api/demandes", demandesRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/referentiels", referentielsRouter);
app.use("/api/conformite", conformiteRouter);
app.use("/api/formations", formationsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/audit", auditRouter);

// Vérification par code court, appelée par la page HTML statique
app.get(
  "/api/v/:code",
  asyncHandler(async (req, res) => {
    const resultat = await verifierCode(String(req.params.code), req);
    res.status(200).json({ success: true, data: resultat });
  }),
);

// ---- Fin de chaîne ----
app.use(notFound);
app.use(errorHandler);

export default app;
