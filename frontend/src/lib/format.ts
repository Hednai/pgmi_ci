// ============================================
// lib/format.ts
// Formatage des valeurs affichées : dates, montants, durées.
// Centralisé pour que toute l'application parle le même français.
// ============================================

const formatDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const formatDateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const dateCourte = (valeur: string | Date | null | undefined): string => {
  if (!valeur) return "—";
  const date = typeof valeur === "string" ? new Date(valeur) : valeur;
  return Number.isNaN(date.getTime()) ? "—" : formatDate.format(date);
};

export const dateLongue = (valeur: string | Date | null | undefined): string => {
  if (!valeur) return "—";
  const date = typeof valeur === "string" ? new Date(valeur) : valeur;
  return Number.isNaN(date.getTime()) ? "—" : formatDateLongue.format(date);
};

// Montants en francs CFA : pas de décimale, séparateur d'espace insécable
export const montant = (valeur: number, devise = "XOF"): string =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: devise,
    maximumFractionDigits: 0,
  }).format(valeur);

// Durée exprimée en jours, arrondie à l'unité utile pour un marin
export const dureeEnJours = (jours: number): string => {
  if (jours < 0) return `dépassé de ${Math.abs(jours)} jours`;
  if (jours === 0) return "aujourd'hui";
  if (jours === 1) return "1 jour";
  if (jours < 60) return `${jours} jours`;
  const mois = Math.round(jours / 30);
  if (mois < 24) return `${mois} mois`;
  return `${Math.round(mois / 12)} ans`;
};

// Numéro de téléphone lisible : +225 07 01 02 03 04
export const telephone = (valeur: string): string => {
  const chiffres = valeur.replace(/^\+225/, "");
  const groupes = chiffres.match(/.{1,2}/g);
  return groupes ? `+225 ${groupes.join(" ")}` : valeur;
};

// Initiales d'un nom, utilisées par la pastille d'avatar
export const initiales = (nomComplet: string): string =>
  nomComplet
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot.charAt(0).toUpperCase())
    .join("");
