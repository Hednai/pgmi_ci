// ============================================
// lib/jwt.ts
// Génération et vérification des jetons de session.
// Deux secrets distincts : un jeton d'accès volé ne permet pas de forger
// un jeton de rafraîchissement.
// ============================================
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL } from "../domain/rules.js";
import type { AgentRole } from "../domain/roles.js";

// Contenu du jeton. Volontairement minimal : pas de donnée personnelle.
export interface JwtPayload {
  sub: string;
  type: "AGENT" | "MARIN";
  role?: AgentRole;
  authorityId?: string;
  // Horodatage d'émission, comparé à Agent.tokensRevokedAt à chaque requête
  iat?: number;
  exp?: number;
}

export const signAccessToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

export const signRefreshToken = (payload: JwtPayload): string =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

// Retourne null au lieu de lever : l'appelant décide du code HTTP
export const verifyAccessToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    return null;
  }
};
