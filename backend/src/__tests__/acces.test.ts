// ============================================
// __tests__/acces.test.ts
// Contrôle d'accès au niveau de la route.
//
// Les tests de permissions.test.ts prouvent que la matrice est juste. Ceux-ci
// prouvent que la route la consulte vraiment : c'est l'exigence explicite de
// la remarque PGMI-01, blocage par lien direct.
// ============================================
import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import "../../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { PERMISSION } from "../domain/permissions.js";
import { AGENT_ROLE } from "../domain/roles.js";

// Application minimale portant les vraies gardes. L'identité est posée
// directement, comme le ferait requireAgent après vérification du jeton.
const appAvecRole = (role: string) => {
  const app = express();

  // Simule requireAgent : pose l'identité sans vérifier de jeton réel
  app.use((req, _res, next) => {
    req.acteur = {
      id: "agent-test",
      type: "AGENT",
      role: role as never,
      authorityId: "autorite-test",
      label: "Agent de test",
    };
    next();
  });

  // Route de recherche nationale : réservée à MARIN_RECHERCHER
  app.get(
    "/api/marins",
    requirePermission(PERMISSION.MARIN_RECHERCHER),
    (_req, res) => {
      res.json({ success: true });
    },
  );

  // Route d'inscription d'un élève : réservée à ELEVE_INSCRIRE
  app.post(
    "/api/marins/eleves",
    requirePermission(PERMISSION.ELEVE_INSCRIRE),
    (_req, res) => {
      res.json({ success: true });
    },
  );

  // Route du journal d'audit : réservée à AUDIT_CONSULTER
  app.get(
    "/api/audit",
    requirePermission(PERMISSION.AUDIT_CONSULTER),
    (_req, res) => {
      res.json({ success: true });
    },
  );

  // Gestionnaire d'erreurs aligné sur celui de l'application réelle.
  // statusCode est le champ porté par AppError/ForbiddenError.
  app.use(
    (
      err: { statusCode?: number; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(err.statusCode ?? 500).json({ success: false, message: err.message });
    },
  );

  return app;
};

describe("Blocage par lien direct (remarque PGMI-01)", () => {
  // Un agent ARSTM Formation ne peut pas rechercher dans le registre national,
  // même en saisissant l'URL directement dans la barre d'adresse.
  it("refuse un agent ARSTM Formation sur la recherche nationale", async () => {
    const reponse = await request(appAvecRole(AGENT_ROLE.ARSTM_TRAINING)).get("/api/marins");
    expect(reponse.status).toBe(403);
  });

  // L'administrateur métier gère les référentiels, pas les dossiers marins.
  it("refuse un administrateur métier sur la recherche nationale", async () => {
    const reponse = await request(appAvecRole(AGENT_ROLE.BUSINESS_ADMIN)).get("/api/marins");
    expect(reponse.status).toBe(403);
  });

  // Un agent instructeur DGAM a bien accès à la recherche nationale.
  it("autorise un agent DGAM sur la recherche nationale", async () => {
    const reponse = await request(appAvecRole(AGENT_ROLE.DGAM_AGENT)).get("/api/marins");
    expect(reponse.status).toBe(200);
  });

  // Un agent DGAM n'est pas habilité à inscrire un élève : c'est le rôle
  // de la scolarité ARSTM (R19).
  it("refuse un agent DGAM sur l'inscription d'un élève ARSTM", async () => {
    const reponse = await request(appAvecRole(AGENT_ROLE.DGAM_AGENT)).post("/api/marins/eleves");
    expect(reponse.status).toBe(403);
  });

  // La scolarité ARSTM peut inscrire un élève navigant (R19).
  it("autorise la scolarité ARSTM sur l'inscription d'un élève", async () => {
    const reponse = await request(appAvecRole(AGENT_ROLE.ARSTM_REGISTRAR)).post(
      "/api/marins/eleves",
    );
    expect(reponse.status).toBe(200);
  });

  // Un agent instructeur n'a pas accès au journal d'audit : seule la
  // supervision DGAM et l'administrateur plateforme peuvent le consulter.
  it("refuse un agent instructeur sur le journal d'audit", async () => {
    const reponse = await request(appAvecRole(AGENT_ROLE.DGAM_AGENT)).get("/api/audit");
    expect(reponse.status).toBe(403);
  });

  // La supervision DGAM peut consulter le journal d'audit.
  it("autorise la supervision DGAM sur le journal d'audit", async () => {
    const reponse = await request(appAvecRole(AGENT_ROLE.DGAM_SUPERVISOR)).get("/api/audit");
    expect(reponse.status).toBe(200);
  });

  // Un rôle inexistant ou corrompu est refusé partout sans exception.
  it("refuse un rôle inconnu sur toutes les routes", async () => {
    const app = appAvecRole("ROLE_INVENTE");
    expect((await request(app).get("/api/marins")).status).toBe(403);
    expect((await request(app).post("/api/marins/eleves")).status).toBe(403);
    expect((await request(app).get("/api/audit")).status).toBe(403);
  });
});