// ============================================
// __tests__/rules.test.ts
// Tests des invariants métier qui ne dépendent pas de la base.
//
// Ce sont les règles qu'un futur développeur risque de casser sans s'en
// rendre compte : matrice de transitions, séparation des pouvoirs, quorum,
// masquage du nom sur la page publique.
// ============================================
import { describe, it, expect } from "vitest";
import {
  REQUEST_TRANSITIONS,
  REQUEST_STATUS,
  IMMUTABLE_DOCUMENT_STATUSES,
  DOCUMENT_STATUS,
} from "../domain/status.js";
import { ARSTM_ROLES, DGAM_DECISION_ROLES, AGENT_ROLE } from "../domain/roles.js";
import { EXPIRY_REMINDER_STEPS, DEFAULT_SESSION_QUORUM } from "../domain/rules.js";
import { masquerNom } from "../utils/reference.js";
import { calculerJoursEmbarquement, joursAvantExpiration } from "../utils/dates.js";
import { hashPassword, verifyPassword } from "../lib/password.js";

describe("Workflow des demandes", () => {
  it("refuse de passer directement de SUBMITTED à APPROVED", () => {
    expect(REQUEST_TRANSITIONS.SUBMITTED).not.toContain(REQUEST_STATUS.APPROVED);
  });

  it("n'autorise aucune sortie d'un statut terminal", () => {
    expect(REQUEST_TRANSITIONS.REJECTED).toHaveLength(0);
    expect(REQUEST_TRANSITIONS.DOCUMENT_AVAILABLE).toHaveLength(0);
  });

  it("mène d'une approbation à la mise à disposition du document", () => {
    expect(REQUEST_TRANSITIONS.APPROVED).toContain(REQUEST_STATUS.DOCUMENT_AVAILABLE);
  });
});

describe("R21, séparation DGAM et ARSTM", () => {
  it("n'inclut aucun rôle ARSTM parmi les rôles décisionnaires", () => {
    for (const role of ARSTM_ROLES) {
      expect(DGAM_DECISION_ROLES).not.toContain(role);
    }
  });

  it("réserve la décision aux agents et superviseurs DGAM", () => {
    expect(DGAM_DECISION_ROLES).toEqual([AGENT_ROLE.DGAM_AGENT, AGENT_ROLE.DGAM_SUPERVISOR]);
  });
});

describe("R2, immuabilité des documents traités", () => {
  it("classe un document vérifié comme non modifiable", () => {
    expect(IMMUTABLE_DOCUMENT_STATUSES).toContain(DOCUMENT_STATUS.VERIFIED);
    expect(IMMUTABLE_DOCUMENT_STATUSES).toContain(DOCUMENT_STATUS.OFFICIAL_DIGITAL);
  });

  it("laisse un document déposé modifiable", () => {
    expect(IMMUTABLE_DOCUMENT_STATUSES).not.toContain(DOCUMENT_STATUS.SCANNED);
  });
});

describe("R15 à R17, paliers de relance ARSTM", () => {
  it("ouvre la fenêtre de rappel à un an", () => {
    expect(EXPIRY_REMINDER_STEPS[0]?.daysBefore).toBe(365);
  });

  it("force le SMS sur le dernier palier, non désactivable", () => {
    const dernier = EXPIRY_REMINDER_STEPS.at(-1);
    expect(dernier?.daysBefore).toBe(30);
    expect(dernier?.forceSms).toBe(true);
    expect(dernier?.alertDgam).toBe(true);
  });

  it("retient un quorum par défaut de cinq inscrits", () => {
    expect(DEFAULT_SESSION_QUORUM).toBe(5);
  });
});

describe("R10, confidentialité sur la page publique", () => {
  it("masque le nom du marin en ne laissant que les initiales", () => {
    expect(masquerNom("Kouassi Yao Jean")).toBe("K****** Y** J***");
  });

  it("ne laisse jamais apparaître le nom complet", () => {
    expect(masquerNom("Aminata Bakayoko")).not.toContain("minata");
  });
});

describe("R4, calcul du service en mer", () => {
  it("compte le jour d'embarquement et le jour de débarquement", () => {
    const jours = calculerJoursEmbarquement(
      new Date("2024-01-01T00:00:00Z"),
      new Date("2024-01-31T00:00:00Z"),
    );
    expect(jours).toBe(31);
  });

  it("retourne zéro pour des dates inversées", () => {
    const jours = calculerJoursEmbarquement(
      new Date("2024-02-10T00:00:00Z"),
      new Date("2024-01-10T00:00:00Z"),
    );
    expect(jours).toBe(0);
  });

  it("renvoie un nombre négatif pour un certificat déjà expiré", () => {
    const hier = new Date(Date.now() - 48 * 60 * 60 * 1000);
    expect(joursAvantExpiration(hier)).toBeLessThan(0);
  });
});

describe("Hachage des mots de passe agents", () => {
  it("vérifie un mot de passe correct", async () => {
    const hache = await hashPassword("Pgmi2026!");
    expect(await verifyPassword("Pgmi2026!", hache)).toBe(true);
  });

  it("rejette un mot de passe incorrect", async () => {
    const hache = await hashPassword("Pgmi2026!");
    expect(await verifyPassword("MauvaisMotDePasse", hache)).toBe(false);
  });

  it("produit un haché différent à chaque appel grâce au sel", async () => {
    const premier = await hashPassword("Pgmi2026!");
    const second = await hashPassword("Pgmi2026!");
    expect(premier).not.toBe(second);
  });
});
