// ============================================
// middleware/limiteurs.ts
// Plafonds de requêtes de la plateforme, réunis en un seul endroit.
//
// Ils étaient dispersés entre app.ts, auth.route.ts, verification.route.ts
// et realtime.route.ts. Un point d'entrée restait non plafonné sans que
// personne le voie, et le même plafond était écrit deux fois avec des
// valeurs différentes. Les déclarer ici rend la couverture vérifiable d'un
// coup d'oeil : un nouveau point d'entrée se compare à cette liste.
//
// Le choix de la clé compte autant que le plafond. Limiter par adresse IP
// est le défaut d'express-rate-limit, mais il est faux dans deux cas que
// connaît ce projet : un cybercafé d'Abidjan où plusieurs marins partagent
// une IP, et le guichet de la DGAM où tous les agents sortent derrière
// l'adresse de l'administration.
// ============================================
import { createHash } from "node:crypto";
import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { RATE_LIMIT } from "../config/constants.js";
import { telephoneSchema } from "../features/auth/auth.validation.js";

// Adresse de repli, utilisée quand aucune clé plus précise n'est
// disponible. Jamais la chaîne vide : deux appelants sans clé partageraient
// alors le même compteur.
const parAdresse = (req: Request): string => req.ip ?? "inconnu";

// Clé par numéro de téléphone. Le numéro passe par le même schéma que la
// validation, jamais la chaîne brute : le limiteur s'exécute avant
// validateBody, donc sans normalisation deux écritures du même abonné
// ouvrent deux compteurs et le plafond se contourne en ajoutant un espace.
const parTelephone = (req: Request): string => {
  const resultat = telephoneSchema.safeParse(req.body?.phone);
  return resultat.success ? `tel:${resultat.data}` : parAdresse(req);
};

// Clé par session de rafraîchissement.
//
// Limiter /refresh par IP posait un problème d'exploitation : tous les
// postes du guichet DGAM sortent derrière une seule adresse publique et
// se seraient partagé le même plafond, jusqu'au blocage du guichet entier.
// La clé est donc l'empreinte du jeton présenté, ce qui plafonne bien ce
// qu'on veut plafonner : les essais sur une session donnée.
//
// Le jeton n'est jamais stocké ni journalisé : seule son empreinte sert de
// clé, et elle ne permet pas de le reconstituer.
const parSessionRafraichissement = (req: Request): string => {
  const jeton = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";

  if (jeton.length === 0) {
    return parAdresse(req);
  }

  return `session:${createHash("sha256").update(jeton).digest("hex")}`;
};

// Fabrique commune : même forme de réponse d'erreur pour tous les plafonds,
// afin que le client n'ait qu'un seul cas à traiter.
const limiteur = (options: {
  fenetreMs: number;
  plafond: number;
  message: string;
  cle?: (req: Request) => string;
}) =>
  rateLimit({
    windowMs: options.fenetreMs,
    limit: options.plafond,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: options.cle ?? parAdresse,
    message: { success: false, message: options.message },
  });

// Demande de code SMS : par numéro, pas par adresse.
export const otpLimiter = limiteur({
  fenetreMs: RATE_LIMIT.OTP_FENETRE_MS,
  plafond: RATE_LIMIT.OTP_MAX,
  cle: parTelephone,
  message: "Trop de demandes de code pour ce numéro. Réessayez dans une heure.",
});

export const loginLimiter = limiteur({
  fenetreMs: RATE_LIMIT.FENETRE_MS,
  plafond: RATE_LIMIT.LOGIN_MAX,
  message: "Trop de tentatives de connexion.",
});

export const refreshLimiter = limiteur({
  fenetreMs: RATE_LIMIT.FENETRE_MS,
  plafond: RATE_LIMIT.REFRESH_MAX,
  cle: parSessionRafraichissement,
  message: "Trop de renouvellements pour cette session.",
});

// Vérification publique d'un code : plafond large, un inspecteur d'armement
// scanne parfois tout un équipage en quelques minutes depuis la même
// connexion.
export const verifyLimiter = limiteur({
  fenetreMs: RATE_LIMIT.FENETRE_MS,
  plafond: RATE_LIMIT.VERIFY_MAX,
  message: "Trop de vérifications. Réessayez dans quelques minutes.",
});

// Délivrance d'un ticket de flux temps réel.
export const ticketLimiter = limiteur({
  fenetreMs: RATE_LIMIT.FENETRE_MS,
  plafond: RATE_LIMIT.TICKET_MAX,
  message: "Trop d'ouvertures de flux. Réessayez dans un instant.",
});

// Ouverture du flux lui-même. Le ticket est à usage unique, mais la route
// restait sans plafond : rien n'empêchait de la marteler avec des tickets
// inventés pour sonder leur validité ou saturer le processus.
export const fluxLimiter = limiteur({
  fenetreMs: RATE_LIMIT.FENETRE_MS,
  plafond: RATE_LIMIT.FLUX_MAX,
  message: "Trop d'ouvertures de flux. Réessayez dans un instant.",
});

// Plafond général des routes API, en complément des plafonds spécifiques.
export const apiLimiter = limiteur({
  fenetreMs: RATE_LIMIT.FENETRE_MS,
  plafond: RATE_LIMIT.API_MAX,
  message: "Trop de requêtes. Réessayez dans un instant.",
});