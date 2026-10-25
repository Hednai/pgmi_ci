// ============================================
// prisma/seed.ts
// Jeu de données de démonstration.
//
// Reprend les personnages et les chiffres de la spécification de design
// (Kouassi Yao Jean, matricule CI-MAR-2024-0847, Koné Mariam à l'antenne
// d'Abidjan) pour que les écrans livrés correspondent aux maquettes.
//
// Le script est idempotent : il vide les tables métier puis réinsère.
// ============================================
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password.js";
import {
  MARIN_STATUS,
  REGISTRATION_SOURCE,
  DOCUMENT_STATUS,
  EMBARKATION_STATUS,
  REQUEST_STATUS,
  REQUEST_TYPE,
  SESSION_STATUS,
  ENROLLMENT_STATUS,
  SUBMITTED_BY_ROLE,
} from "../src/domain/status.js";
import { AGENT_ROLE, AUTHORITY_LEVEL } from "../src/domain/roles.js";
import { DEFAULT_SESSION_QUORUM } from "../src/domain/rules.js";
import { generateVerificationCode, signQrPayload } from "../src/lib/qrcode.js";

const prisma = new PrismaClient();

// Raccourcis de dates relatives : le jeu de données reste cohérent quelle
// que soit la date à laquelle il est rejoué.
const jours = (nombre: number) => new Date(Date.now() + nombre * 24 * 60 * 60 * 1000);
const date = (texte: string) => new Date(texte);

const vider = async () => {
  // Ordre inverse des dépendances
  await prisma.qRVerificationLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.marinNotification.deleteMany();
  await prisma.trainingEnrollment.deleteMany();
  await prisma.trainingSession.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.requestAttachment.deleteMany();
  await prisma.renewalRequest.deleteMany();
  await prisma.embarkation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.marin.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.feeSchedule.deleteMany();
  await prisma.certificateRequirement.deleteMany();
  await prisma.certificateType.deleteMany();
  await prisma.fonction.deleteMany();
  await prisma.authority.deleteMany();
};

const principal = async () => {
  await vider();

  // ---- Autorités ----
  const dgam = await prisma.authority.create({
    data: {
      code: "DGAM",
      name: "Direction Générale des Affaires Maritimes et Portuaires",
      level: AUTHORITY_LEVEL.NATIONAL,
      city: "Abidjan",
    },
  });

  const antenneAbidjan = await prisma.authority.create({
    data: {
      code: "DGAM-ABJ",
      name: "Antenne DGAM Abidjan",
      level: AUTHORITY_LEVEL.REGIONAL_OFFICE,
      city: "Abidjan",
      parentId: dgam.id,
    },
  });

  await prisma.authority.create({
    data: {
      code: "DGAM-SP",
      name: "Antenne DGAM San-Pédro",
      level: AUTHORITY_LEVEL.REGIONAL_OFFICE,
      city: "San-Pédro",
      parentId: dgam.id,
    },
  });

  // ARSTM : institution de formation rattachée à la DGAM
  const arstm = await prisma.authority.create({
    data: {
      code: "ARSTM",
      name: "Académie Régionale des Sciences et Techniques de la Mer",
      level: AUTHORITY_LEVEL.TRAINING_INSTITUTION,
      city: "Abidjan",
      parentId: dgam.id,
    },
  });

  // ---- Fonctions maritimes ----
  const fonctionsSource = [
    { code: "CAPITAINE", label: "Capitaine", category: "PONT", sortOrder: 1 },
    { code: "SECOND", label: "Second capitaine", category: "PONT", sortOrder: 2 },
    { code: "CHEF_QUART", label: "Chef de quart", category: "PONT", sortOrder: 3 },
    { code: "LIEUTENANT", label: "Lieutenant", category: "PONT", sortOrder: 4 },
    { code: "CHEF_MEC", label: "Chef mécanicien", category: "MACHINE", sortOrder: 5 },
    { code: "SECOND_MEC", label: "Second mécanicien", category: "MACHINE", sortOrder: 6 },
    { code: "OFF_MEC", label: "Officier mécanicien", category: "MACHINE", sortOrder: 7 },
    { code: "MATELOT", label: "Matelot", category: "PONT", sortOrder: 8 },
    { code: "ELEVE", label: "Élève officier", category: "GENERAL", sortOrder: 9 },
  ];

  const fonctions: Record<string, string> = {};
  for (const source of fonctionsSource) {
    const creee = await prisma.fonction.create({ data: source });
    fonctions[source.code] = creee.id;
  }

  // ---- Types de certificats ----
  const certificatsSource = [
    { code: "LIVRET", label: "Livret professionnel maritime", category: "SEAMAN_BOOK", validityMonths: 120, requiresTraining: false, sortOrder: 1 },
    { code: "MEDICAL", label: "Certificat médical d'aptitude", category: "MEDICAL", validityMonths: 24, requiresTraining: false, sortOrder: 2 },
    { code: "BST", label: "Formation de base à la sécurité (STCW VI/1)", category: "STCW", validityMonths: 60, requiresTraining: true, trainingDays: 5, sortOrder: 3 },
    { code: "PST", label: "Techniques individuelles de survie", category: "STCW", validityMonths: 60, requiresTraining: true, trainingDays: 3, sortOrder: 4 },
    { code: "FPFF", label: "Lutte contre l'incendie, niveau avancé", category: "STCW", validityMonths: 60, requiresTraining: true, trainingDays: 4, sortOrder: 5 },
    { code: "PSSR", label: "Sécurité des personnes et responsabilités sociales", category: "STCW", validityMonths: 60, requiresTraining: true, trainingDays: 2, sortOrder: 6 },
    { code: "GMDSS", label: "Certificat général d'opérateur SMDSM", category: "STCW", validityMonths: 60, requiresTraining: true, trainingDays: 10, sortOrder: 7 },
    { code: "MAFA", label: "Soins médicaux d'urgence à bord", category: "STCW", validityMonths: 60, requiresTraining: true, trainingDays: 4, sortOrder: 8 },
    { code: "OOW", label: "Brevet de chef de quart passerelle (STCW II/1)", category: "STCW", validityMonths: 60, requiresTraining: false, sortOrder: 9 },
  ];

  const certificats: Record<string, string> = {};
  for (const source of certificatsSource) {
    const cree = await prisma.certificateType.create({ data: source });
    certificats[source.code] = cree.id;
  }

  // ---- Prérequis du brevet de chef de quart ----
  // Huit lignes : c'est la checklist affichée sur l'écran « Ma conformité ».
  const prerequisOow = [
    { requiredTypeId: certificats.BST, label: "Formation de base à la sécurité valide", sortOrder: 1 },
    { requiredTypeId: certificats.PST, label: "Techniques individuelles de survie", sortOrder: 2 },
    { requiredTypeId: certificats.FPFF, label: "Lutte contre l'incendie avancée", sortOrder: 3 },
    { requiredTypeId: certificats.PSSR, label: "Sécurité des personnes et responsabilités sociales", sortOrder: 4 },
    { requiredTypeId: certificats.GMDSS, label: "Certificat opérateur SMDSM", sortOrder: 5 },
    { requiredTypeId: certificats.MAFA, label: "Soins médicaux d'urgence à bord", sortOrder: 6 },
    { requiredTypeId: certificats.MEDICAL, label: "Certificat médical d'aptitude en cours de validité", sortOrder: 7 },
    { requiredSeaDays: 365, label: "365 jours de service en mer vérifiés", sortOrder: 8 },
  ];

  for (const regle of prerequisOow) {
    await prisma.certificateRequirement.create({
      data: {
        targetId: certificats.OOW as string,
        requiredTypeId: regle.requiredTypeId ?? null,
        requiredSeaDays: regle.requiredSeaDays ?? null,
        label: regle.label,
        sortOrder: regle.sortOrder,
      },
    });
  }

  // ---- Barèmes des frais ----
  const baremes = [
    { code: "LIVRET", type: REQUEST_TYPE.FIRST_ISSUANCE, montant: 25000 },
    { code: "LIVRET", type: REQUEST_TYPE.RENEWAL, montant: 15000 },
    { code: "LIVRET", type: REQUEST_TYPE.DUPLICATE, montant: 20000 },
    { code: "BST", type: REQUEST_TYPE.RENEWAL, montant: 15000 },
    { code: "GMDSS", type: REQUEST_TYPE.RENEWAL, montant: 20000 },
    { code: "OOW", type: REQUEST_TYPE.FIRST_ISSUANCE, montant: 50000 },
    { code: "OOW", type: REQUEST_TYPE.RENEWAL, montant: 30000 },
    { code: "MEDICAL", type: REQUEST_TYPE.RENEWAL, montant: 10000 },
  ];

  for (const bareme of baremes) {
    await prisma.feeSchedule.create({
      data: {
        certificateTypeId: certificats[bareme.code] as string,
        requestType: bareme.type,
        amount: bareme.montant,
      },
    });
  }

  // ---- Agents ----
  // Mot de passe commun en démonstration, à changer au premier déploiement.
  const motDePasse = await hashPassword("Pgmi2026!");

  const agentAbidjan = await prisma.agent.create({
    data: {
      authorityId: antenneAbidjan.id,
      email: "m.kone@dgam.ci",
      passwordHash: motDePasse,
      firstName: "Mariam",
      lastName: "Koné",
      role: AGENT_ROLE.DGAM_AGENT,
    },
  });

  const superviseur = await prisma.agent.create({
    data: {
      authorityId: dgam.id,
      email: "superviseur@dgam.ci",
      passwordHash: motDePasse,
      firstName: "Adama",
      lastName: "Traoré",
      role: AGENT_ROLE.DGAM_SUPERVISOR,
    },
  });

  await prisma.agent.create({
    data: {
      authorityId: dgam.id,
      email: "admin@dgam.ci",
      passwordHash: motDePasse,
      firstName: "Ismaël",
      lastName: "Bamba",
      role: AGENT_ROLE.PLATFORM_ADMIN,
    },
  });

  await prisma.agent.create({
    data: {
      authorityId: dgam.id,
      email: "referentiels@dgam.ci",
      passwordHash: motDePasse,
      firstName: "Awa",
      lastName: "Diomandé",
      role: AGENT_ROLE.BUSINESS_ADMIN,
    },
  });

  const agentFormationArstm = await prisma.agent.create({
    data: {
      authorityId: arstm.id,
      email: "formation@arstm.ci",
      passwordHash: motDePasse,
      firstName: "Séverin",
      lastName: "Gbagbo",
      role: AGENT_ROLE.ARSTM_TRAINING,
    },
  });

  const agentScolariteArstm = await prisma.agent.create({
    data: {
      authorityId: arstm.id,
      email: "scolarite@arstm.ci",
      passwordHash: motDePasse,
      firstName: "Fatou",
      lastName: "Cissé",
      role: AGENT_ROLE.ARSTM_REGISTRAR,
    },
  });

  await prisma.agent.create({
    data: {
      authorityId: arstm.id,
      email: "direction@arstm.ci",
      passwordHash: motDePasse,
      firstName: "Yao",
      lastName: "N'Guessan",
      role: AGENT_ROLE.ARSTM_MANAGER,
    },
  });

  // ---- Marin principal de la démonstration ----
  const kouassi = await prisma.marin.create({
    data: {
      authorityId: dgam.id,
      matricule: "CI-MAR-2024-0847",
      phone: "+2250701020304",
      email: "kouassi.yao@example.ci",
      firstName: "Kouassi Yao",
      lastName: "Jean",
      birthDate: date("1989-04-12"),
      birthPlace: "Bouaké",
      nationality: "Ivoirienne",
      idNumber: "CI0089341207",
      region: "Abidjan",
      shipCategory: "Navire de charge",
      fonctionId: fonctions.CHEF_QUART,
      status: MARIN_STATUS.ACTIVE,
      registrationSource: REGISTRATION_SOURCE.DGAM_DESK,
      validatedById: agentAbidjan.id,
      validatedAt: jours(-420),
      notifyEmail: true,
    },
  });

  // Documents de Kouassi : cinq prérequis sur huit sont satisfaits, comme
  // sur la maquette (progression 62 %).
  const documentsKouassi = [
    { code: "LIVRET", numero: "LPM-2019-3312", emission: jours(-1800), expiration: jours(1800) },
    { code: "MEDICAL", numero: "MED-2025-8841", emission: jours(-300), expiration: jours(430) },
    { code: "BST", numero: "BST-2022-1180", emission: jours(-1100), expiration: jours(720) },
    { code: "PST", numero: "PST-2022-1181", emission: jours(-1100), expiration: jours(720) },
    // Entré dans sa dernière année de validité : déclenche le module B
    { code: "GMDSS", numero: "GMD-2021-0455", emission: jours(-1490), expiration: jours(340) },
  ];

  for (const source of documentsKouassi) {
    const code = generateVerificationCode();
    const document = await prisma.document.create({
      data: {
        marinId: kouassi.id,
        certificateTypeId: certificats[source.code] as string,
        number: source.numero,
        issueDate: source.emission,
        expiryDate: source.expiration,
        issuedPlace: "Abidjan",
        status: DOCUMENT_STATUS.VERIFIED,
        verificationCode: code,
        verifiedById: agentAbidjan.id,
        verifiedAt: jours(-200),
      },
    });

    await prisma.document.update({
      where: { id: document.id },
      data: { qrToken: signQrPayload({ documentId: document.id, code, issuedAt: Date.now() }) },
    });
  }

  // Embarquements : 470 jours vérifiés, 182 en attente (chiffres maquette)
  await prisma.embarkation.create({
    data: {
      marinId: kouassi.id,
      vesselName: "MV Abidjan Star",
      imoNumber: "9456123",
      flag: "Côte d'Ivoire",
      vesselType: "Porte-conteneurs",
      fonctionId: fonctions.CHEF_QUART,
      startDate: date("2023-02-10"),
      endDate: date("2023-11-15"),
      days: 279,
      status: EMBARKATION_STATUS.VERIFIED,
      verifiedById: agentAbidjan.id,
      verifiedAt: jours(-300),
    },
  });

  await prisma.embarkation.create({
    data: {
      marinId: kouassi.id,
      vesselName: "MV Sassandra",
      imoNumber: "9312874",
      flag: "Panama",
      vesselType: "Vraquier",
      fonctionId: fonctions.LIEUTENANT,
      startDate: date("2024-03-04"),
      endDate: date("2024-09-11"),
      days: 191,
      status: EMBARKATION_STATUS.VERIFIED,
      verifiedById: agentAbidjan.id,
      verifiedAt: jours(-150),
    },
  });

  await prisma.embarkation.create({
    data: {
      marinId: kouassi.id,
      vesselName: "MV Bandama",
      imoNumber: "9587412",
      flag: "Côte d'Ivoire",
      vesselType: "Navire de charge",
      fonctionId: fonctions.CHEF_QUART,
      startDate: jours(-200),
      endDate: jours(-18),
      days: 182,
      status: EMBARKATION_STATUS.SUBMITTED,
      proofUrl: null,
    },
  });

  // ---- Autres marins ----
  const aminata = await prisma.marin.create({
    data: {
      authorityId: dgam.id,
      matricule: "CI-MAR-2023-0412",
      phone: "+2250506070809",
      firstName: "Aminata",
      lastName: "Bakayoko",
      birthDate: date("1992-09-02"),
      birthPlace: "San-Pédro",
      idNumber: "CI0092114455",
      region: "San-Pédro",
      fonctionId: fonctions.OFF_MEC,
      status: MARIN_STATUS.ACTIVE,
      registrationSource: REGISTRATION_SOURCE.DGAM_DESK,
      validatedById: agentAbidjan.id,
      validatedAt: jours(-700),
    },
  });

  // Certificat proche de l'expiration : alimente la file d'attente ARSTM
  const codeAminata = generateVerificationCode();
  const docAminata = await prisma.document.create({
    data: {
      marinId: aminata.id,
      certificateTypeId: certificats.BST as string,
      number: "BST-2021-0907",
      issueDate: jours(-1740),
      expiryDate: jours(85),
      issuedPlace: "Abidjan",
      status: DOCUMENT_STATUS.VERIFIED,
      verificationCode: codeAminata,
      verifiedById: agentAbidjan.id,
      verifiedAt: jours(-400),
    },
  });
  await prisma.document.update({
    where: { id: docAminata.id },
    data: {
      qrToken: signQrPayload({ documentId: docAminata.id, code: codeAminata, issuedAt: Date.now() }),
    },
  });

  // Marin inscrit en ligne, en attente de passage au guichet
  await prisma.marin.create({
    data: {
      authorityId: dgam.id,
      phone: "+2250102030405",
      firstName: "Ibrahim",
      lastName: "Ouattara",
      birthDate: date("1997-01-24"),
      birthPlace: "Korhogo",
      idNumber: "CI0097558812",
      region: "Abidjan",
      status: MARIN_STATUS.PENDING,
      registrationSource: REGISTRATION_SOURCE.SELF_ONLINE,
    },
  });

  // Élève navigant inscrit par l'ARSTM, en attente de validation DGAM (R20)
  const eleve = await prisma.marin.create({
    data: {
      authorityId: dgam.id,
      phone: "+2250708091011",
      firstName: "Affoué Marie",
      lastName: "Kouadio",
      birthDate: date("2003-06-18"),
      birthPlace: "Yamoussoukro",
      idNumber: "CI0103447721",
      region: "Abidjan",
      fonctionId: fonctions.ELEVE,
      status: MARIN_STATUS.PENDING_DGAM_VALIDATION,
      registrationSource: REGISTRATION_SOURCE.ARSTM_ENROLLMENT,
      isCadet: true,
      createdById: agentScolariteArstm.id,
    },
  });

  // ---- Demandes ----
  // Demande en instruction, frais réglés par Mobile Money
  const demandeKouassi = await prisma.renewalRequest.create({
    data: {
      reference: "REN-2026-0812",
      marinId: kouassi.id,
      certificateTypeId: certificats.GMDSS as string,
      type: REQUEST_TYPE.RENEWAL,
      reason: "Certificat SMDSM arrivant à échéance.",
      status: REQUEST_STATUS.IN_REVIEW,
      feeAmount: 20000,
      assignedToId: agentAbidjan.id,
      assignedAt: jours(-3),
      submittedByRole: SUBMITTED_BY_ROLE.MARIN,
    },
  });

  await prisma.payment.create({
    data: {
      requestId: demandeKouassi.id,
      provider: "ORANGE_MONEY",
      channel: "MOBILE_MONEY",
      amount: 20000,
      status: "PAID",
      payerPhone: kouassi.phone,
      externalRef: "PAY-DEMO-0001",
      paidAt: jours(-4),
    },
  });

  // Demande de livret ouverte par l'ARSTM au nom de l'élève (module D)
  await prisma.renewalRequest.create({
    data: {
      reference: "REN-2026-0913",
      marinId: eleve.id,
      certificateTypeId: certificats.LIVRET as string,
      type: REQUEST_TYPE.FIRST_ISSUANCE,
      reason: "Première délivrance, élève navigant en cursus ARSTM.",
      status: REQUEST_STATUS.AWAITING_PAYMENT,
      feeAmount: 25000,
      submittedById: agentScolariteArstm.id,
      submittedByRole: SUBMITTED_BY_ROLE.ARSTM_ENROLLMENT_AGENT,
    },
  });

  // Demande en attente d'instruction, pour la file de l'agent
  await prisma.renewalRequest.create({
    data: {
      reference: "REN-2026-0788",
      marinId: aminata.id,
      certificateTypeId: certificats.BST as string,
      type: REQUEST_TYPE.RENEWAL,
      status: REQUEST_STATUS.SUBMITTED,
      feeAmount: 15000,
      submittedByRole: SUBMITTED_BY_ROLE.MARIN,
    },
  });

  // ---- Sessions de formation ARSTM ----
  // Session en attente de quorum : trois inscrits sur cinq requis
  const sessionBst = await prisma.trainingSession.create({
    data: {
      code: "SES-2026-0412",
      authorityId: arstm.id,
      certificateTypeId: certificats.BST as string,
      capacity: 20,
      minQuorum: DEFAULT_SESSION_QUORUM,
      status: SESSION_STATUS.WAITING_FOR_QUORUM,
      createdById: agentFormationArstm.id,
    },
  });

  // Session programmée, quorum atteint
  const sessionGmdss = await prisma.trainingSession.create({
    data: {
      code: "SES-2026-0455",
      authorityId: arstm.id,
      certificateTypeId: certificats.GMDSS as string,
      startDate: jours(45),
      endDate: jours(55),
      location: "ARSTM, campus de Yopougon",
      trainer: "Cmdt. Bakary Sangaré",
      capacity: 16,
      minQuorum: DEFAULT_SESSION_QUORUM,
      status: SESSION_STATUS.SCHEDULED,
      createdById: agentFormationArstm.id,
    },
  });

  // Inscriptions : Aminata en attente de groupe, Kouassi confirmé,
  // plus une proposition automatique non encore acceptée.
  await prisma.trainingEnrollment.create({
    data: {
      marinId: aminata.id,
      certificateTypeId: certificats.BST as string,
      sessionId: sessionBst.id,
      status: ENROLLMENT_STATUS.PENDING,
      source: "SYSTEM_EXPIRY_SCAN",
    },
  });

  await prisma.trainingEnrollment.create({
    data: {
      marinId: kouassi.id,
      certificateTypeId: certificats.GMDSS as string,
      sessionId: sessionGmdss.id,
      status: ENROLLMENT_STATUS.CONFIRMED,
      source: "MARIN",
    },
  });

  await prisma.trainingEnrollment.create({
    data: {
      marinId: eleve.id,
      certificateTypeId: certificats.PSSR as string,
      status: ENROLLMENT_STATUS.PROPOSED,
      source: "ARSTM",
    },
  });

  console.log("Jeu de données PGMI créé.");
  console.log("--------------------------------------------------");
  console.log("Agent DGAM        : m.kone@dgam.ci        / Pgmi2026!");
  console.log("Superviseur DGAM  : superviseur@dgam.ci   / Pgmi2026!");
  console.log("Admin plateforme  : admin@dgam.ci         / Pgmi2026!");
  console.log("Admin métier      : referentiels@dgam.ci  / Pgmi2026!");
  console.log("ARSTM formation   : formation@arstm.ci    / Pgmi2026!");
  console.log("ARSTM scolarité   : scolarite@arstm.ci    / Pgmi2026!");
  console.log("ARSTM direction   : direction@arstm.ci    / Pgmi2026!");
  console.log("--------------------------------------------------");
  console.log("Marin de démonstration : +2250701020304 (CI-MAR-2024-0847)");
  console.log("Le code OTP s'affiche dans la réponse de l'API en développement.");
  console.log(`Superviseur créé : ${superviseur.email}`);
};

principal()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
