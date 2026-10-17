// ============================================
// mocks/etatDemo.ts
// État mutable du mode démonstration.
//
// Le jeu de données de donneesDemo.ts est un point de départ figé : il doit
// le rester, pour que chaque présentation reparte du même état. Les actions
// du visiteur, elles, doivent produire un effet visible, sans quoi un
// paiement réglé reste affiché « en attente de paiement » et un document
// déposé n'apparaît jamais dans la liste.
//
// Ce fichier tient donc une copie de travail, vivante le temps de l'onglet,
// et expose les seules opérations dont le serveur de démonstration a besoin.
// Aucun écran ne l'importe : il ne passe que par serveurDemo.ts.
//
// Règle de conduite de ce module : il imite le serveur, il ne l'arrange pas.
// Une opération refusée par l'API réelle doit être refusée ici aussi, sinon
// la démonstration valide des parcours qui échoueront en production.
// ============================================
import {
  DEMANDES_MARIN,
  DOCUMENTS_MARIN,
  VERIFICATIONS_PUBLIQUES,
  VERIFICATION_INTROUVABLE,
} from "./donneesDemo.js";
import type { Demande, DocumentMaritime, Paiement, ResultatVerification } from "../types/api.js";

// Statuts et libellés repris du domaine serveur. Ils sont nommés ici plutôt
// qu'écrits dans les fonctions : la démonstration et l'API réelle doivent
// prononcer les mêmes mots.
const STATUT_DEMANDE = {
  EN_ATTENTE_PAIEMENT: "AWAITING_PAYMENT",
  ASSIGNEE: "ASSIGNED",
} as const;

const STATUT_PAIEMENT = {
  REGLE: "PAID",
} as const;

const STATUT_DOCUMENT = {
  DEPOSE: "SCANNED",
  EXPIRE: "EXPIRED",
  REVOQUE: "REVOKED",
  REMPLACE: "REPLACED",
} as const;

// Statuts pour lesquels un document n'est plus opposable. Un QR scanné sur
// l'un d'eux doit afficher un avertissement, jamais « document authentique ».
const STATUTS_NON_VALIDES: readonly string[] = [
  STATUT_DOCUMENT.EXPIRE,
  STATUT_DOCUMENT.REVOQUE,
  STATUT_DOCUMENT.REMPLACE,
];

// Base de l'URL publique de vérification affichée sous le QR code.
// Elle suit le déploiement : une URL écrite en dur ferait pointer les QR de
// démonstration vers le vide dès le premier changement de domaine.
const BASE_VERIFICATION = `${window.location.origin}/verification?code=`;

// Refus portant un code HTTP, pour que le serveur de démonstration réponde
// comme l'API réelle au lieu de renvoyer systématiquement 200 ou 404.
// Nommé RefusDemo et non ErreurDemo : ce dernier nom désigne déjà la forme
// d'erreur transportée dans une réponse, dans serveurDemo.ts.
export class RefusDemo extends Error {
  public readonly statut: number;

  constructor(statut: number, message: string) {
    super(message);
    this.statut = statut;
  }
}

// Copies de travail. Chaque objet est recopié, ainsi que les tableaux
// imbriqués qu'une opération peut remplacer : sans cela, régler une demande
// modifierait aussi le jeu de départ, et la présentation suivante partirait
// d'un état déjà joué.
const copierDemande = (demande: Demande): Demande => ({
  ...demande,
  certificateType: { ...demande.certificateType },
  payments: demande.payments.map(function (paiement) {
    return { ...paiement };
  }),
  attachments: demande.attachments.map(function (piece) {
    return { ...piece };
  }),
});

const copierDocument = (document: DocumentMaritime): DocumentMaritime => ({
  ...document,
  certificateType: { ...document.certificateType },
});

let demandes: Demande[] = DEMANDES_MARIN.map(copierDemande);
let documents: DocumentMaritime[] = DOCUMENTS_MARIN.map(copierDocument);

// Identifiants aléatoires. Date.now() produisait des collisions sur deux
// créations dans la même milliseconde, ce qu'un double-clic suffit à
// provoquer : deux objets portaient alors le même identifiant et la mise à
// jour de l'un écrasait l'autre.
const identifiant = (prefixe: string): string =>
  `${prefixe}-${crypto.randomUUID().slice(0, 8)}`;

// Suffixe de référence métier, en majuscules. Fonction dédiée plutôt qu'un
// découpage de l'identifiant technique : la précédente version dépendait de
// la position du tiret, elle fonctionnait par effet de bord.
const suffixeReference = (): string =>
  crypto.randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();

// ---- Lecture ----
// Les objets sont rendus en copie, pas seulement le tableau : un écran qui
// modifierait un objet reçu changerait l'état du serveur de démonstration
// sans passer par une route, et le défaut ne se verrait qu'à la
// présentation suivante.

export const listerDemandesDemo = (): Demande[] => demandes.map(copierDemande);

export const listerDocumentsDemo = (): DocumentMaritime[] => documents.map(copierDocument);

// Gabarit de départ. L'absence de jeu de données est une erreur de
// configuration, pas un cas limite à absorber : mieux vaut un message net
// qu'un objet incomplet qui provoquera un écran blanc trois clics plus loin.
const exigerGabarit = <T,>(collection: T[], nom: string): T => {
  if (collection.length === 0) {
    throw new RefusDemo(500, `Jeu de démonstration vide : aucun ${nom} de référence.`);
  }
  return collection[0];
};

// Type de certificat demandé, cherché dans les documents du jeu de données.
// Un identifiant inconnu est refusé plutôt que remplacé silencieusement par
// le premier type venu : l'API réelle le rejette, la démonstration doit
// faire remonter la même erreur pour que le défaut se voie ici et non en
// production.
const certificatExige = (certificateTypeId: string) => {
  const trouve = documents.find(function (document) {
    return document.certificateType.id === certificateTypeId;
  });

  if (!trouve) {
    throw new RefusDemo(400, "Type de certificat inconnu.");
  }

  return trouve.certificateType;
};

// ---- Demandes ----

export const creerDemandeDemo = (certificateTypeId: string): Demande => {
  const gabarit = exigerGabarit(demandes, "dossier");
  const certificat = certificatExige(certificateTypeId);

  const nouvelle: Demande = {
    ...copierDemande(gabarit),
    id: identifiant("dem"),
    reference: `REN-${new Date().getFullYear()}-${suffixeReference()}`,
    certificateType: certificat,
    status: STATUT_DEMANDE.EN_ATTENTE_PAIEMENT,
    createdAt: new Date().toISOString(),
    payments: [],
    attachments: [],
    assignedTo: null,
    decisionReason: null,
    additionalInfo: null,
  };

  demandes = [nouvelle, ...demandes];
  return nouvelle;
};

// Régler une demande. Le paiement est confirmé immédiatement, comme le fait
// le fournisseur en bac à sable côté serveur, et la demande passe en
// instruction : c'est l'enchaînement de requests.service.ts.
export const reglerDemandeDemo = (requestId: string, operateur: string): Demande => {
  const index = demandes.findIndex(function (demande) {
    return demande.id === requestId;
  });

  if (index === -1) {
    throw new RefusDemo(404, "Demande introuvable.");
  }

  const demande = demandes[index];

  // Une demande déjà réglée ne se règle pas deux fois. Sans ce contrôle, la
  // démonstration encaissait autant de paiements que de clics, ce que l'API
  // réelle refuse.
  if (demande.status !== STATUT_DEMANDE.EN_ATTENTE_PAIEMENT) {
    throw new RefusDemo(409, "Cette demande n'est pas en attente de paiement.");
  }

  const paiement: Paiement = {
    id: identifiant("pay"),
    provider: operateur || "ORANGE_MONEY",
    channel: "MOBILE_MONEY",
    amount: demande.feeAmount,
    currency: demande.currency,
    status: STATUT_PAIEMENT.REGLE,
    paidAt: new Date().toISOString(),
  };

  const reglee: Demande = {
    ...demande,
    status: STATUT_DEMANDE.ASSIGNEE,
    // Le nouveau paiement s'ajoute à l'historique au lieu de le remplacer :
    // un règlement partiel antérieur doit rester lisible.
    payments: [...demande.payments, paiement],
  };

  demandes = demandes.map(function (valeur, rang) {
    return rang === index ? reglee : valeur;
  });

  return reglee;
};

// Dernier paiement d'une demande, celui que l'écran vient de produire.
export const dernierPaiementDemo = (demande: Demande): Paiement | null =>
  demande.payments.length > 0 ? demande.payments[demande.payments.length - 1] : null;

// ---- Documents ----

// Déposer un document. Il arrive au statut déposé, non vérifié : c'est ce
// que fait le serveur, et c'est ce qui rend lisible l'étape de contrôle par
// la DGAM pendant une démonstration.
export const deposerDocumentDemo = (donnees: {
  certificateTypeId: string;
  number?: string;
  issueDate?: string;
  expiryDate?: string;
}): DocumentMaritime => {
  const gabarit = exigerGabarit(documents, "document");
  const certificat = certificatExige(donnees.certificateTypeId);

  const nouveau: DocumentMaritime = {
    ...copierDocument(gabarit),
    id: identifiant("doc"),
    number: donnees.number ?? null,
    issueDate: donnees.issueDate ?? null,
    expiryDate: donnees.expiryDate ?? null,
    status: STATUT_DOCUMENT.DEPOSE,
    statutEffectif: STATUT_DOCUMENT.DEPOSE,
    joursRestants: null,
    // Un document déposé n'a pas de code : il n'a pas encore été vérifié
    verificationCode: null,
    fileUrl: null,
    certificateType: certificat,
  };

  documents = [nouveau, ...documents];
  return nouveau;
};

// Données du QR d'un document, au contrat exact de l'API réelle :
// { code, url, image, certificat, statut }. L'image reste vide en
// démonstration, l'écran affiche alors le code en clair.
export const qrDuDocumentDemo = (documentId: string) => {
  const document = documents.find(function (valeur) {
    return valeur.id === documentId;
  });

  if (!document) {
    throw new RefusDemo(404, "Document introuvable.");
  }

  if (!document.verificationCode) {
    throw new RefusDemo(409, "Ce document n'a pas encore été vérifié par la DGAM.");
  }

  return {
    code: document.verificationCode,
    url: `${BASE_VERIFICATION}${document.verificationCode}`,
    image: "",
    certificat: document.certificateType.label,
    statut: document.statutEffectif ?? document.status,
  };
};

// Un document est-il encore opposable ? Même lecture que le serveur :
// statut non valide, ou date d'expiration dépassée.
const documentValide = (document: DocumentMaritime): boolean => {
  const statut = document.statutEffectif ?? document.status;
  if (STATUTS_NON_VALIDES.includes(statut)) return false;

  if (!document.expiryDate) return true;

  const echeance = new Date(document.expiryDate).getTime();

  // Date illisible : le document n'est pas déclaré valide. Le refus est
  // explicite plutôt que reposant sur le fait qu'une comparaison avec NaN
  // renvoie faux, comportement juste mais muet.
  if (!Number.isFinite(echeance)) return false;

  return echeance >= Date.now();
};

// Vérification publique d'un code.
//
// Le document connu fait toujours foi, et sa validité est toujours
// recalculée. La version précédente renvoyait l'entrée préparée du jeu de
// données dès qu'elle existait, donc sans jamais contrôler l'expiration
// pour ces codes : un certificat périmé se serait affiché « document
// authentique » devant la DGAM, c'est-à-dire exactement le cas que la
// plateforme existe pour détecter.
export const verifierCodeDemo = (code: string): ResultatVerification => {
  const normalise = code.trim().toUpperCase();

  const prepare = VERIFICATIONS_PUBLIQUES[normalise];

  const document = documents.find(function (valeur) {
    return valeur.verificationCode === normalise;
  });

  // Code sans document connu : la réponse préparée sert de repli si elle
  // existe, sinon le code est inconnu.
  if (!document) return prepare ?? VERIFICATION_INTROUVABLE;

  const statut = document.statutEffectif ?? document.status;
  const valide = documentValide(document);

  const gabarit = prepare?.document ?? Object.values(VERIFICATIONS_PUBLIQUES)[0]?.document;

  const resultat: ResultatVerification = {
    ...(prepare ?? VERIFICATION_INTROUVABLE),
    trouve: true,
    statut,
    libelleStatut: valide ? "Document authentique" : "Document non valide",
    valide,
    message: valide
      ? "Ce document a été délivré et vérifié par la Direction Générale des Affaires Maritimes."
      : "Ce document n'est plus opposable. Contactez la DGAM avant de l'accepter.",
    document: gabarit
      ? {
          ...gabarit,
          certificat: document.certificateType.label,
          code: document.certificateType.code,
          numero: document.number,
          expireLe: document.expiryDate,
        }
      : undefined,
  };

  return resultat;
};