// ============================================
// config/constants.ts
// Constantes techniques transverses. Les règles métier sont dans
// domain/rules.ts : ce fichier ne contient que de l'infrastructure.
// ============================================

// Fenêtres et plafonds du rate limiting (ENF-005)
export const RATE_LIMIT = {
  FENETRE_MS: 15 * 60 * 1000,
  // OTP : 5 demandes par heure et par numéro
  OTP_FENETRE_MS: 60 * 60 * 1000,
  OTP_MAX: 5,
  // Connexion agent : 10 tentatives par 15 minutes
  LOGIN_MAX: 10,
  // Vérification QR publique : généreuse, un inspecteur scanne en rafale
  VERIFY_MAX: 120,
  // Routes authentifiées classiques
  API_MAX: 300,
} as const;

// Limites de la couche HTTP
export const REQUETE = {
  TAILLE_MAX_JSON: "10kb",
} as const;

// Préfixes des références générées
export const PREFIXE = {
  DEMANDE: "REN",
  MATRICULE: "CI-MAR",
  SESSION: "SES",
  PAIEMENT: "PAY",
} as const;

// Pagination par défaut des listes
export const PAGINATION = {
  TAILLE_DEFAUT: 20,
  TAILLE_MAX: 100,
} as const;
