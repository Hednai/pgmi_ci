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
  // Renouvellement de session : large pour un usage normal, fermé pour un
  // essai de jetons en série
  REFRESH_MAX: 30,
  // Vérification QR publique : généreuse, un inspecteur scanne en rafale
  VERIFY_MAX: 120,
  // Routes authentifiées classiques
  API_MAX: 300,
  // Tickets d'ouverture de flux temps réel : large, une connexion mobile
  // instable en redemande un à chaque reconnexion
  TICKET_MAX: 60,
  // Ouvertures du flux. Légèrement au-dessus de TICKET_MAX : une ouverture
  // suit toujours un ticket, le surplus couvre les tickets refusés.
  FLUX_MAX: 90,
} as const;

// Paramètres du flux temps réel (Server-Sent Events).
// Aucune de ces valeurs n'est écrite dans le code du diffuseur : les régler
// pour un autre hébergeur se fait ici.
// Cadence des travaux périodiques.
export const PLANIFICATEUR = {
  // Délai avant la première exécution, le temps que le serveur démarre
  DELAI_INITIAL_MS: 30 * 1000,
  // Scan des expirations de documents : une fois par jour suffit
  SCAN_EXPIRATION_MS: 24 * 60 * 60 * 1000,
  // Drainage des suppressions de pièces : fréquent, une pièce d'identité
  // résiduelle dans le stockage ne doit pas attendre la nuit
  NETTOYAGE_STOCKAGE_MS: 15 * 60 * 1000,
} as const;

// Préfixe du flux temps réel. Déclaré ici parce que deux couches en ont
// besoin : la route qui l'expose et la compression qui doit l'éviter.
export const CHEMIN_FLUX_TEMPS_REEL = "/api/temps-reel/flux";

export const TEMPS_REEL = {
  // Battement envoyé au client pour empêcher la fermeture par un proxy.
  // L'hébergeur coupe une connexion muette autour de 60 s, 25 s laisse une
  // marge confortable.
  BATTEMENT_MS: 25 * 1000,
  // Délai de reconnexion demandé au navigateur après une coupure
  RECONNEXION_MS: 5 * 1000,
  // Durée de validité d'un ticket d'ouverture
  TICKET_DUREE_MS: 30 * 1000,
  // Entropie du ticket, en octets
  TICKET_OCTETS: 32,
  // Longueur maximale acceptée pour un ticket présenté. 32 octets en
  // base64url font 43 caractères ; la marge couvre un changement d'encodage.
  TICKET_LONGUEUR_MAX: 64,
  // Tickets simultanément en attente d'ouverture, toutes sessions
  // confondues. Ils expirent en 30 secondes : ce plafond n'est atteint que
  // sous abus.
  MAX_TICKETS_EN_VOL: 5000,
  // Flux simultanés tolérés pour un même acteur (onglets ouverts)
  MAX_CONNEXIONS_PAR_ACTEUR: 3,
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
  RELEVE: "REL",
} as const;

// Paramètres du stockage des pièces jointes.
// Aucune de ces valeurs n'est écrite dans un fournisseur : changer de
// bucket ou de durée de signature se fait ici.
export const STOCKAGE = {
  // Nom du bucket privé utilisé à défaut de SUPABASE_BUCKET
  BUCKET_PAR_DEFAUT: "pgmi-pieces",
  // Préfixe de toutes les URL de pièces produites par la plateforme.
  // Changer cette valeur invaliderait les URL déjà enregistrées en base :
  // une migration de données serait nécessaire.
  PREFIXE_URL: "/uploads/",
  // Préfixe des pièces consultables par tout utilisateur authentifié
  // (photos de profil). Tout le reste est strictement cloisonné.
  PREFIXE_PUBLIC: "public/",
  // Profondeur maximale d'un dossier de stockage (marins/<id>/documents)
  PROFONDEUR_MAX_DOSSIER: 4,
  // Durée de validité d'une URL de lecture signée, en secondes.
  // Assez pour ouvrir un PDF, trop court pour être partagé utilement.
  URL_SIGNEE_SECONDES: 120,
  // En-tête de cache posé sur l'objet au dépôt, en secondes
  CACHE_OBJET_SECONDES: 3600,
  // Suppressions différées : tentatives avant abandon, et report entre deux
  // tentatives. Le report croît avec le nombre d'échecs pour ne pas
  // marteler un stockage déjà en difficulté.
  SUPPRESSION_TENTATIVES_MAX: 8,
  SUPPRESSION_REPORT_BASE_MS: 5 * 60 * 1000,
  SUPPRESSION_REPORT_MAX_MS: 6 * 60 * 60 * 1000,
  // Fichiers traités par passage du travail de nettoyage
  SUPPRESSION_LOT: 50,
  // Longueur maximale d'un corps d'erreur recopié dans le journal.
  // Un message du fournisseur peut être volumineux et n'apporte rien
  // au-delà de ses premières lignes.
  DETAIL_ERREUR_MAX: 500,
} as const;

// Pagination par défaut des listes
export const PAGINATION = {
  TAILLE_DEFAUT: 20,
  TAILLE_MAX: 100,
} as const;