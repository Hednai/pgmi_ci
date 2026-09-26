// ============================================
// features/auth/auth.service.ts
// Logique métier de l'authentification.
//
// Deux parcours distincts :
//   - marin : OTP SMS, aucun mot de passe à retenir, aucune adresse email
//     obligatoire (contrainte terrain, cahier des charges 2.2.1) ;
//   - agent : email et mot de passe, jetons révocables côté serveur.
// ============================================
import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { verifyPassword } from "../../lib/password.js";
import { envoyerOtp } from "../../services/notification/notification.service.js";
import {
  OTP_LENGTH,
  OTP_TTL_MINUTES,
  OTP_MAX_ATTEMPTS,
} from "../../domain/rules.js";
import { MARIN_STATUS, REGISTRATION_SOURCE } from "../../domain/status.js";
import { AGENT_ROLE_LABELS } from "../../domain/roles.js";
import type { AgentRole } from "../../domain/roles.js";
import {
  UnauthorizedError,
  ValidationError,
  BusinessRuleError,
  NotFoundError,
} from "../../utils/errors.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { env } from "../../config/env.js";
import type { InscriptionMarin } from "./auth.validation.js";

// Le code OTP n'est jamais stocké en clair : seul son empreinte l'est.
const hacherCode = (code: string): string =>
  createHash("sha256").update(code).digest("hex");

// Comparaison à temps constant des empreintes
const memeCode = (attendu: string, fourni: string): boolean => {
  const a = Buffer.from(attendu);
  const b = Buffer.from(hacherCode(fourni));
  return a.length === b.length && timingSafeEqual(a, b);
};

// ---- Parcours marin ----

// Émettre un code OTP pour un numéro. Le même appel sert à la connexion et
// à l'inscription : le client n'a pas à savoir si le numéro existe déjà,
// ce qui évite de transformer l'API en annuaire de marins enregistrés.
export const emettreOtp = async (telephone: string) => {
  const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
  const expiration = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  const marinExistant = await prisma.marin.findUnique({
    where: { phone: telephone },
    select: { id: true },
  });

  await prisma.otpCode.create({
    data: {
      phone: telephone,
      codeHash: hacherCode(code),
      purpose: marinExistant ? "LOGIN" : "REGISTRATION",
      expiresAt: expiration,
    },
  });

  await envoyerOtp(telephone, code);

  await logAction({
    actorType: "MARIN",
    actorId: marinExistant?.id ?? null,
    action: AUDIT_ACTION.MARIN_OTP_REQUEST,
    targetType: "Marin",
    targetId: marinExistant?.id,
    metadata: { compteExistant: Boolean(marinExistant) },
  });

  return {
    expiresAt: expiration,
    compteExistant: Boolean(marinExistant),
    // Facilite les essais en local, désactivé d'office en production
    ...(env.EXPOSE_OTP_IN_RESPONSE ? { codeDeveloppement: code } : {}),
  };
};

// Contrôler un code OTP et le consommer.
// Le code est invalidé dès qu'il est accepté : pas de rejeu possible.
const consommerOtp = async (telephone: string, code: string) => {
  const otp = await prisma.otpCode.findFirst({
    where: { phone: telephone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) throw new UnauthorizedError("Aucun code en attente pour ce numéro.");

  if (otp.expiresAt.getTime() < Date.now()) {
    throw new UnauthorizedError("Code expiré. Demandez un nouveau code.");
  }

  if (otp.attempts >= OTP_MAX_ATTEMPTS) {
    throw new UnauthorizedError("Trop de tentatives. Demandez un nouveau code.");
  }

  if (!memeCode(otp.codeHash, code)) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw new UnauthorizedError("Code incorrect.");
  }

  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { consumedAt: new Date() },
  });

  return otp;
};

// Construire la paire de jetons d'un marin
const jetonsMarin = (marinId: string, authorityId: string) => ({
  accessToken: signAccessToken({ sub: marinId, type: "MARIN", authorityId }),
  refreshToken: signRefreshToken({ sub: marinId, type: "MARIN", authorityId }),
});

// Connecter un marin déjà enregistré
export const connecterMarin = async (telephone: string, code: string) => {
  await consommerOtp(telephone, code);

  const marin = await prisma.marin.findUnique({
    where: { phone: telephone },
    include: { fonction: true },
  });

  if (!marin) {
    throw new NotFoundError("Aucun dossier marin pour ce numéro. Créez votre dossier.");
  }

  if (marin.status === MARIN_STATUS.SUSPENDED) {
    throw new BusinessRuleError("Ce dossier marin est suspendu. Contactez la DGAM.");
  }

  await logAction({
    actorType: "MARIN",
    actorId: marin.id,
    actorLabel: `${marin.firstName} ${marin.lastName}`,
    action: AUDIT_ACTION.MARIN_LOGIN,
    targetType: "Marin",
    targetId: marin.id,
  });

  return { marin, ...jetonsMarin(marin.id, marin.authorityId) };
};

// Créer un dossier marin depuis l'inscription en ligne.
// Le compte reste PENDING : seule une vérification d'identité en personne
// l'active et attribue le matricule (R1, R3).
export const inscrireMarin = async (donnees: InscriptionMarin) => {
  await consommerOtp(donnees.phone, donnees.code);

  const existant = await prisma.marin.findUnique({
    where: { phone: donnees.phone },
    select: { id: true },
  });
  if (existant) {
    throw new ValidationError("Un dossier existe déjà pour ce numéro. Connectez-vous.");
  }

  // Rattachement à l'autorité nationale par défaut
  const dgam = await prisma.authority.findFirst({
    where: { level: "NATIONAL" },
    select: { id: true },
  });
  if (!dgam) throw new NotFoundError("Autorité maritime non configurée.");

  const marin = await prisma.marin.create({
    data: {
      authorityId: dgam.id,
      phone: donnees.phone,
      email: donnees.email && donnees.email.length > 0 ? donnees.email : null,
      firstName: donnees.firstName,
      lastName: donnees.lastName,
      birthDate: donnees.birthDate,
      birthPlace: donnees.birthPlace,
      nationality: donnees.nationality,
      idNumber: donnees.idNumber,
      region: donnees.region ?? null,
      status: MARIN_STATUS.PENDING,
      registrationSource: REGISTRATION_SOURCE.SELF_ONLINE,
      notifyEmail: Boolean(donnees.email),
    },
    include: { fonction: true },
  });

  await logAction({
    actorType: "MARIN",
    actorId: marin.id,
    actorLabel: `${marin.firstName} ${marin.lastName}`,
    action: AUDIT_ACTION.MARIN_REGISTER,
    targetType: "Marin",
    targetId: marin.id,
    metadata: { source: REGISTRATION_SOURCE.SELF_ONLINE },
  });

  return { marin, ...jetonsMarin(marin.id, marin.authorityId) };
};

// ---- Parcours agent ----

export const connecterAgent = async (email: string, motDePasse: string) => {
  const agent = await prisma.agent.findUnique({
    where: { email },
    include: { authority: true },
  });

  // Message identique que le compte existe ou non : ne pas révéler
  // quels emails sont enregistrés.
  const echec = new UnauthorizedError("Identifiants incorrects.");
  if (!agent || !agent.isActive) throw echec;

  const valide = await verifyPassword(motDePasse, agent.passwordHash);
  if (!valide) throw echec;

  await prisma.agent.update({
    where: { id: agent.id },
    data: { lastLoginAt: new Date() },
  });

  await logAction({
    actorType: "AGENT",
    actorId: agent.id,
    actorLabel: `${agent.firstName} ${agent.lastName}`,
    action: AUDIT_ACTION.AGENT_LOGIN,
    targetType: "Agent",
    targetId: agent.id,
  });

  const charge = {
    sub: agent.id,
    type: "AGENT" as const,
    role: agent.role as AgentRole,
    authorityId: agent.authorityId,
  };

  return {
    agent: {
      id: agent.id,
      email: agent.email,
      firstName: agent.firstName,
      lastName: agent.lastName,
      role: agent.role,
      roleLabel: AGENT_ROLE_LABELS[agent.role as AgentRole] ?? agent.role,
      authority: {
        id: agent.authority.id,
        code: agent.authority.code,
        name: agent.authority.name,
        level: agent.authority.level,
      },
    },
    accessToken: signAccessToken(charge),
    refreshToken: signRefreshToken(charge),
  };
};

// Déconnexion serveur d'un agent : tous ses jetons déjà émis sont invalidés
export const deconnecterAgent = async (agentId: string) => {
  await prisma.agent.update({
    where: { id: agentId },
    data: { tokensRevokedAt: new Date() },
  });

  await logAction({
    actorType: "AGENT",
    actorId: agentId,
    action: AUDIT_ACTION.AGENT_LOGOUT,
    targetType: "Agent",
    targetId: agentId,
  });
};

// Échanger un jeton de rafraîchissement contre un nouveau jeton d'accès
export const rafraichirJeton = async (refreshToken: string) => {
  const charge = verifyRefreshToken(refreshToken);
  if (!charge) throw new UnauthorizedError("Jeton de rafraîchissement invalide.");

  if (charge.type === "AGENT") {
    const agent = await prisma.agent.findUnique({
      where: { id: charge.sub },
      select: { id: true, role: true, authorityId: true, isActive: true, tokensRevokedAt: true },
    });
    if (!agent?.isActive) throw new UnauthorizedError();

    const emisLe = (charge.iat ?? 0) * 1000;
    if (agent.tokensRevokedAt && emisLe < agent.tokensRevokedAt.getTime()) {
      throw new UnauthorizedError("Session expirée. Reconnectez-vous.");
    }

    return {
      accessToken: signAccessToken({
        sub: agent.id,
        type: "AGENT",
        role: agent.role as AgentRole,
        authorityId: agent.authorityId,
      }),
    };
  }

  const marin = await prisma.marin.findUnique({
    where: { id: charge.sub },
    select: { id: true, authorityId: true, status: true },
  });
  if (!marin || marin.status === MARIN_STATUS.SUSPENDED) throw new UnauthorizedError();

  return {
    accessToken: signAccessToken({
      sub: marin.id,
      type: "MARIN",
      authorityId: marin.authorityId,
    }),
  };
};
