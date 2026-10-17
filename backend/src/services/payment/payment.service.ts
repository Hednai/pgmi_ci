// ============================================
// services/payment/payment.service.ts
// Orchestration du paiement des frais de dossier.
//
// Le service choisit le fournisseur selon le canal demandé, enregistre le
// paiement, et laisse le workflow de demande décider de la suite (R8).
// ============================================
import { prisma } from "../../lib/prisma.js";
import { env } from "../../config/env.js";
import { PAYMENT_CHANNEL, PAYMENT_STATUS } from "../../domain/status.js";
import type { PaymentChannel, MobileMoneyOperator } from "../../domain/status.js";
import { NotFoundError, BusinessRuleError } from "../../utils/errors.js";
import { logAction, AUDIT_ACTION } from "../../utils/auditLog.js";
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

// Canaux effectivement disponibles, exposés au frontend pour construire
// l'écran de paiement sans valeur en dur.
export const listerMoyensDePaiement = () => ({
  canaux: Object.keys(fournisseurs) as PaymentChannel[],
  operateurs: ["ORANGE_MONEY", "MTN_MOMO", "WAVE", "MOOV_MONEY"],
  modeBacASable: env.PAYMENT_PROVIDER === "sandbox",
  guichet: PAYMENT_CHANNEL.CASH,
});
