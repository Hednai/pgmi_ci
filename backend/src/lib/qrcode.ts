// ============================================
// lib/qrcode.ts
// Codes de vérification et QR codes signés.
//
// Deux objets distincts :
//   - verificationCode : code court lisible, imprimé sous le QR, sert d'URL ;
//   - qrToken : jeton signé encodé dans le QR, vérifiable hors ligne en V2
//     sans appel réseau (fondation 6 du plan de fondation).
// ============================================
import { randomInt, createHmac } from "node:crypto";
import QRCode from "qrcode";
import { env } from "../config/env.js";

// Alphabet sans caractères ambigus (ni 0/O, ni 1/I) : un code lu à l'oeil
// sur un document papier ne doit pas prêter à confusion.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const LONGUEUR_CODE = 6;

// Générer un code court de vérification
export const generateVerificationCode = (): string => {
  let code = "";
  for (let i = 0; i < LONGUEUR_CODE; i += 1) {
    code += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return code;
};

// Nature de l'objet qu'un QR code atteste.
export const QR_CIBLE = {
  DOCUMENT: "DOCUMENT",
  EMBARKATION: "EMBARKATION",
  NAVIGATION_RECORD: "NAVIGATION_RECORD",
} as const;
export type QrCible = (typeof QR_CIBLE)[keyof typeof QR_CIBLE];

// Charge utile signée du QR code. Aucune donnée nominative : seuls la nature
// et l'identifiant de l'objet circulent (R10).
export interface QrPayload {
  cible: QrCible;
  cibleId: string;
  code: string;
  issuedAt: number;
}

// Charge utile de la première génération, émise avant l'ouverture du QR aux
// mouvements et aux relevés. Les QR déjà imprimés sur des documents en
// circulation portent cette forme : elle reste acceptée en lecture.
interface QrPayloadHerite {
  documentId: string;
  code: string;
  issuedAt: number;
}

// Signer une charge utile. Le résultat tient dans un QR de faible densité,
// lisible par un téléphone d'entrée de gamme.
export const signQrPayload = (payload: QrPayload): string => {
  const corps = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", env.QR_SIGNING_SECRET)
    .update(corps)
    .digest("base64url");
  return `${corps}.${signature}`;
};

// Vérifier un jeton QR. Retourne null si la signature ne correspond pas.
export const verifyQrToken = (token: string): QrPayload | null => {
  const [corps, signature] = token.split(".");
  if (!corps || !signature) return null;

  const attendue = createHmac("sha256", env.QR_SIGNING_SECRET)
    .update(corps)
    .digest("base64url");

  if (attendue !== signature) return null;

  try {
    const brut = JSON.parse(Buffer.from(corps, "base64url").toString()) as
      | QrPayload
      | QrPayloadHerite;

    // Un jeton hérité ne porte pas de cible : il désigne un document.
    if ("documentId" in brut) {
      return {
        cible: QR_CIBLE.DOCUMENT,
        cibleId: brut.documentId,
        code: brut.code,
        issuedAt: brut.issuedAt,
      };
    }
    return brut;
  } catch {
    return null;
  }
};

// URL publique imprimée sous le QR code
export const buildVerificationUrl = (code: string): string =>
  `${env.PUBLIC_VERIFY_URL.replace(/\/$/, "")}/${code}`;

// Image du QR code en data URL, prête à être insérée dans un <img>
export const generateQrDataUrl = async (code: string): Promise<string> =>
  QRCode.toDataURL(buildVerificationUrl(code), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 320,
  });