// ============================================
// utils/auditLog.ts
// Écriture du journal immuable (R5, R14).
//
// C'est la seule porte d'écriture de la table AuditLog : aucune route API
// ne permet de créer, modifier ou supprimer une entrée.
// ============================================
import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { logger } from "../lib/logger.js";

// Catalogue des actions tracées. Une constante évite les fautes de frappe
// qui rendraient un journal inexploitable à la recherche.
export const AUDIT_ACTION = {
  AGENT_LOGIN: "AGENT_LOGIN",
  AGENT_LOGOUT: "AGENT_LOGOUT",
  MARIN_OTP_REQUEST: "MARIN_OTP_REQUEST",
  MARIN_LOGIN: "MARIN_LOGIN",
  MARIN_REGISTER: "MARIN_REGISTER",
  // Réinitialisation du mot de passe d'un marin contre un code à usage unique
  MARIN_PASSWORD_RESET: "MARIN_PASSWORD_RESET",
  MARIN_ACTIVATE: "MARIN_ACTIVATE",
  MARIN_SUSPEND: "MARIN_SUSPEND",
  MARIN_CREATED_BY_ARSTM: "MARIN_CREATED_BY_ARSTM",
  MARIN_PHOTO_UPDATE: "MARIN_PHOTO_UPDATE",
  MARIN_PHOTO_DELETE: "MARIN_PHOTO_DELETE",
  MATRICULE_ASSIGNED: "MATRICULE_ASSIGNED",
  DOCUMENT_UPLOAD: "DOCUMENT_UPLOAD",
  DOCUMENT_VERIFY: "DOCUMENT_VERIFY",
  DOCUMENT_REJECT: "DOCUMENT_REJECT",
  DOCUMENT_REVOKE: "DOCUMENT_REVOKE",
  DOCUMENT_ISSUE: "DOCUMENT_ISSUE",
  DOCUMENT_REPLACE: "DOCUMENT_REPLACE",
  // Déclaration d'un embarquement par le marin
  EMBARKATION_DECLARE: "EMBARKATION_DECLARE",
  EMBARKATION_SUBMIT: "EMBARKATION_SUBMIT",
  EMBARKATION_VERIFY: "EMBARKATION_VERIFY",
  EMBARKATION_REJECT: "EMBARKATION_REJECT",
  // Pièces complémentaires demandées au marin sur un mouvement
  EMBARKATION_INFO_REQUESTED: "EMBARKATION_INFO_REQUESTED",
  // Relevé de navigation délivré au marin
  NAVIGATION_RECORD_ISSUED: "NAVIGATION_RECORD_ISSUED",
  REQUEST_SUBMIT: "REQUEST_SUBMIT",
  REQUEST_ASSIGN: "REQUEST_ASSIGN",
  REQUEST_STATUS_CHANGE: "REQUEST_STATUS_CHANGE",
  REQUEST_APPROVE: "REQUEST_APPROVE",
  REQUEST_REJECT: "REQUEST_REJECT",
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  SESSION_CREATE: "SESSION_CREATE",
  SESSION_SCHEDULE: "SESSION_SCHEDULE",
  SESSION_RESULT: "SESSION_RESULT",
  ENROLLMENT_CREATE: "ENROLLMENT_CREATE",
  ENROLLMENT_STATUS_CHANGE: "ENROLLMENT_STATUS_CHANGE",
  REFERENTIAL_UPDATE: "REFERENTIAL_UPDATE",
  QR_VERIFICATION: "QR_VERIFICATION",
  // Lecture d'une pièce jointe : le fichier est une pièce d'identité ou un
  // certificat, sa consultation est une action sensible au sens de R14.
  FILE_READ: "FILE_READ",
  // Suppression d'une pièce abandonnée après épuisement des tentatives.
  // Un fichier qui reste dans le stockage alors que l'application le croit
  // effacé doit être visible, pas noyé dans les journaux techniques.
  FILE_DELETE_ABANDONED: "FILE_DELETE_ABANDONED",
  EXPIRY_SCAN_RUN: "EXPIRY_SCAN_RUN",
} as const;
export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

export interface AuditEntry {
  actorType: "AGENT" | "MARIN" | "SYSTEM" | "PUBLIC";
  actorId?: string | null;
  actorLabel?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

// Extraire l'adresse IP réelle derrière un proxy (Render, Nginx)
const extraireIp = (req?: Request): string | undefined => {
  if (!req) return undefined;
  const entete = req.headers["x-forwarded-for"];
  if (typeof entete === "string" && entete.length > 0) {
    return entete.split(",")[0]?.trim();
  }
  return req.ip;
};

// Écrire une entrée de journal.
// L'échec d'écriture ne doit jamais faire échouer l'action métier : il est
// journalisé, puis ignoré.
export const logAction = async (entree: AuditEntry): Promise<void> => {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: entree.actorType,
        actorId: entree.actorId ?? null,
        actorLabel: entree.actorLabel ?? null,
        action: entree.action,
        targetType: entree.targetType ?? null,
        targetId: entree.targetId ?? null,
        ip: extraireIp(entree.req) ?? null,
        userAgent: entree.req?.headers["user-agent"] ?? null,
        metadata: entree.metadata ? JSON.stringify(entree.metadata) : null,
      },
    });
  } catch (err) {
    logger.error({ err, action: entree.action }, "Écriture de l'audit log impossible");
  }
};