// ============================================
// __tests__/permissions.test.ts
// Invariants de la matrice d'habilitations (remarque PGMI-01).
// Ces tests échouent si un rôle gagne un droit qui ne lui revient pas.
// ============================================
import { describe, it, expect } from "vitest";
import { AGENT_ROLE, ALL_AGENT_ROLES } from "../domain/roles.js";
import {
  PERMISSION,
  PORTEE,
  PERMISSIONS_PAR_ROLE,
  aPermission,
  permissionsDuRole,
  porteeDuRole,
  filtrePortee,
} from "../domain/permissions.js";

describe("Matrice des habilitations", () => {
  it("couvre tous les rôles déclarés", () => {
    for (const role of ALL_AGENT_ROLES) {
      expect(PERMISSIONS_PAR_ROLE[role]).toBeDefined();
    }
  });

  it("n'accorde aucun droit à un rôle inconnu", () => {
    expect(permissionsDuRole("ROLE_INVENTE")).toEqual([]);
    expect(permissionsDuRole(null)).toEqual([]);
    expect(permissionsDuRole(undefined)).toEqual([]);
  });

  it("réserve la décision sur une demande à la DGAM (R21)", () => {
    expect(aPermission(AGENT_ROLE.DGAM_AGENT, PERMISSION.DEMANDE_DECIDER)).toBe(true);
    expect(aPermission(AGENT_ROLE.ARSTM_MANAGER, PERMISSION.DEMANDE_DECIDER)).toBe(false);
    expect(aPermission(AGENT_ROLE.ARSTM_REGISTRAR, PERMISSION.DEMANDE_DECIDER)).toBe(false);
  });

  it("interdit à l'administrateur plateforme d'instruire une demande", () => {
    expect(aPermission(AGENT_ROLE.PLATFORM_ADMIN, PERMISSION.DEMANDE_DECIDER)).toBe(false);
    expect(aPermission(AGENT_ROLE.PLATFORM_ADMIN, PERMISSION.DEMANDE_INSTRUIRE)).toBe(false);
  });

  it("interdit à l'administrateur métier tout accès nominatif au registre", () => {
    expect(aPermission(AGENT_ROLE.BUSINESS_ADMIN, PERMISSION.MARIN_RECHERCHER)).toBe(false);
    expect(aPermission(AGENT_ROLE.BUSINESS_ADMIN, PERMISSION.MARIN_CONSULTER)).toBe(false);
    expect(aPermission(AGENT_ROLE.BUSINESS_ADMIN, PERMISSION.REFERENTIEL_GERER)).toBe(true);
  });

  it("réserve l'inscription d'un élève à la scolarité ARSTM (R19)", () => {
    expect(aPermission(AGENT_ROLE.ARSTM_REGISTRAR, PERMISSION.ELEVE_INSCRIRE)).toBe(true);
    expect(aPermission(AGENT_ROLE.ARSTM_MANAGER, PERMISSION.ELEVE_INSCRIRE)).toBe(true);
    expect(aPermission(AGENT_ROLE.ARSTM_TRAINING, PERMISSION.ELEVE_INSCRIRE)).toBe(false);
    expect(aPermission(AGENT_ROLE.DGAM_AGENT, PERMISSION.ELEVE_INSCRIRE)).toBe(false);
  });

  it("réserve la gestion des comptes agents à l'administrateur plateforme", () => {
    const porteurs = ALL_AGENT_ROLES.filter((role) =>
      aPermission(role, PERMISSION.AGENT_GERER),
    );
    expect(porteurs).toEqual([AGENT_ROLE.PLATFORM_ADMIN]);
  });

  it("réserve la suspension d'un marin à la supervision", () => {
    const porteurs = ALL_AGENT_ROLES.filter((role) =>
      aPermission(role, PERMISSION.MARIN_SUSPENDRE),
    );
    expect(porteurs.sort()).toEqual(
      [AGENT_ROLE.DGAM_SUPERVISOR, AGENT_ROLE.PLATFORM_ADMIN].sort(),
    );
  });
});

describe("Portée des données", () => {
  it("donne la vue nationale aux seuls rôles DGAM", () => {
    expect(porteeDuRole(AGENT_ROLE.DGAM_AGENT)).toBe(PORTEE.NATIONAL);
    expect(porteeDuRole(AGENT_ROLE.DGAM_SUPERVISOR)).toBe(PORTEE.NATIONAL);
    expect(porteeDuRole(AGENT_ROLE.ARSTM_MANAGER)).toBe(PORTEE.AUTORITE);
  });

  it("borne un rôle inconnu à son autorité, jamais au national", () => {
    expect(porteeDuRole("ROLE_INVENTE")).toBe(PORTEE.AUTORITE);
  });

  it("produit un filtre Prisma vide pour un rôle national", () => {
    expect(filtrePortee(AGENT_ROLE.DGAM_AGENT, "auth-dgam")).toEqual({});
  });

  it("borne un agent ARSTM à sa propre autorité", () => {
    expect(filtrePortee(AGENT_ROLE.ARSTM_REGISTRAR, "auth-arstm")).toEqual({
      authorityId: "auth-arstm",
    });
  });
});