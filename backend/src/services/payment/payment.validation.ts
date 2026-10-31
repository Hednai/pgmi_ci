// ============================================
// services/payment/payment.validation.ts
// Schéma Zod d'un ordre de règlement, commun à tous les objets payables.
//
// Une demande de certificat, un mouvement et, demain, un relevé de
// navigation se règlent par le même geste : un canal, éventuellement un
// opérateur Mobile Money, éventuellement un numéro à débiter. Le schéma vit
// donc à côté du service de paiement et non dans une fonctionnalité, pour
// qu'une évolution du moyen de paiement ne se fasse pas à deux endroits qui
// finiraient par diverger.
//
// Le montant n'y figure jamais : il est lu côté serveur sur l'objet payé.
// ============================================
import { z } from "zod";
import { PAYMENT_CHANNEL, MOBILE_MONEY_OPERATORS } from "../../domain/status.js";

export const reglementSchema = z
  .object({
    canal: z.enum([PAYMENT_CHANNEL.MOBILE_MONEY, PAYMENT_CHANNEL.CASH]),
    operateur: z.enum(MOBILE_MONEY_OPERATORS).optional(),
    telephonePayeur: z.string().trim().max(20).optional(),
  })
  .refine(
    (donnees) => donnees.canal !== PAYMENT_CHANNEL.MOBILE_MONEY || Boolean(donnees.operateur),
    { message: "Choisissez un opérateur Mobile Money.", path: ["operateur"] },
  );