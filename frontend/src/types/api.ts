// ============================================
// types/api.ts
// Contrats de données échangés avec l'API.
//
// Le backend reste la source de vérité (Zod et Prisma). Ce fichier en est
// le reflet côté client, volontairement limité aux champs consommés par les
// écrans : un champ ajouté au serveur n'oblige pas à toucher au frontend.
// ============================================

// Erreur de validation rattachée à un champ précis du formulaire. Le
// serveur en renvoie une par problème détecté, via middleware/validate.ts.
export interface DetailValidation {
  champ: string;   // Chemin du champ fautif (ex: imoNumber, fichier.nom)
  message: string; // Format attendu, rédigé pour l'utilisateur
}

// Enveloppe standard de toute réponse API
export interface ReponseApi<T> {
  success: boolean;
  message?: string;
  data: T;
  rule?: string; // Code de règle métier en cas d'erreur (ex: R9)
  details?: DetailValidation[]; // Erreurs par champ, en cas de refus 400
}

// Réponse paginée pour les listes (marins, demandes, etc.)
export interface Pagine<T> {
  items: T[];
  page: number;
  taille: number;
  total: number;
  pages: number;
}

// Fonction maritime d'un marin (ex: Capitaine, Second, Mécanicien)
export interface Fonction {
  id: string;
  code: string;
  label: string;
  category: string;
}

// Prérequis à satisfaire pour obtenir un certificat
export interface Prerequis {
  id: string;
  label: string;
  requiredSeaDays: number | null;   // Jours de mer minimum requis
  requiredType: { id: string; code: string; label: string } | null; // Certificat préalable requis
}

// Type de certificat maritime (STCW, médical, livret, etc.)
export interface TypeCertificat {
  id: string;
  code: string;
  label: string;
  category: string;
  validityMonths: number | null;    // Durée de validité en mois
  requiresTraining: boolean;        // Nécessite une formation ARSTM
  trainingDays: number | null;      // Durée de la formation en jours
  requirementsFor?: Prerequis[];    // Prérequis pour ce certificat
}

// Barème des frais. Une ligne tarife soit un type de certificat, soit une
// prestation de la plateforme désignée par son code de service.
export interface Bareme {
  id: string;
  certificateTypeId: string | null;
  serviceCode: string | null; // EMBARKATION_VALIDATION, NAVIGATION_RECORD
  requestType: string;   // FIRST_ISSUANCE, RENEWAL, DUPLICATE, UPGRADE, SERVICE
  amount: number;
  currency: string;      // XOF (Franc CFA)
}

// Référentiels métier : fonctions, certificats, barèmes
export interface Referentiels {
  fonctions: Fonction[];
  certificats: TypeCertificat[];
  baremes: Bareme[];
}

// Dossier complet d'un marin (espace marin et détail agent)
export interface Marin {
  id: string;
  matricule: string | null;         // Attribué par la DGAM à l'activation (R3)
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  idNumber: string;                 // Numéro CNI ou passeport
  photoUrl: string | null;
  region: string | null;
  shipCategory: string | null;      // Catégorie de navire
  status: string;                   // PENDING, ACTIVE, SUSPENDED
  isActive: boolean;
  registrationSource: string;       // SELF_ONLINE, ARSTM_ENROLLMENT
  isCadet: boolean;                 // Élève navigant inscrit par l'ARSTM
  fonction: { id: string; code: string; label: string } | null;
  preferences: { sms: boolean; whatsapp: boolean; email: boolean };
  createdAt: string;
}

// Carte professionnelle vérifiable du marin (GET /api/marins/me/qr).
// L'adresse encodée dans le QR est produite par le serveur : l'écran ne la
// reconstruit jamais à partir de son propre domaine.
export interface CarteVerifiable {
  code: string;      // Matricule, lisible sous la vignette
  url: string;       // Page publique de vérification
  image: string;     // Vignette produite par le serveur, repli du rendu client
  actif: boolean;    // Faux tant que la DGAM n'a pas activé le dossier
}

// Identité minimale d'un marin, telle que les listes de documents et
// d'embarquements la renvoient. Ces deux services ne calculent pas de nom
// complet : l'écran l'assemble avec nomComplet().
export interface MarinIdentite {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string | null;
}

// Résumé d'un marin pour les listes agent (sans données sensibles complètes)
export interface MarinResume {
  id: string;
  matricule: string | null;
  fullName: string;
  status: string;
  registrationSource: string;
  isCadet: boolean;
  fonction: string | null;
  region: string | null;
  createdAt: string;
}

// Agent DGAM ou ARSTM connecté
export interface Agent {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;       // DGAM_AGENT, DGAM_SUPERVISOR, PLATFORM_ADMIN, etc.
  roleLabel: string;  // Libellé lisible du rôle
  // Habilitations résolues par le serveur, au format objet:action.
  // Le client ne recopie pas la matrice : il teste l'appartenance à cette liste.
  permissions: string[];
  authority: { id: string; code: string; name: string; level: string };
}

// Document maritime d'un marin (certificat STCW, médical, livret)
export interface DocumentMaritime {
  id: string;
  number: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuedPlace: string | null;
  status: string;                   // SCANNED, VERIFIED, EXPIRED, etc.
  statutEffectif?: string;          // Statut calculé (peut différer du statut brut)
  joursRestants?: number | null;    // Jours avant expiration
  verificationCode: string | null;  // Code QR de vérification publique
  // Chaînage de version : un document remplacé pointe vers son remplaçant.
  // Renseigné par le serveur lors d'un renouvellement approuvé.
  replacedById?: string | null;
  fileUrl: string | null;
  certificateType: TypeCertificat;
  marin?: MarinIdentite;
}

// Pièce justificative attendue pour un embarquement. Le référentiel vient
// du serveur (GET /api/sea-service/pieces-attendues) : l'écran n'écrit ni
// les libellés ni le caractère obligatoire des pièces.
export interface PieceAttendue {
  code: string;
  libelle: string;
  precision: string;
  obligatoire: boolean;
  // Plusieurs fichiers admis pour cette pièce (livret de plusieurs pages)
  multiple: boolean;
}

// Pièce effectivement déposée par le marin
export interface PieceDeposee {
  id: string;
  kind: string;               // Code du référentiel PieceAttendue
  fileUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

// Période d'embarquement déclarée par un marin
export interface Embarquement {
  id: string;
  vesselName: string;
  imoNumber: string | null;
  flag: string | null;        // Pavillon du navire
  vesselType: string | null;
  startDate: string;
  endDate: string;
  days: number;               // Durée calculée en jours
  // DECLARED, AWAITING_PAYMENT, SUBMITTED, INFO_REQUESTED, VERIFIED, REJECTED
  status: string;
  // Première pièce historique, antérieure à la gestion multi-pièces.
  // Conservée en lecture : les embarquements déjà déposés restent valides.
  proofUrl: string | null;
  proofs?: PieceDeposee[];
  rejectReason: string | null;
  // Pièces complémentaires demandées par l'agent. Distinct d'un rejet : le
  // dossier revient au marin sans être refusé, et sans nouveaux frais.
  additionalInfo: string | null;
  fonction: Fonction | null;
  marin?: MarinIdentite;
}

// Dossier service en mer : liste des embarquements + totaux
export interface DossierServiceMer {
  embarquements: Embarquement[];
  totaux: { joursVerifies: number; joursEnAttente: number; embarquements: number };
}

// Ligne figée d'un relevé de navigation. Les valeurs sont recopiées à
// l'édition : un relevé délivré ne change plus (R24).
export interface LigneReleve {
  id: string;
  vesselName: string;
  imoNumber: string | null;
  fonctionLabel: string | null;
  startDate: string;
  endDate: string;
  days: number;
}

// Relevé de navigation édité par le marin
export interface Releve {
  id: string;
  reference: string;
  status: string;          // AWAITING_PAYMENT, ISSUED
  issuedAt: string | null; // Date de délivrance, nulle tant que non réglé
  totalDays: number;
  verificationCode: string | null;
  entries: LigneReleve[];
}

// Mouvement vérifié qu'une nouvelle édition retiendrait
export interface MouvementRetenu {
  id: string;
  vesselName: string;
  startDate: string;
  endDate: string;
  days: number;
  fonction: string | null;
}

// Écran du relevé : éditions passées, contenu d'une nouvelle édition, tarif
export interface DossierReleves {
  releves: Releve[];
  disponibles: MouvementRetenu[];
  totalJours: number;
  tarif: { montant: number; devise: string };
}

// Message du centre de notifications. Un envoi parti sur plusieurs canaux
// est regroupé par le serveur : le marin voit un message, pas trois lignes.
export interface MessageNotification {
  id: string;
  evenement: string;
  contenu: string;
  canaux: string[];   // SMS, WHATSAPP, EMAIL
  lu: boolean;
  creeLe: string;
}

// Page de notifications, avec le compteur de non-lus pour la pastille
export interface PageNotifications extends Pagine<MessageNotification> {
  nonLus: number;
}

// Paiement des frais de dossier (Mobile Money ou guichet)
export interface Paiement {
  id: string;
  provider: string;   // ORANGE_MONEY, MTN_MOMO, WAVE, MOOV_MONEY
  channel: string;    // MOBILE_MONEY ou CASH
  amount: number;
  currency: string;
  status: string;     // PENDING, COMPLETED, FAILED
  paidAt: string | null;
}

// Demande de certificat (renouvellement, première délivrance, duplicata)
export interface Demande {
  id: string;
  reference: string;            // Référence lisible (ex: REN-2026-1234)
  type: string;                 // FIRST_ISSUANCE, RENEWAL, DUPLICATE, UPGRADE
  status: string;               // SUBMITTED, IN_REVIEW, APPROVED, REJECTED, etc.
  reason: string | null;        // Motif de la demande
  feeAmount: number;
  currency: string;
  submittedByRole: string;      // Qui a soumis : MARIN ou ARSTM
  decisionReason: string | null;
  additionalInfo: string | null; // Message de l'agent pour pièces complémentaires
  createdAt: string;
  certificateType: TypeCertificat;
  marin?: MarinResume;
  attachments: { id: string; fileName: string; fileUrl: string }[];
  payments: Paiement[];
  assignedTo: { id: string; firstName: string; lastName: string } | null;
}

// Alerte d'expiration affichée sur le tableau de bord marin (R16)
export interface AlerteExpiration {
  documentId: string;
  certificat: string;
  code: string;
  expiryDate: string;
  joursRestants: number;
  requiresTraining: boolean;  // Si vrai : une formation ARSTM est nécessaire
}

// Synthèse du tableau de bord marin
export interface SyntheseMarin {
  marin: Marin;
  statistiques: {
    documents: number;
    joursVerifies: number;
    joursEnAttente: number;
    demandesEnCours: number;
  };
  alertes: AlerteExpiration[];
}

// Ligne de prérequis dans le rapport de conformité d'un marin
export interface LignePrerequis {
  label: string;
  type: "CERTIFICAT" | "SEA_SERVICE";
  etat: string;                     // VALIDE, EXPIRE, MANQUANT, EN_ATTENTE
  code?: string;
  documentId?: string;
  expireLe?: string | null;
  joursRestants?: number | null;
  joursRequis?: number;             // Jours de mer requis
  joursAcquis?: number;             // Jours de mer acquis
  formationRequise?: boolean;
  certificateTypeId?: string;
}

// Rapport de conformité d'un marin pour un brevet donné
export interface RapportConformite {
  certificat: { id: string; code: string; label: string };
  progression: number;    // Pourcentage de prérequis satisfaits
  satisfaits: number;
  total: number;
  eligible: boolean;      // Vrai si tous les prérequis sont satisfaits
  prerequis: LignePrerequis[];
  avertissement: string;
}

// Session de formation organisée par l'ARSTM
export interface SessionFormation {
  id: string;
  code: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  trainer: string | null;
  capacity: number;
  minQuorum: number;      // Nombre minimum d'inscrits pour démarrer (R15)
  status: string;         // WAITING_FOR_QUORUM, SCHEDULED, IN_PROGRESS, COMPLETED
  certificateType: { id: string; code: string; label: string; trainingDays?: number | null };
  authority?: { id: string; code: string; name: string };
  quorum?: { confirmes: number; requis: number; atteint: boolean; manquants: number };
  enrollments?: InscriptionFormation[];
  _count?: { enrollments: number };
}

// Inscription d'un marin à une session de formation
export interface InscriptionFormation {
  id: string;
  status: string;         // PROPOSED, PENDING, CONFIRMED, COMPLETED, DECLINED
  source: string;
  result: string | null;  // Résultat : PASSED, FAILED
  attended: boolean;
  createdAt: string;
  certificateType: { id: string; code: string; label: string };
  session: SessionFormation | null;
  marin?: MarinResume;
}

// Ligne de file d'attente ARSTM par module de formation
export interface LigneFileAttente {
  certificateTypeId: string;
  code: string;
  label: string;
  enAttente: number;
  proposesNonRepondus: number;
  marins: { id: string; nom: string; matricule: string | null }[];
}

// Synthèse du tableau de bord ARSTM
export interface SyntheseArstm {
  sessionsAttente: number;
  sessionsProgrammees: number;
  inscriptionsEnAttente: number;
  elevesEnAttenteValidation: number;
  fileAttente: LigneFileAttente[];
}

// Synthèse du tableau de bord agent DGAM
export interface SyntheseAgent {
  statistiques: {
    marinsActifs: number;
    marinsEnAttente: number;
    demandesAInstruire: number;
    mesDossiers: number;
    documentsAVerifier: number;
    embarquementsAVerifier: number;
    certificatsExpires: number;
    certificatsBientotExpires: number;
    verificationsDuJour: number;
    elevesArstmEnAttente: number;
  };
  activite: {
    id: string;
    action: string;
    actorLabel: string | null;
    targetType: string | null;
    createdAt: string;
  }[];
}

// Entrée du journal d'audit immuable (R5, R14)
export interface EntreeJournal {
  id: string;
  actorType: string;          // MARIN ou AGENT
  actorLabel: string | null;
  action: string;             // Code d'action (ex: MARIN_ACTIVATED)
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

// Résultat de la vérification publique d'un document par QR code
export interface ResultatVerification {
  trouve: boolean;
  statut: string;
  libelleStatut: string;
  valide: boolean;
  message: string;
  remplacePar?: string;   // Référence du document de remplacement si révoqué
  document?: {
    certificat: string;
    code: string;
    numero: string | null;
    delivreLe: string | null;
    expireLe: string | null;
    titulaire: string;
    matricule: string | null;
    fonction: string | null;
    photoUrl: string | null;  // Photo pour comparaison visuelle par l'inspecteur
    autorite: string;
  };
}