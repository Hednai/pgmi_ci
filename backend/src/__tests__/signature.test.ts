// ============================================
// __tests__/signature.test.ts
// Le type réel d'un fichier prime sur le type annoncé par le client.
//
// Un attaquant peut renommer un fichier HTML en .jpg et l'envoyer avec
// mimeType "image/jpeg". Ces tests vérifient que le contrôle de signature
// refuse le contenu réel, pas le type déclaré.
// ============================================
import { describe, it, expect } from "vitest";
import { signatureConcorde } from "../services/storage/signature.js";

// Tampons de test : chaque buffer reproduit les premiers octets réels du format
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const pdf = Buffer.from("%PDF-1.7\n%aaa", "latin1");
// Fichier malveillant : HTML déguisé, ne commence par aucune signature connue
const html = Buffer.from("<html><script>alert(1)</script>", "utf8");

describe("Contrôle de signature des fichiers déposés", () => {
  // Cas nominal : le type annoncé correspond au contenu réel
  it("accepte un vrai JPEG annoncé comme JPEG", () => {
    expect(signatureConcorde("image/jpeg", jpeg)).toBe(true);
  });

  // Cas nominal PNG
  it("accepte un vrai PNG", () => {
    expect(signatureConcorde("image/png", png)).toBe(true);
  });

  // Cas nominal PDF
  it("accepte un vrai PDF", () => {
    expect(signatureConcorde("application/pdf", pdf)).toBe(true);
  });

  // Cas d'attaque : un fichier HTML renommé en .jpg ne passe pas.
  // Sans contrôle de signature, ce fichier serait servi avec un
  // Content-Type image/jpeg et exécuté par certains navigateurs.
  it("refuse un fichier HTML déguisé en JPEG", () => {
    expect(signatureConcorde("image/jpeg", html)).toBe(false);
  });

  // Cas d'incohérence : le contenu est un PNG valide mais annoncé comme PDF.
  // La signature PNG ne commence pas par %PDF.
  it("refuse un PNG annoncé comme PDF", () => {
    expect(signatureConcorde("application/pdf", png)).toBe(false);
  });

  // La liste des types acceptés est fermée. Tout type absent est refusé,
  // même si son contenu est valide pour ce format.
  it("refuse un type absent du cahier des charges", () => {
    expect(signatureConcorde("image/svg+xml", jpeg)).toBe(false);
  });
});