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
import { REQUETE, RATE_LIMIT, CHEMIN_FLUX_TEMPS_REEL } from "./config/constants.js";
import { MAX_JSON_BODY_UPLOAD, MAX_JSON_BODY_DEMANDE } from "./domain/rules.js";
import { env } from "./config/env.js";
import xssClean from "./middleware/xssClean.js";
import errorHandler from "./middleware/errorHandler.js";
import notFound from "./middleware/notFound.js";
import { requireAgent, requireMarin } from "./middleware/auth.js";
import { asyncHandler } from "./utils/asyncHandler.js";
import { prisma } from "./lib/prisma.js";
import { logger } from "./lib/logger.js";

import { authRouter, profilCourant } from "./features/auth/auth.route.js";
import { marinsRouter } from "./features/marins/marins.route.js";
import { documentsRouter } from "./features/documents/documents.route.js";
import { seaServiceRouter } from "./features/embarkations/embarkations.route.js";
import { relevesRouter } from "./features/navigation/navigation.route.js";
import { demandesRouter } from "./features/requests/requests.route.js";
import { verificationRouter } from "./features/verification/verification.route.js";
import { referentielsRouter } from "./features/referentials/referentials.route.js";
import { conformiteRouter } from "./features/compliance/compliance.route.js";
import { formationsRouter } from "./features/training/training.route.js";
import { dashboardRouter } from "./features/dashboard/dashboard.route.js";
import { auditRouter } from "./features/audit/audit.route.js";
import { filesRouter } from "./features/files/files.route.js";
import { tempsReelRouter } from "./features/realtime/realtime.route.js";
import { verifierCode } from "./features/verification/verification.service.js";
import { verifyLimiter } from "./middleware/limiteurs.js";

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
    //
    // scriptSrc ne contient plus 'unsafe-inline' : le script de la page
    // publique a été sorti dans /verify.js. C'est la page la plus exposée
    // de la plateforme, elle ne doit exécuter que du code servi par le
    // domaine lui-même.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        // Aucune page de ce serveur n'est censée être encadrée ni soumettre
        // de formulaire ailleurs.
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Force HTTPS pendant un an, sous-domaines inclus
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  }),
);

// Les points d'entrée de l'API n'ont rien à faire dans un index de moteur
// de recherche. Source : Google Search Central, X-Robots-Tag.
app.use("/api", (_req, res, next) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
});

app.use(corsMiddleware);
// La compression met les réponses en tampon : sur un flux Server-Sent
// Events, rien n'arriverait au client avant plusieurs kilo-octets
// accumulés. Le flux est donc exclu, le reste de l'API reste compressé.
app.use(
  compression({
    filter: (req, res) =>
      req.path.startsWith(CHEMIN_FLUX_TEMPS_REEL) ? false : compression.filter(req, res),
  }),
);

// ---- Corps de requête ----
// Les routes qui transportent un fichier encodé en base64 sont déclarées
// AVANT le plafond général : express.json n'analyse le corps qu'une seule
// fois, et le premier analyseur dont le chemin correspond l'emporte.
const corpsAvecFichier = express.json({ limit: MAX_JSON_BODY_UPLOAD });

app.use("/api/documents", corpsAvecFichier);
app.use("/api/sea-service", corpsAvecFichier);
app.use("/api/marins/me/photo", corpsAvecFichier);
app.use("/api/demandes", express.json({ limit: MAX_JSON_BODY_DEMANDE }));

// Plafond général : toutes les autres routes restent à 10 ko
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

// Seul l'espace public est servi en statique : il ne contient que les photos
// de profil, affichées par la page publique de vérification (R10). Les
// certificats, Sea Time et pièces jointes passent par /uploads, qui
// vérifie l'identité du demandeur.
//
// Ce montage n'a de sens qu'en stockage local. Avec un stockage distant les
// fichiers ne sont plus sur le disque : le laisser actif ferait répondre un
// 404 à toutes les photos au lieu de laisser la main à la route des pièces
// jointes, qui sait, elle, produire une URL signée.
if (env.STORAGE_PROVIDER === "local") {
  app.use(
    "/uploads/public",
    express.static(join(process.cwd(), "uploads", "public"), { maxAge: "7d" }),
  );
}

// ---- Sondes de santé ----
// Deux sondes distinctes, selon la convention Kubernetes :
//   liveness  : le processus répond-il ?
//   readiness : peut-il servir du trafic métier ? 503 si la base est KO.
// L'hébergeur retire alors l'instance du routage au lieu de lui envoyer des
// requêtes qui échoueront toutes.
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "pgmi-api",
    environnement: env.NODE_ENV,
    horodatage: new Date().toISOString(),
  });
});

app.get(
  "/health/ready",
  asyncHandler(async (_req, res) => {
    let baseDisponible = true;

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      baseDisponible = false;
      // Le message d'erreur peut contenir un nom d'hôte ou un utilisateur :
      // il est journalisé, jamais renvoyé au client.
      logger.error({ err }, "Sonde de disponibilité : base injoignable");
    }

    res.status(baseDisponible ? 200 : 503).json({
      success: baseDisponible,
      service: "pgmi-api",
      verifications: { database: baseDisponible },
      horodatage: new Date().toISOString(),
    });
  }),
);

// ---- Page publique de vérification ----
// Servie en HTML statique par le backend : un seul aller-retour, aucun
// framework à charger, ouverture sous une seconde en 2G (ENF-008).
app.get("/v/:code", (_req, res) => {
  res.sendFile(join(process.cwd(), "public", "verify.html"));
});

// Script de cette page, servi depuis le même domaine pour que la politique
// de sécurité du contenu puisse interdire les scripts en ligne.
app.get("/verify.js", (_req, res) => {
  res.type("application/javascript");
  res.sendFile(join(process.cwd(), "public", "verify.js"));
});

// ---- API ----
app.use("/api/auth", authRouter);
app.get("/api/auth/me", requireAgent, profilCourant);
app.get("/api/auth/me/marin", requireMarin, profilCourant);

app.use("/api/marins", marinsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/sea-service", seaServiceRouter);
app.use("/api/releves", relevesRouter);
app.use("/api/demandes", demandesRouter);
app.use("/api/verification", verificationRouter);
app.use("/api/referentiels", referentielsRouter);
app.use("/api/conformite", conformiteRouter);
app.use("/api/formations", formationsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/audit", auditRouter);

// Flux temps réel. Monté après les autres routes API : il ne sert aucune
// donnée, il ne fait qu'annoncer un changement aux écrans concernés.
app.use("/api/temps-reel", tempsReelRouter);

// Tout le reste des pièces jointes passe par une route qui vérifie
// l'identité du demandeur. Le préfixe reste /uploads : les URL déjà
// enregistrées en base restent valides, aucune migration nécessaire.
app.use("/uploads", filesRouter);

// Vérification par code court, appelée par la page HTML statique.
// Même plafond que /api/verification/:code : c'est le même service public,
// et cette route échappait jusqu'ici au limiteur dédié pour retomber sur le
// plafond générique de l'API, bien plus large.
app.get(
  "/api/v/:code",
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const resultat = await verifierCode(String(req.params.code), req);
    res.status(200).json({ success: true, data: resultat });
  }),
);

// ---- Fin de chaîne ----
app.use(notFound);
app.use(errorHandler);

export default app;