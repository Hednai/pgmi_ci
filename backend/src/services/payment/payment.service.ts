// ============================================
// services/payment/payment.service.ts
// Orchestration du paiement des frais de dossier.
//
// Le service choisit le fournisseur selon le canal demandé, enregistre le
// paiement, et laisse le workflow de demande décider de la suite (R8).
// ============================================
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { PAYMENT_CHANNEL, PAYMENT_STATUS, PAYMENT_TARGET } from "../../domain/status.js";
import type { PaymentChannel, MobileMoneyOperator } from "../../domain/status.js";
import { NotFoundError, BusinessRuleError } from "../../utils/errors.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
import { genererReferencePaiement } from "../../utils/reference.js";
import type { PaymentProvider } from "./PaymentProvider.js";
import { sandboxMobileMoneyProvider, cashDeskProvider } from "./SandboxProviders.js";

// Registre des fournisseurs disponibles, indexé par canal
const fournisseurs: Record<PaymentChannel, PaymentProvider> = {
  MOBILE_MONEY: sandboxMobileMoneyProvider,
  CASH: cashDeskProvider,
};

export interface DemandeReglement {
  requestId: string;
  canal: PaymentChannel;
  operateur?: MobileMoneyOperator;
  telephonePayeur?: string;
  // Agent qui encaisse, pour un paiement au guichet
  agentId?: string;
}

// Régler les frais d'une demande.
// Le montant vient toujours de la demande enregistrée, jamais du client :
// un montant transmis par le navigateur serait modifiable.
export const reglerDemande = async (demande: DemandeReglement) => {
  const requete = await prisma.renewalRequest.findUnique({
    where: { id: demande.requestId },
    include: { certificateType: true, payments: true },
  });

  if (!requete) throw new NotFoundError("Demande introuvable.");

  const dejaPaye = requete.payments.some(
    (paiement) => paiement.status === PAYMENT_STATUS.PAID,
  );
  if (dejaPaye) {
    throw new BusinessRuleError("Les frais de cette demande sont déjà réglés.", "R8");
  }

  if (requete.feeAmount <= 0) {
    throw new BusinessRuleError("Cette demande n'est soumise à aucun frais.");
  }

  const fournisseur = fournisseurs[demande.canal];

  const resultat = await fournisseur.initier({
    reference: requete.reference,
    montant: requete.feeAmount,
    devise: requete.currency,
    operateur: demande.operateur,
    telephonePayeur: demande.telephonePayeur,
    description: `Frais de dossier ${requete.certificateType.label}`,
  });

  const paiement = await prisma.payment.create({
    data: {
      requestId: requete.id,
      provider: demande.operateur ?? fournisseur.code,
      channel: demande.canal,
      amount: requete.feeAmount,
      currency: requete.currency,
      status: resultat.statut,
      payerPhone: demande.telephonePayeur ?? null,
      externalRef: resultat.referenceExterne,
      paidAt: resultat.statut === PAYMENT_STATUS.PAID ? new Date() : null,
    },
  });

  await logAction({
    actorType: demande.agentId ? "AGENT" : "MARIN",
    actorId: demande.agentId ?? requete.marinId,
    action:
      resultat.statut === PAYMENT_STATUS.PAID
        ? AUDIT_ACTION.PAYMENT_CONFIRMED
        : AUDIT_ACTION.PAYMENT_INITIATED,
    targetType: "Payment",
    targetId: paiement.id,
    metadata: { reference: requete.reference, montant: requete.feeAmount, canal: demande.canal },
  });

  return { paiement, resultat };
};

export interface ReglementMouvement {
  embarquementId: string;
  // Montant et devise lus côté serveur par la garde du service des
  // embarquements, jamais transmis par le navigateur : un montant venu du
  // client serait modifiable avant l'envoi.
  montant: number;
  devise: string;
  canal: PaymentChannel;
  operateur?: MobileMoneyOperator;
  telephonePayeur?: string;
  // Agent qui encaisse, pour un règlement au guichet
  agentId?: string;
}

// Régler les frais de validation d'un mouvement.
//
// Calqué sur reglerDemande, à trois différences près : le montant vient de
// la grille tarifaire et non d'une colonne du dossier, la référence est
// engendrée ici parce qu'un embarquement n'en porte pas, et le paiement est
// rattaché par embarkationId avec targetType EMBARKATION.
export const reglerMouvement = async (reglement: ReglementMouvement) => {
  const mouvement = await prisma.embarkation.findUnique({
    where: { id: reglement.embarquementId },
    include: { payments: true },
  });

  if (!mouvement) throw new NotFoundError("Embarquement introuvable.");

  // Contrôle répété volontairement : la garde du service des embarquements
  // l'a déjà fait, mais ce service ne doit jamais encaisser deux fois le
  // même mouvement, quel que soit son appelant (R23).
  const dejaPaye = mouvement.payments.some(
    (paiement) => paiement.status === PAYMENT_STATUS.PAID,
  );
  if (dejaPaye) {
    throw new BusinessRuleError(
      "Les frais de validation de ce mouvement sont déjà réglés.",
      "R23",
    );
  }

  if (reglement.montant <= 0) {
    throw new BusinessRuleError("Ce mouvement n'est soumis à aucun frais.");
  }

  const reference = genererReferencePaiement();
  const fournisseur = fournisseurs[reglement.canal];

  const resultat = await fournisseur.initier({
    reference,
    montant: reglement.montant,
    devise: reglement.devise,
    operateur: reglement.operateur,
    telephonePayeur: reglement.telephonePayeur,
    description: `Validation d'un mouvement, ${mouvement.vesselName}`,
  });

  const paiement = await prisma.payment.create({
    data: {
      targetType: PAYMENT_TARGET.EMBARKATION,
      embarkationId: mouvement.id,
      provider: reglement.operateur ?? fournisseur.code,
      channel: reglement.canal,
      amount: reglement.montant,
      currency: reglement.devise,
      status: resultat.statut,
      payerPhone: reglement.telephonePayeur ?? null,
      externalRef: resultat.referenceExterne,
      paidAt: resultat.statut === PAYMENT_STATUS.PAID ? new Date() : null,
    },
  });

  await logAction({
    actorType: reglement.agentId ? "AGENT" : "MARIN",
    actorId: reglement.agentId ?? mouvement.marinId,
    action:
      resultat.statut === PAYMENT_STATUS.PAID
        ? AUDIT_ACTION.PAYMENT_CONFIRMED
        : AUDIT_ACTION.PAYMENT_INITIATED,
    targetType: "Payment",
    targetId: paiement.id,
    metadata: {
      reference,
      navire: mouvement.vesselName,
      montant: reglement.montant,
      canal: reglement.canal,
    },
  });

  return { paiement, resultat };
};

// Canaux effectivement disponibles, exposés au frontend pour construire
// l'écran de paiement sans valeur en dur.
export const listerMoyensDePaiement = () => ({
  canaux: Object.keys(fournisseurs) as PaymentChannel[],
  operateurs: ["ORANGE_MONEY", "MTN_MOMO", "WAVE", "MOOV_MONEY"],
  modeBacASable: env.PAYMENT_PROVIDER === "sandbox",
  guichet: PAYMENT_CHANNEL.CASH,
});