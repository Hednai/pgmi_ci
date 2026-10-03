// ============================================
// mocks/donneesDemo.ts
// Jeu de données de démonstration de la plateforme.
//
// Ces données alimentent le mode démonstration, utilisé pour présenter le
// produit sans backend déployé. Elles respectent strictement les contrats
// déclarés dans types/api.ts : le jour où l'API répond, aucun écran ne change.
//
// Personnages de référence de la spécification de design :
//   - marin : Kouassi Yao Jean, matricule CI-MAR-2024-0847, Abidjan
//   - agent : Koné Mariam, superviseur, antenne d'Abidjan
// ============================================
import type {
  Agent,
  AlerteExpiration,
  Bareme,
  Demande,
  DocumentMaritime,
  DossierServiceMer,
  Embarquement,
  EntreeJournal,
  Fonction,
  Marin,
  MarinResume,
  RapportConformite,
  Referentiels,
  ResultatVerification,
  SyntheseAgent,
  SyntheseMarin,
  TypeCertificat,
} from "../types/api.js";

// Date de référence du jeu de démonstration. Toutes les échéances sont
// calculées à partir d'elle pour que la démonstration reste cohérente
// quelle que soit la date réelle de consultation.
const AUJOURDHUI = new Date();

// Construit une date ISO décalée d'un nombre de jours par rapport à aujourd'hui.
function dateDecalee(jours: number): string {
  const date = new Date(AUJOURDHUI);
  date.setDate(date.getDate() + jours);
  return date.toISOString();
}

// ============================================
// Référentiels
// ============================================

export const FONCTIONS: Fonction[] = [
  { id: "fon-oow", code: "OOW", label: "Officier chef de quart", category: "PONT" },
  { id: "fon-master", code: "MASTER", label: "Capitaine", category: "PONT" },
  { id: "fon-chief", code: "C/E", label: "Chef mécanicien", category: "MACHINE" },
  { id: "fon-rating", code: "RATING", label: "Matelot", category: "PONT" },
];

export const TYPES_CERTIFICAT: TypeCertificat[] = [
  {
    id: "cert-bst",
    code: "BST",
    label: "Formation de base à la sécurité",
    category: "STCW",
    validityMonths: 60,
    requiresTraining: true,
    trainingDays: 5,
  },
  {
    id: "cert-pssr",
    code: "PSSR",
    label: "Sécurité personnelle et responsabilités sociales",
    category: "STCW",
    validityMonths: 60,
    requiresTraining: true,
    trainingDays: 2,
  },
  {
    id: "cert-pst",
    code: "PST",
    label: "Techniques individuelles de survie",
    category: "STCW",
    validityMonths: 60,
    requiresTraining: true,
    trainingDays: 3,
  },
  {
    id: "cert-fpff",
    code: "FPFF",
    label: "Prévention et lutte contre l'incendie",
    category: "STCW",
    validityMonths: 60,
    requiresTraining: true,
    trainingDays: 4,
  },
  {
    id: "cert-gmdss",
    code: "GMDSS",
    label: "Certificat opérateur SMDSM",
    category: "STCW",
    validityMonths: 60,
    requiresTraining: true,
    trainingDays: 15,
  },
  {
    id: "cert-medical",
    code: "MED",
    label: "Certificat médical maritime",
    category: "MEDICAL",
    validityMonths: 24,
    requiresTraining: false,
    trainingDays: null,
  },
  {
    id: "cert-livret",
    code: "LIVRET",
    label: "Livret maritime national",
    category: "NATIONAL",
    validityMonths: 120,
    requiresTraining: false,
    trainingDays: null,
  },
  {
    id: "cert-oow",
    code: "OOW",
    label: "Brevet d'officier chef de quart",
    category: "STCW",
    validityMonths: 60,
    requiresTraining: true,
    trainingDays: 30,
  },
];

export const BAREMES: Bareme[] = [
  { id: "bar-1", certificateTypeId: "cert-bst", requestType: "RENEWAL", amount: 15000, currency: "XOF" },
  { id: "bar-2", certificateTypeId: "cert-medical", requestType: "RENEWAL", amount: 10000, currency: "XOF" },
  { id: "bar-3", certificateTypeId: "cert-livret", requestType: "FIRST_ISSUANCE", amount: 25000, currency: "XOF" },
  { id: "bar-4", certificateTypeId: "cert-gmdss", requestType: "FIRST_ISSUANCE", amount: 35000, currency: "XOF" },
];

export const REFERENTIELS: Referentiels = {
  fonctions: FONCTIONS,
  certificats: TYPES_CERTIFICAT,
  baremes: BAREMES,
};

// ============================================
// Comptes de démonstration
// ============================================

export const MARIN_DEMO: Marin = {
  id: "marin-0847",
  matricule: "CI-MAR-2024-0847",
  phone: "+2250708091011",
  email: "kouassi.yj@example.ci",
  firstName: "Yao Jean",
  lastName: "Kouassi",
  fullName: "Kouassi Yao Jean",
  birthDate: "1988-03-12T00:00:00.000Z",
  birthPlace: "Abidjan",
  nationality: "Ivoirienne",
  idNumber: "CI0042118745",
  photoUrl: null,
  region: "Abidjan",
  shipCategory: "Navire de commerce",
  status: "ACTIVE",
  isActive: true,
  registrationSource: "EN_LIGNE",
  isCadet: false,
  fonction: { id: "fon-oow", code: "OOW", label: "Officier chef de quart" },
  preferences: { sms: true, whatsapp: true, email: false },
  createdAt: "2024-02-18T09:20:00.000Z",
};

export const AGENT_DEMO: Agent = {
  id: "agent-koné",
  email: "m.kone@dgam.ci",
  firstName: "Mariam",
  lastName: "Koné",
  role: "DGAM_SUPERVISOR",
  roleLabel: "Superviseur",
  authority: {
    id: "aut-dgam-abj",
    code: "DGAM-CI-ABJ",
    name: "DGAM, antenne d'Abidjan",
    level: "REGIONAL_OFFICE",
  },
};

// Comptes utilisables pendant la démonstration. Le mot de passe est volontairement
// simple : le mode démonstration ne touche jamais à des données réelles.
export const COMPTES_AGENT_DEMO = [
  { email: "m.kone@dgam.ci", motDePasse: "demo1234", agent: AGENT_DEMO },
  {
    email: "a.traore@dgam.ci",
    motDePasse: "demo1234",
    agent: {
      ...AGENT_DEMO,
      id: "agent-traore",
      email: "a.traore@dgam.ci",
      firstName: "Adama",
      lastName: "Traoré",
      role: "DGAM_AGENT",
      roleLabel: "Agent instructeur",
    } satisfies Agent,
  },
];

// Le code OTP de démonstration est fixe : aucun SMS n'est envoyé.
export const CODE_OTP_DEMO = "123456";

// ============================================
// Documents du marin
// ============================================

export const DOCUMENTS_MARIN: DocumentMaritime[] = [
  {
    id: "doc-bst",
    number: "CI-BST-2021-4412",
    issueDate: dateDecalee(-1580),
    expiryDate: dateDecalee(240),
    issuedPlace: "ARSTM Abidjan",
    status: "VERIFIED",
    statutEffectif: "VERIFIED",
    joursRestants: 240,
    verificationCode: "8F72K9X4P",
    fileUrl: null,
    certificateType: TYPES_CERTIFICAT[0],
  },
  {
    id: "doc-pssr",
    number: "CI-PSSR-2021-4413",
    issueDate: dateDecalee(-1580),
    expiryDate: dateDecalee(240),
    issuedPlace: "ARSTM Abidjan",
    status: "VERIFIED",
    statutEffectif: "VERIFIED",
    joursRestants: 240,
    verificationCode: "5J31M7Q2B",
    fileUrl: null,
    certificateType: TYPES_CERTIFICAT[1],
  },
  {
    id: "doc-pst",
    number: "CI-PST-2021-4414",
    issueDate: dateDecalee(-1580),
    expiryDate: dateDecalee(240),
    issuedPlace: "ARSTM Abidjan",
    status: "VERIFIED",
    statutEffectif: "VERIFIED",
    joursRestants: 240,
    verificationCode: "2R84C6V9N",
    fileUrl: null,
    certificateType: TYPES_CERTIFICAT[2],
  },
  {
    id: "doc-fpff",
    number: "CI-FPFF-2021-4415",
    issueDate: dateDecalee(-1580),
    expiryDate: dateDecalee(240),
    issuedPlace: "ARSTM Abidjan",
    status: "VERIFIED",
    statutEffectif: "VERIFIED",
    joursRestants: 240,
    verificationCode: "9T15D3W8L",
    fileUrl: null,
    certificateType: TYPES_CERTIFICAT[3],
  },
  {
    id: "doc-medical",
    number: "CI-MED-2024-9921",
    issueDate: dateDecalee(-685),
    expiryDate: dateDecalee(45),
    issuedPlace: "Centre médical maritime, Abidjan",
    status: "VERIFIED",
    statutEffectif: "EXPIRING_SOON",
    joursRestants: 45,
    verificationCode: "4K67B2Z5H",
    fileUrl: null,
    certificateType: TYPES_CERTIFICAT[5],
  },
  {
    id: "doc-livret",
    number: "CI-LIV-2024-0847",
    issueDate: dateDecalee(-580),
    expiryDate: dateDecalee(3070),
    issuedPlace: "DGAM Abidjan",
    status: "OFFICIAL_DIGITAL",
    statutEffectif: "OFFICIAL_DIGITAL",
    joursRestants: 3070,
    verificationCode: "7P93F1Y6C",
    fileUrl: null,
    certificateType: TYPES_CERTIFICAT[6],
  },
];

// ============================================
// Registre de service en mer
// ============================================

export const EMBARQUEMENTS_MARIN: Embarquement[] = [
  {
    id: "emb-golfe",
    vesselName: "MT Golfe",
    imoNumber: "5678901",
    flag: "Côte d'Ivoire",
    vesselType: "Pétrolier",
    startDate: dateDecalee(-620),
    endDate: dateDecalee(-438),
    days: 182,
    status: "SUBMITTED",
    proofUrl: null,
    rejectReason: null,
    fonction: FONCTIONS[0],
  },
  {
    id: "emb-atlantic",
    vesselName: "MV Atlantic",
    imoNumber: "1234567",
    flag: "Panama",
    vesselType: "Porte-conteneurs",
    startDate: dateDecalee(-1160),
    endDate: dateDecalee(-1007),
    days: 153,
    status: "VERIFIED",
    proofUrl: null,
    rejectReason: null,
    fonction: FONCTIONS[0],
  },
  {
    id: "emb-emeraude",
    vesselName: "MV Émeraude",
    imoNumber: "9876543",
    flag: "Côte d'Ivoire",
    vesselType: "Cargo",
    startDate: dateDecalee(-1330),
    endDate: dateDecalee(-1195),
    days: 135,
    status: "VERIFIED",
    proofUrl: null,
    rejectReason: null,
    fonction: FONCTIONS[3],
  },
];

export const SERVICE_MER_MARIN: DossierServiceMer = {
  embarquements: EMBARQUEMENTS_MARIN,
  totaux: { joursVerifies: 288, joursEnAttente: 182, embarquements: 3 },
};

// ============================================
// Demandes du marin
// ============================================

export const DEMANDES_MARIN: Demande[] = [
  {
    id: "dem-0812",
    reference: "REN-2026-0812",
    type: "RENEWAL",
    status: "IN_REVIEW",
    reason: "Renouvellement avant expiration du certificat de base.",
    feeAmount: 15000,
    currency: "XOF",
    submittedByRole: "MARIN",
    decisionReason: null,
    additionalInfo: null,
    createdAt: dateDecalee(-9),
    certificateType: TYPES_CERTIFICAT[0],
    attachments: [
      { id: "att-1", fileName: "BST_certificat_2021.pdf", fileUrl: "#" },
      { id: "att-2", fileName: "CNI_recto_verso.jpg", fileUrl: "#" },
    ],
    payments: [
      {
        id: "pay-1",
        provider: "ORANGE_MONEY",
        channel: "MOBILE_MONEY",
        amount: 15000,
        currency: "XOF",
        status: "COMPLETED",
        paidAt: dateDecalee(-8),
      },
    ],
    assignedTo: { id: "agent-traore", firstName: "Adama", lastName: "Traoré" },
  },
  {
    id: "dem-0798",
    reference: "REN-2026-0798",
    type: "RENEWAL",
    status: "AWAITING_PAYMENT",
    reason: "Renouvellement du certificat médical maritime.",
    feeAmount: 10000,
    currency: "XOF",
    submittedByRole: "MARIN",
    decisionReason: null,
    additionalInfo: null,
    createdAt: dateDecalee(-3),
    certificateType: TYPES_CERTIFICAT[5],
    attachments: [],
    payments: [],
    assignedTo: null,
  },
];

// ============================================
// Synthèse de l'espace marin
// ============================================

export const ALERTES_MARIN: AlerteExpiration[] = [
  {
    documentId: "doc-medical",
    certificat: "Certificat médical maritime",
    code: "MED",
    expiryDate: dateDecalee(45),
    joursRestants: 45,
    requiresTraining: false,
  },
];

export const SYNTHESE_MARIN: SyntheseMarin = {
  marin: MARIN_DEMO,
  statistiques: {
    documents: DOCUMENTS_MARIN.length,
    joursVerifies: 288,
    joursEnAttente: 182,
    demandesEnCours: DEMANDES_MARIN.length,
  },
  alertes: ALERTES_MARIN,
};

// ============================================
// Moteur de conformité
// ============================================

export const CONFORMITE_OOW: RapportConformite = {
  certificat: { id: "cert-oow", code: "OOW", label: "Brevet d'officier chef de quart" },
  progression: 62,
  satisfaits: 5,
  total: 8,
  eligible: false,
  prerequis: [
    {
      label: "Formation de base à la sécurité",
      type: "CERTIFICAT",
      etat: "VALIDE",
      code: "BST",
      documentId: "doc-bst",
      expireLe: dateDecalee(240),
      joursRestants: 240,
    },
    {
      label: "Sécurité personnelle et responsabilités sociales",
      type: "CERTIFICAT",
      etat: "VALIDE",
      code: "PSSR",
      documentId: "doc-pssr",
      expireLe: dateDecalee(240),
      joursRestants: 240,
    },
    {
      label: "Techniques individuelles de survie",
      type: "CERTIFICAT",
      etat: "VALIDE",
      code: "PST",
      documentId: "doc-pst",
      expireLe: dateDecalee(240),
      joursRestants: 240,
    },
    {
      label: "Prévention et lutte contre l'incendie",
      type: "CERTIFICAT",
      etat: "VALIDE",
      code: "FPFF",
      documentId: "doc-fpff",
      expireLe: dateDecalee(240),
      joursRestants: 240,
    },
    {
      label: "Certificat médical maritime",
      type: "CERTIFICAT",
      etat: "BIENTOT_EXPIRE",
      code: "MED",
      documentId: "doc-medical",
      expireLe: dateDecalee(45),
      joursRestants: 45,
    },
    {
      label: "Certificat opérateur SMDSM",
      type: "CERTIFICAT",
      etat: "MANQUANT",
      code: "GMDSS",
      certificateTypeId: "cert-gmdss",
      formationRequise: true,
    },
    {
      label: "Formation agréée chef de quart",
      type: "CERTIFICAT",
      etat: "MANQUANT",
      code: "OOW",
      certificateTypeId: "cert-oow",
      formationRequise: true,
    },
    {
      label: "Service en mer vérifié",
      type: "SEA_SERVICE",
      etat: "INSUFFISANT",
      joursRequis: 360,
      joursAcquis: 288,
    },
  ],
  avertissement:
    "Selon les règles configurées par l'autorité, votre dossier n'est pas encore complet. L'agent de la DGAM reste seul décideur de l'admissibilité.",
};

// ============================================
// Espace agent : marins, files d'attente, journal
// ============================================

export const MARINS_AGENT: MarinResume[] = [
  {
    id: "marin-0847",
    matricule: "CI-MAR-2024-0847",
    fullName: "Kouassi Yao Jean",
    status: "ACTIVE",
    registrationSource: "EN_LIGNE",
    isCadet: false,
    fonction: "Officier chef de quart",
    region: "Abidjan",
    createdAt: dateDecalee(-580),
  },
  {
    id: "marin-0912",
    matricule: "CI-MAR-2024-0912",
    fullName: "Aké Konan Michel",
    status: "ACTIVE",
    registrationSource: "GUICHET",
    isCadet: false,
    fonction: "Capitaine",
    region: "Abidjan",
    createdAt: dateDecalee(-410),
  },
  {
    id: "marin-1033",
    matricule: "CI-MAR-2025-1033",
    fullName: "Traoré Salimata",
    status: "ACTIVE",
    registrationSource: "EN_LIGNE",
    isCadet: false,
    fonction: "Chef mécanicien",
    region: "San Pedro",
    createdAt: dateDecalee(-260),
  },
  {
    id: "marin-1147",
    matricule: null,
    fullName: "Bamba Issouf",
    status: "PENDING",
    registrationSource: "EN_LIGNE",
    isCadet: true,
    fonction: "Matelot",
    region: "Abidjan",
    createdAt: dateDecalee(-12),
  },
  {
    id: "marin-1150",
    matricule: null,
    fullName: "Sanogo Fatoumata",
    status: "PENDING",
    registrationSource: "GUICHET",
    isCadet: true,
    fonction: "Matelot",
    region: "San Pedro",
    createdAt: dateDecalee(-5),
  },
];

// Demandes vues côté agent : chaque ligne porte le marin concerné.
export const DEMANDES_AGENT: Demande[] = [
  {
    ...DEMANDES_MARIN[0],
    marin: MARINS_AGENT[0],
  },
  {
    id: "dem-0805",
    reference: "REN-2026-0805",
    type: "RENEWAL",
    status: "ASSIGNED",
    reason: "Renouvellement du livret maritime.",
    feeAmount: 25000,
    currency: "XOF",
    submittedByRole: "MARIN",
    decisionReason: null,
    additionalInfo: null,
    createdAt: dateDecalee(-6),
    certificateType: TYPES_CERTIFICAT[6],
    marin: MARINS_AGENT[1],
    attachments: [{ id: "att-3", fileName: "livret_pages_1_4.pdf", fileUrl: "#" }],
    payments: [],
    assignedTo: { id: "agent-koné", firstName: "Mariam", lastName: "Koné" },
  },
  {
    id: "dem-0801",
    reference: "PRE-2026-0801",
    type: "FIRST_ISSUANCE",
    status: "INFO_REQUESTED",
    reason: "Première délivrance du certificat SMDSM.",
    feeAmount: 35000,
    currency: "XOF",
    submittedByRole: "MARIN",
    decisionReason: null,
    additionalInfo: "Attestation de formation SMDSM illisible, merci de renvoyer une photo nette.",
    createdAt: dateDecalee(-11),
    certificateType: TYPES_CERTIFICAT[4],
    marin: MARINS_AGENT[2],
    attachments: [],
    payments: [],
    assignedTo: { id: "agent-traore", firstName: "Adama", lastName: "Traoré" },
  },
  {
    id: "dem-0793",
    reference: "PRE-2026-0793",
    type: "FIRST_ISSUANCE",
    status: "AWAITING_PAYMENT",
    reason: "Première inscription au registre des gens de mer.",
    feeAmount: 25000,
    currency: "XOF",
    submittedByRole: "AGENT",
    decisionReason: null,
    additionalInfo: null,
    createdAt: dateDecalee(-4),
    certificateType: TYPES_CERTIFICAT[6],
    marin: MARINS_AGENT[3],
    attachments: [],
    payments: [],
    assignedTo: null,
  },
  {
    id: "dem-0788",
    reference: "REN-2026-0788",
    type: "RENEWAL",
    status: "APPROVED",
    reason: "Renouvellement du certificat médical.",
    feeAmount: 10000,
    currency: "XOF",
    submittedByRole: "MARIN",
    decisionReason: "Dossier complet, pièces vérifiées au guichet.",
    additionalInfo: null,
    createdAt: dateDecalee(-18),
    certificateType: TYPES_CERTIFICAT[5],
    marin: MARINS_AGENT[4],
    attachments: [],
    payments: [
      {
        id: "pay-2",
        provider: "GUICHET",
        channel: "ESPECES",
        amount: 10000,
        currency: "XOF",
        status: "COMPLETED",
        paidAt: dateDecalee(-17),
      },
    ],
    assignedTo: { id: "agent-koné", firstName: "Mariam", lastName: "Koné" },
  },
];

// Documents en attente de vérification par un agent.
export const DOCUMENTS_A_VERIFIER: DocumentMaritime[] = [
  {
    id: "doc-verif-1",
    number: "CI-LIV-2024-0912",
    issueDate: dateDecalee(-400),
    expiryDate: dateDecalee(2600),
    issuedPlace: "DGAM Abidjan",
    status: "DIGITIZED",
    statutEffectif: "DIGITIZED",
    joursRestants: 2600,
    verificationCode: null,
    fileUrl: null,
    certificateType: TYPES_CERTIFICAT[6],
    marin: MARINS_AGENT[1],
  },
  {
    id: "doc-verif-2",
    number: "CI-MED-2026-1188",
    issueDate: dateDecalee(-30),
    expiryDate: dateDecalee(700),
    issuedPlace: "Centre médical maritime, San Pedro",
    status: "DIGITIZED_DAM",
    statutEffectif: "DIGITIZED_DAM",
    joursRestants: 700,
    verificationCode: null,
    fileUrl: null,
    certificateType: TYPES_CERTIFICAT[5],
    marin: MARINS_AGENT[2],
  },
];

// Embarquements déclarés en attente de vérification.
export const EMBARQUEMENTS_A_VERIFIER: Embarquement[] = [
  {
    ...EMBARQUEMENTS_MARIN[0],
    marin: MARINS_AGENT[0],
  },
  {
    id: "emb-verif-2",
    vesselName: "MV Bandama",
    imoNumber: "3344556",
    flag: "Côte d'Ivoire",
    vesselType: "Cargo",
    startDate: dateDecalee(-300),
    endDate: dateDecalee(-160),
    days: 140,
    status: "SUBMITTED",
    proofUrl: null,
    rejectReason: null,
    fonction: FONCTIONS[2],
    marin: MARINS_AGENT[2],
  },
];

export const SYNTHESE_AGENT: SyntheseAgent = {
  statistiques: {
    marinsActifs: 1247,
    marinsEnAttente: 23,
    demandesAInstruire: 12,
    mesDossiers: 4,
    documentsAVerifier: DOCUMENTS_A_VERIFIER.length,
    embarquementsAVerifier: EMBARQUEMENTS_A_VERIFIER.length,
    certificatsExpires: 38,
    certificatsBientotExpires: 67,
    verificationsDuJour: 342,
    elevesArstmEnAttente: 9,
  },
  activite: [
    {
      id: "act-1",
      action: "DOCUMENT_VERIFIED",
      actorLabel: "Koné Mariam",
      targetType: "Livret maritime, Aké Konan Michel",
      createdAt: dateDecalee(0),
    },
    {
      id: "act-2",
      action: "REQUEST_APPROVED",
      actorLabel: "Koné Mariam",
      targetType: "Demande REN-2026-0788",
      createdAt: dateDecalee(0),
    },
    {
      id: "act-3",
      action: "REQUEST_REJECTED",
      actorLabel: "Traoré Adama",
      targetType: "Demande PRE-2026-0801",
      createdAt: dateDecalee(-1),
    },
    {
      id: "act-4",
      action: "NOTIFICATION_SENT",
      actorLabel: "Automate",
      targetType: "67 alertes d'expiration envoyées par SMS",
      createdAt: dateDecalee(-1),
    },
  ],
};

export const JOURNAL_AUDIT: EntreeJournal[] = [
  {
    id: "log-1",
    actorType: "AGENT",
    actorLabel: "Koné Mariam",
    action: "DOCUMENT_VERIFIED",
    targetType: "Document",
    targetId: "doc-verif-1",
    createdAt: dateDecalee(0),
    metadata: { methode: "ORIGINAL_PRESENTED", resultat: "VERIFIED" },
  },
  {
    id: "log-2",
    actorType: "AGENT",
    actorLabel: "Koné Mariam",
    action: "REQUEST_APPROVED",
    targetType: "RenewalRequest",
    targetId: "dem-0788",
    createdAt: dateDecalee(0),
    metadata: { motif: "Dossier complet, pièces vérifiées au guichet." },
  },
  {
    id: "log-3",
    actorType: "AGENT",
    actorLabel: "Traoré Adama",
    action: "INFO_REQUESTED",
    targetType: "RenewalRequest",
    targetId: "dem-0801",
    createdAt: dateDecalee(-1),
    metadata: { motif: "Attestation SMDSM illisible." },
  },
  {
    id: "log-4",
    actorType: "SYSTEM",
    actorLabel: "Automate",
    action: "NOTIFICATION_SENT",
    targetType: "Notification",
    targetId: "cron-expiration",
    createdAt: dateDecalee(-1),
    metadata: { canal: "SMS", volume: 67 },
  },
];

// ============================================
// Vérification publique par code QR
// ============================================

// Réponses préparées pour les trois états de la page publique de vérification.
export const VERIFICATIONS_PUBLIQUES: Record<string, ResultatVerification> = {
  "8F72K9X4P": {
    trouve: true,
    statut: "VALIDE",
    libelleStatut: "Document authentique",
    valide: true,
    message: "Ce document a été délivré et vérifié par la Direction Générale des Affaires Maritimes.",
    document: {
      certificat: "Formation de base à la sécurité",
      code: "BST",
      numero: "CI-BST-2021-4412",
      delivreLe: dateDecalee(-1580),
      expireLe: dateDecalee(240),
      titulaire: "KOUASSI Y*** J***",
      matricule: "CI-MAR-2024-0847",
      fonction: "Officier chef de quart",
      photoUrl: null,
      autorite: "Direction Générale des Affaires Maritimes, Côte d'Ivoire",
    },
  },
  "4K67B2Z5H": {
    trouve: true,
    statut: "EXPIRE",
    libelleStatut: "Document non valide",
    valide: false,
    message: "Ce document a expiré. Contactez la DGAM pour plus d'informations.",
    document: {
      certificat: "Certificat médical maritime",
      code: "MED",
      numero: "CI-MED-2022-3310",
      delivreLe: dateDecalee(-1400),
      expireLe: dateDecalee(-90),
      titulaire: "KOUASSI Y*** J***",
      matricule: "CI-MAR-2024-0847",
      fonction: "Officier chef de quart",
      photoUrl: null,
      autorite: "Direction Générale des Affaires Maritimes, Côte d'Ivoire",
    },
  },
  "7P93F1Y6C": {
    trouve: true,
    statut: "REMPLACE",
    libelleStatut: "Document remplacé",
    valide: false,
    message: "Ce document a été remplacé par une version plus récente. Demandez le document actuel au porteur.",
    remplacePar: "CI-LIV-2024-0847",
    document: {
      certificat: "Livret maritime national",
      code: "LIVRET",
      numero: "CI-LIV-2019-2210",
      delivreLe: dateDecalee(-2400),
      expireLe: dateDecalee(1200),
      titulaire: "KOUASSI Y*** J***",
      matricule: "CI-MAR-2024-0847",
      fonction: "Officier chef de quart",
      photoUrl: null,
      autorite: "Direction Générale des Affaires Maritimes, Côte d'Ivoire",
    },
  },
};

export const VERIFICATION_INTROUVABLE: ResultatVerification = {
  trouve: false,
  statut: "INTROUVABLE",
  libelleStatut: "Code inconnu",
  valide: false,
  message: "Aucun document ne correspond à ce code de vérification.",
};

// Moyens de paiement proposés lors du règlement des frais de dossier.
// La forme reprend celle renvoyée par l'API : canaux ouverts, opérateurs
// Mobile Money disponibles, et adresse du guichet pour le paiement en espèces.
export const MOYENS_PAIEMENT_DEMO = {
  canaux: ["MOBILE_MONEY", "ESPECES"],
  operateurs: ["ORANGE_MONEY", "MTN_MOMO", "WAVE", "MOOV_MONEY"],
  modeBacASable: true,
  guichet: "Antenne DGAM d'Abidjan, Boulevard de Marseille, Treichville",
};
