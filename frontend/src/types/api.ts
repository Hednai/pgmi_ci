// ============================================
// types/api.ts
// Contrats de données échangés avec l'API.
//
// Le backend reste la source de vérité (Zod et Prisma). Ce fichier en est
// le reflet côté client, volontairement limité aux champs consommés par les
// écrans : un champ ajouté au serveur n'oblige pas à toucher au frontend.
// ============================================

export interface ReponseApi<T> {
  success: boolean;
  message?: string;
  data: T;
  rule?: string;
}

export interface Pagine<T> {
  items: T[];
  page: number;
  taille: number;
  total: number;
  pages: number;
}

export interface Fonction {
  id: string;
  code: string;
  label: string;
  category: string;
}

export interface Prerequis {
  id: string;
  label: string;
  requiredSeaDays: number | null;
  requiredType: { id: string; code: string; label: string } | null;
}

export interface TypeCertificat {
  id: string;
  code: string;
  label: string;
  category: string;
  validityMonths: number | null;
  requiresTraining: boolean;
  trainingDays: number | null;
  requirementsFor?: Prerequis[];
}

export interface Bareme {
  id: string;
  certificateTypeId: string;
  requestType: string;
  amount: number;
  currency: string;
}

export interface Referentiels {
  fonctions: Fonction[];
  certificats: TypeCertificat[];
  baremes: Bareme[];
}

export interface Marin {
  id: string;
  matricule: string | null;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  birthDate: string;
  birthPlace: string;
  nationality: string;
  idNumber: string;
  photoUrl: string | null;
  region: string | null;
  shipCategory: string | null;
  status: string;
  isActive: boolean;
  registrationSource: string;
  isCadet: boolean;
  fonction: { id: string; code: string; label: string } | null;
  preferences: { sms: boolean; whatsapp: boolean; email: boolean };
  createdAt: string;
}

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

export interface Agent {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roleLabel: string;
  authority: { id: string; code: string; name: string; level: string };
}

export interface DocumentMaritime {
  id: string;
  number: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  issuedPlace: string | null;
  status: string;
  statutEffectif?: string;
  joursRestants?: number | null;
  verificationCode: string | null;
  fileUrl: string | null;
  certificateType: TypeCertificat;
  marin?: MarinResume;
}

export interface Embarquement {
  id: string;
  vesselName: string;
  imoNumber: string | null;
  flag: string | null;
  vesselType: string | null;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  proofUrl: string | null;
  rejectReason: string | null;
  fonction: Fonction | null;
  marin?: MarinResume;
}

export interface DossierServiceMer {
  embarquements: Embarquement[];
  totaux: { joursVerifies: number; joursEnAttente: number; embarquements: number };
}

export interface Paiement {
  id: string;
  provider: string;
  channel: string;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
}

export interface Demande {
  id: string;
  reference: string;
  type: string;
  status: string;
  reason: string | null;
  feeAmount: number;
  currency: string;
  submittedByRole: string;
  decisionReason: string | null;
  additionalInfo: string | null;
  createdAt: string;
  certificateType: TypeCertificat;
  marin?: MarinResume;
  attachments: { id: string; fileName: string; fileUrl: string }[];
  payments: Paiement[];
  assignedTo: { id: string; firstName: string; lastName: string } | null;
}

export interface AlerteExpiration {
  documentId: string;
  certificat: string;
  code: string;
  expiryDate: string;
  joursRestants: number;
  requiresTraining: boolean;
}

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

export interface LignePrerequis {
  label: string;
  type: "CERTIFICAT" | "SEA_SERVICE";
  etat: string;
  code?: string;
  documentId?: string;
  expireLe?: string | null;
  joursRestants?: number | null;
  joursRequis?: number;
  joursAcquis?: number;
  formationRequise?: boolean;
  certificateTypeId?: string;
}

export interface RapportConformite {
  certificat: { id: string; code: string; label: string };
  progression: number;
  satisfaits: number;
  total: number;
  eligible: boolean;
  prerequis: LignePrerequis[];
  avertissement: string;
}

export interface SessionFormation {
  id: string;
  code: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  trainer: string | null;
  capacity: number;
  minQuorum: number;
  status: string;
  certificateType: { id: string; code: string; label: string; trainingDays?: number | null };
  authority?: { id: string; code: string; name: string };
  quorum?: { confirmes: number; requis: number; atteint: boolean; manquants: number };
  enrollments?: InscriptionFormation[];
  _count?: { enrollments: number };
}

export interface InscriptionFormation {
  id: string;
  status: string;
  source: string;
  result: string | null;
  attended: boolean;
  createdAt: string;
  certificateType: { id: string; code: string; label: string };
  session: SessionFormation | null;
  marin?: MarinResume;
}

export interface LigneFileAttente {
  certificateTypeId: string;
  code: string;
  label: string;
  enAttente: number;
  proposesNonRepondus: number;
  marins: { id: string; nom: string; matricule: string | null }[];
}

export interface SyntheseArstm {
  sessionsAttente: number;
  sessionsProgrammees: number;
  inscriptionsEnAttente: number;
  elevesEnAttenteValidation: number;
  fileAttente: LigneFileAttente[];
}

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

export interface EntreeJournal {
  id: string;
  actorType: string;
  actorLabel: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

export interface ResultatVerification {
  trouve: boolean;
  statut: string;
  libelleStatut: string;
  valide: boolean;
  message: string;
  remplacePar?: string;
  document?: {
    certificat: string;
    code: string;
    numero: string | null;
    delivreLe: string | null;
    expireLe: string | null;
    titulaire: string;
    matricule: string | null;
    fonction: string | null;
    photoUrl: string | null;
    autorite: string;
  };
}
