// ============================================
// services/payment/PaymentProvider.ts
// Contrat d'un moyen de paiement (pattern Provider).
//
// CinetPay agrège Orange Money, MTN, Wave et Moov. Le paiement au guichet
// suit le même contrat afin que le workflow de demande n'ait pas deux
// chemins distincts selon le mode de règlement.
// ============================================
import type { PaymentChannel, MobileMoneyOperator } from "../../domain/status.js";

export interface DemandePaiement {
  reference: string;
  montant: number;
  devise: string;
  // Opérateur choisi par le marin, absent pour un paiement en espèces
  operateur?: MobileMoneyOperator;
  telephonePayeur?: string;
  description: string;
}

export interface ResultatPaiement {
  succes: boolean;
  // Référence renvoyée par l'opérateur, conservée pour le rapprochement
  referenceExterne: string;
  statut: "PENDING" | "PAID" | "FAILED";
  // URL de redirection quand l'opérateur en fournit une
  urlPaiement?: string;
  message?: string;
}

export interface PaymentProvider {
  readonly code: string;
  readonly canal: PaymentChannel;
  initier(demande: DemandePaiement): Promise<ResultatPaiement>;
  verifier(referenceExterne: string): Promise<ResultatPaiement>;
}
