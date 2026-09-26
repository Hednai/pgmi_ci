// ============================================
// services/payment/SandboxProviders.ts
// Implémentations de développement du paiement.
//
// Le bac à sable confirme immédiatement : le parcours complet (demande,
// paiement, instruction, délivrance) est déroulable en local sans compte
// marchand. Aucun montant réel n'est débité.
// ============================================
import { logger } from "../../lib/logger.js";
import { PAYMENT_CHANNEL } from "../../domain/status.js";
import { genererReferencePaiement } from "../../utils/reference.js";
import type {
  PaymentProvider,
  DemandePaiement,
  ResultatPaiement,
} from "./PaymentProvider.js";

// Mobile Money en bac à sable (remplace CinetPay en développement)
export const sandboxMobileMoneyProvider: PaymentProvider = {
  code: "SANDBOX_MOBILE_MONEY",
  canal: PAYMENT_CHANNEL.MOBILE_MONEY,

  async initier(demande: DemandePaiement): Promise<ResultatPaiement> {
    const referenceExterne = genererReferencePaiement();
    logger.info(
      { reference: demande.reference, montant: demande.montant, operateur: demande.operateur },
      "Paiement Mobile Money simulé",
    );

    return {
      succes: true,
      referenceExterne,
      statut: "PAID",
      message: "Paiement confirmé en mode bac à sable.",
    };
  },

  async verifier(referenceExterne: string): Promise<ResultatPaiement> {
    return { succes: true, referenceExterne, statut: "PAID" };
  },
};

// Paiement en espèces au guichet : l'agent saisit l'encaissement, le
// paiement est donc confirmé à l'initiation.
export const cashDeskProvider: PaymentProvider = {
  code: "CASH_DESK",
  canal: PAYMENT_CHANNEL.CASH,

  async initier(demande: DemandePaiement): Promise<ResultatPaiement> {
    const referenceExterne = genererReferencePaiement();
    logger.info({ reference: demande.reference }, "Encaissement au guichet enregistré");
    return {
      succes: true,
      referenceExterne,
      statut: "PAID",
      message: "Encaissement au guichet enregistré.",
    };
  },

  async verifier(referenceExterne: string): Promise<ResultatPaiement> {
    return { succes: true, referenceExterne, statut: "PAID" };
  },
};
