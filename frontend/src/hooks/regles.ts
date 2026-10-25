// ============================================
// lib/regles.ts
// Paramètres métier partagés avec le serveur.
//
// Miroir des constantes de backend/src/domain/rules.ts utilisées par les
// écrans. Le serveur reste seul juge : ces valeurs servent uniquement à
// refuser une saisie avant l'aller-retour réseau, sur une connexion où cet
// aller-retour se paie en secondes.
// ============================================

// Longueur minimale d'un mot de passe, marin comme agent
export const MOT_DE_PASSE_LONGUEUR_MIN = 8;