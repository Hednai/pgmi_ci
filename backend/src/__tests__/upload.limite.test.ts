// ============================================
// __tests__/upload.limite.test.ts
// Le plafond HTTP doit laisser passer un fichier conforme et refuser tout
// le reste. Ce test garde la correction de l'étape 1 : si quelqu'un remet
// un plafond unique à 10 ko, il échoue immédiatement.
// ============================================
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../app.js";
import { MAX_UPLOAD_BYTES } from "../domain/rules.js";

// En-tête JPEG réel : le contrôle de signature du service de stockage lit les
// premiers octets, un tampon de remplissage serait refusé pour format invalide
// et le test passerait alors pour la mauvaise raison.
const EN_TETE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
]);

// Construire un JPEG syntaxiquement recevable de la taille demandée.
// L'en-tête réel est suivi de zéros pour atteindre la taille voulue.
const construireJpeg = (octets: number): string =>
  Buffer.concat([
    EN_TETE_JPEG,
    Buffer.alloc(octets - EN_TETE_JPEG.length, 0),
  ]).toString("base64");

// Fichier conforme de 300 ko, taille réaliste pour une photo compressée
const fichierConforme = construireJpeg(300 * 1024);

// Fichier au-delà de la taille autorisée : MAX_UPLOAD_BYTES + 512 ko
const fichierTropGros = construireJpeg(MAX_UPLOAD_BYTES + 512 * 1024);

describe("Plafond HTTP des routes de dépôt", () => {
  // Un fichier de 300 ko doit franchir le plafond HTTP et atteindre la
  // logique métier. L'absence de jeton donne 401, pas 413 : c'est la
  // preuve que le corps a bien été lu avant le refus.
  it("ne renvoie pas 413 sur un dépôt de 300 ko", async () => {
    const reponse = await request(app)
      .post("/api/documents/me")
      .send({
        certificateTypeId: "ct-test",
        fichier: { nom: "cni.jpg", mimeType: "image/jpeg", contenuBase64: fichierConforme },
      });

    // 401 = le corps a été lu, le plafond n'a pas bloqué
    expect(reponse.status).not.toBe(413);
  });

  // Un fichier dépassant MAX_UPLOAD_BYTES doit être rejeté par Express
  // avant même d'atteindre le contrôleur. Le 413 vient du middleware.
  it("refuse un fichier au-delà de la taille autorisée", async () => {
    const reponse = await request(app)
      .post("/api/documents/me")
      .send({
        certificateTypeId: "ct-test",
        fichier: { nom: "gros.pdf", mimeType: "application/pdf", contenuBase64: fichierTropGros },
      });

    expect(reponse.status).toBe(413);
  });

  // Le plafond général de 10 ko s'applique aux routes sans fichier.
  // Ce test garantit que le plafond dédié n'élargit pas les autres routes.
  it("maintient le plafond de 10 ko sur les routes sans fichier", async () => {
    const reponse = await request(app)
      .post("/api/auth/otp/request")
      .send({ phone: "+2250700000000", bourrage: "x".repeat(20000) });

    expect(reponse.status).toBe(413);
  });
});