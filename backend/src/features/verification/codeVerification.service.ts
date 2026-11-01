// ============================================
// features/verification/codeVerification.service.ts
// Attribution d'un code court de vérification.
//
// Un seul espace de codes sert la page publique : le scan de /v/<code> doit
// désigner un objet et un seul. Depuis que les mouvements et les relevés de
// navigation portent un QR (R26), l'unicité ne peut plus se contrôler sur la
// seule table des documents, sinon deux objets différents finiraient par
// répondre au même code et la page publique en servirait un au hasard.
//
// Le tirage reste celui de lib/qrcode.ts : six caractères d'un alphabet sans
// ambiguïté visuelle, relus à l'oeil sur un papier.
// ============================================
import { prisma } from "../../lib/prisma.js";
import { generateVerificationCode } from "../../lib/qrcode.js";
import { BusinessRuleError } from "../../utils/errors.js";

// Nombre de tirages avant abandon. Six caractères sur un alphabet de 32
// offrent un milliard de combinaisons : une collision est improbable, six
// collisions d'affilée signalent une anomalie, pas de la malchance.
const TIRAGES_MAX = 6;

export const attribuerCodeVerification = async (): Promise<string> => {
  for (let essai = 0; essai < TIRAGES_MAX; essai += 1) {
    const candidat = generateVerificationCode();

    const [document, mouvement, releve] = await Promise.all([
      prisma.document.findUnique({
        where: { verificationCode: candidat },
        select: { id: true },
      }),
      prisma.embarkation.findUnique({
        where: { verificationCode: candidat },
        select: { id: true },
      }),
      prisma.navigationRecord.findUnique({
        where: { verificationCode: candidat },
        select: { id: true },
      }),
    ]);

    if (!document && !mouvement && !releve) return candidat;
  }

  throw new BusinessRuleError("Impossible de générer un code de vérification.");
};