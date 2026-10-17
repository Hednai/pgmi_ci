// ============================================
// utils/dates.ts
// Calculs de dates du domaine maritime.
// Toutes les durées sont exprimées en jours entiers, en UTC, pour éviter
// qu'un changement de fuseau modifie un décompte de service en mer.
// ============================================

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

// Ramener une date à minuit UTC
export const debutDeJournee = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Nombre de jours entre deux dates (positif si fin est postérieure)
export const joursEntre = (debut: Date, fin: Date): number =>
  Math.round((debutDeJournee(fin).getTime() - debutDeJournee(debut).getTime()) / MS_PAR_JOUR);

// Durée d'un embarquement. Le jour d'embarquement et le jour de
// débarquement comptent tous les deux : c'est l'usage STCW.
export const calculerJoursEmbarquement = (debut: Date, fin: Date): number => {
  const jours = joursEntre(debut, fin) + 1;
  return jours > 0 ? jours : 0;
};

// Jours restants avant expiration. Valeur négative si déjà expiré.
export const joursAvantExpiration = (expiration: Date, reference = new Date()): number =>
  joursEntre(reference, expiration);

// Ajouter un nombre de mois à une date (calcul de validité d'un certificat)
export const ajouterMois = (date: Date, mois: number): Date => {
  const resultat = new Date(date);
  resultat.setUTCMonth(resultat.getUTCMonth() + mois);
  return resultat;
};

// Formater une date au format ivoirien courant (JJ/MM/AAAA)
export const formaterDate = (date: Date): string =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(date);
