// ============================================
// mocks/serveurDemo.ts
// Serveur de démonstration exécuté dans le navigateur.
//
// Il répond aux mêmes chemins que l'API réelle, avec les mêmes contrats de
// données. Le client HTTP l'interroge en priorité lorsque le mode
// démonstration est actif, et retombe sur le réseau dès qu'il est désactivé.
//
// Aucun écran ne connaît ce fichier : la substitution se fait dans
// lib/apiClient.ts, au seul endroit où les requêtes sont émises.
// ============================================
import {
  AGENT_DEMO,
  CODE_OTP_DEMO,
  COMPTES_AGENT_DEMO,
  CONFORMITE_OOW,
  DEMANDES_AGENT,
  DOCUMENTS_A_VERIFIER,
  EMBARQUEMENTS_A_VERIFIER,
  JOURNAL_AUDIT,
  MARIN_DEMO,
  MARINS_AGENT,
  MOYENS_PAIEMENT_DEMO,
  REFERENTIELS,
  CONTRAINTES_DEPOT_DEMO,
  PIECES_SERVICE_MER_DEMO,
  SERVICE_MER_MARIN,
  SYNTHESE_AGENT,
  SYNTHESE_MARIN,
} from "./donneesDemo.js";
import type { IdentifiantsDemo } from "../hooks/useIdentifiantsDemo.js";
import {
  creerDemandeDemo,
  dernierPaiementDemo,
  deposerDocumentDemo,
  RefusDemo,
  listerDemandesDemo,
  listerDocumentsDemo,
  qrDuDocumentDemo,
  reglerDemandeDemo,
  verifierCodeDemo,
} from "./etatDemo.js";

// Jetons de démonstration. Ils ne sont pas signés : ils servent uniquement
// à distinguer les deux publics au rechargement de la page.
export const JETON_MARIN_DEMO = "demo.marin.token";
export const JETON_AGENT_DEMO = "demo.agent.token";

// Identifiants affichés dans le bandeau de démonstration.
// Exportés depuis ce fichier pour rester cohérents avec les comptes définis
// dans donneesDemo.ts, sans dupliquer les valeurs.
export const IDENTIFIANTS_DEMO: IdentifiantsDemo = {
  codeOtp: CODE_OTP_DEMO,
  comptesAgent: COMPTES_AGENT_DEMO.map(function (compte) {
    return {
      email: compte.email,
      motDePasse: compte.motDePasse,
      role: compte.agent.role,
    };
  }),
};

// Latence simulée, en millisecondes. Elle rend visibles les indicateurs de
// chargement de l'interface, comme sur une connexion mobile réelle.
const LATENCE_MS = 260;

// Erreur renvoyée par le serveur de démonstration, transposée ensuite en
// ErreurApi par le client HTTP.
export interface ErreurDemo {
  statut: number;
  message: string;
}

export interface ReponseDemo {
  // Faux lorsque le chemin n'est pas géré : le client bascule alors sur le réseau.
  traite: boolean;
  donnees?: unknown;
  erreur?: ErreurDemo;
}

// État mutable de la session simulée, conservé le temps de l'onglet.
let agentConnecte = AGENT_DEMO;

function attendre(millisecondes: number): Promise<void> {
  return new Promise(function (resoudre) {
    setTimeout(resoudre, millisecondes);
  });
}

function succes(donnees: unknown): ReponseDemo {
  return { traite: true, donnees };
}

function echec(statut: number, message: string): ReponseDemo {
  return { traite: true, erreur: { statut, message } };
}

// Retire la chaîne de requête d'un chemin : /api/marins?page=1 devient /api/marins.
function cheminSansParametres(chemin: string): string {
  const separateur = chemin.indexOf("?");
  return separateur === -1 ? chemin : chemin.slice(0, separateur);
}

// Enveloppe paginée attendue par les écrans de liste de l'espace agent.
function pagine<T>(items: T[]) {
  return {
    items,
    page: 1,
    taille: items.length,
    total: items.length,
    pages: 1,
  };
}

// ============================================
// Routes d'authentification
// ============================================

function routerAuthentification(
  chemin: string,
  methode: string,
  corps: Record<string, unknown>,
  jeton: string | null,
): ReponseDemo | null {
  if (chemin === "/api/auth/otp/request" && methode === "POST") {
    // L'existence du dossier n'est plus révélée à cette étape (C3) :
    // la réponse est identique pour un numéro connu et un numéro inconnu.
    return succes({
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      codeDeveloppement: CODE_OTP_DEMO,
    });
  }

  if (chemin === "/api/auth/otp/verify" && methode === "POST") {
    if (corps.code !== CODE_OTP_DEMO) {
      return echec(401, `Code incorrect. En mode démonstration, le code est ${CODE_OTP_DEMO}.`);
    }
    return succes({
      marin: MARIN_DEMO,
      accessToken: JETON_MARIN_DEMO,
      refreshToken: JETON_MARIN_DEMO,
    });
  }

  if (chemin === "/api/auth/agent/login" && methode === "POST") {
    const compte = COMPTES_AGENT_DEMO.find(function (candidat) {
      return candidat.email === String(corps.email).trim().toLowerCase();
    });

    if (!compte || compte.motDePasse !== corps.password) {
      return echec(401, "Identifiants incorrects. Vérifiez l'adresse et le mot de passe de démonstration.");
    }

    agentConnecte = compte.agent;
    return succes({
      agent: compte.agent,
      accessToken: JETON_AGENT_DEMO,
      refreshToken: JETON_AGENT_DEMO,
    });
  }

  if (chemin === "/api/auth/agent/logout" && methode === "POST") {
    return succes({ deconnecte: true });
  }

  // Identité de l'acteur courant, utilisée pour restaurer la session.
  if (chemin === "/api/auth/me" && methode === "GET") {
    if (jeton !== JETON_AGENT_DEMO) {
      return echec(401, "Aucune session agent ouverte.");
    }
    return succes({
      id: agentConnecte.id,
      label: `${agentConnecte.firstName} ${agentConnecte.lastName}`,
      role: agentConnecte.role,
    });
  }

  if (chemin === "/api/auth/register" && methode === "POST") {
    return succes({
      marin: MARIN_DEMO,
      accessToken: JETON_MARIN_DEMO,
      refreshToken: JETON_MARIN_DEMO,
    });
  }

  return null;
}

// ============================================
// Routes de l'espace marin
// ============================================

function routerEspaceMarin(
  chemin: string,
  methode: string,
  corps: Record<string, unknown>,
  jeton: string | null,
): ReponseDemo | null {
  // Un agent connecté n'est pas un marin : la restauration de session
  // s'appuie sur ce refus pour identifier le bon espace.
  if (chemin === "/api/marins/me" && methode === "GET") {
    if (jeton === JETON_AGENT_DEMO) {
      return echec(401, "Ce compte n'est pas un compte marin.");
    }
    return succes(MARIN_DEMO);
  }

  if (chemin === "/api/marins/me/synthese" && methode === "GET") {
    return succes(SYNTHESE_MARIN);
  }

  if (chemin === "/api/marins/me/preferences" && methode === "PATCH") {
    return succes({ ...MARIN_DEMO, preferences: { ...MARIN_DEMO.preferences, ...corps } });
  }

  if (chemin === "/api/documents/me" && methode === "GET") {
    return succes(listerDocumentsDemo());
  }

  // Dépôt d'un document. Il tombait auparavant dans le filet des actions
  // agent, qui répondait « ok » sans rien enregistrer : le marin voyait sa
  // saisie disparaître.
  if (chemin === "/api/documents/me" && methode === "POST") {
    return succes(
      deposerDocumentDemo({
        certificateTypeId: String(corps.certificateTypeId ?? ""),
        number: corps.number ? String(corps.number) : undefined,
        issueDate: corps.issueDate ? String(corps.issueDate) : undefined,
        expiryDate: corps.expiryDate ? String(corps.expiryDate) : undefined,
      }),
    );
  }

  if (chemin === "/api/sea-service/me" && methode === "GET") {
    return succes(SERVICE_MER_MARIN);
  }

  if (chemin === "/api/conformite/me" && methode === "GET") {
    return succes([CONFORMITE_OOW]);
  }

  if (chemin === "/api/demandes/me" && methode === "GET") {
    return succes(listerDemandesDemo());
  }

  if (chemin === "/api/demandes/moyens-paiement" && methode === "GET") {
    return succes(MOYENS_PAIEMENT_DEMO);
  }

  // Création d'une demande : la référence est générée côté serveur réel.
  if (chemin === "/api/demandes/me" && methode === "POST") {
    return succes(creerDemandeDemo(String(corps.certificateTypeId ?? "")));
  }

  // Paiement des frais. La réponse reprend le contrat du contrôleur réel,
  // { paiement, demande } : l'écran de paiement lit la demande actualisée
  // pour savoir que l'instruction a démarré. Renvoyer le seul paiement
  // laissait la demande en attente de règlement à l'écran.
  if (chemin.startsWith("/api/demandes/me/") && chemin.endsWith("/paiement")) {
    const id = identifiantPar(MOTIF_PAIEMENT, chemin);
    if (!id) {
      return echec(400, "Référence de demande absente.");
    }

    const demande = reglerDemandeDemo(id, String(corps.operateur ?? ""));
    return succes({ paiement: dernierPaiementDemo(demande), demande });
  }

  // Code de vérification d'un document du marin. Le code suit le document
  // demandé : un code en dur affichait le même QR pour tous les documents,
  // et la page publique répondait « code inconnu » pour les autres.
  if (chemin.startsWith("/api/documents/me/") && chemin.endsWith("/qr")) {
    const id = identifiantPar(MOTIF_QR, chemin);
    if (!id) {
      return echec(400, "Référence de document absente.");
    }

    return succes(qrDuDocumentDemo(id));
  }

  // Pièces justificatives d'un embarquement. Le référentiel est celui du
  // domaine serveur, recopié dans donneesDemo.ts : la note affichée au marin
  // est donc la même en démonstration et en production.
  if (chemin === "/api/sea-service/pieces-attendues" && methode === "GET") {
    return succes(PIECES_SERVICE_MER_DEMO);
  }

  // Contraintes de dépôt. Les valeurs sont celles du serveur : le composant
  // de dépôt les affiche avant envoi, il ne doit pas les connaître lui-même.
  if (chemin === "/api/referentiels/contraintes-depot" && methode === "GET") {
    return succes(CONTRAINTES_DEPOT_DEMO);
  }

  // Dépôt d'une pièce, puis soumission du dossier. Les deux étapes sont
  // distinctes, comme côté serveur.
  if (chemin.startsWith("/api/sea-service/me/") && chemin.includes("/pieces")) {
    return succes({ ...SERVICE_MER_MARIN.embarquements[0], status: "DECLARED" });
  }

  if (chemin.startsWith("/api/sea-service/me/") && chemin.endsWith("/soumission")) {
    return succes({ ...SERVICE_MER_MARIN.embarquements[0], status: "SUBMITTED" });
  }

  return null;
}

// ============================================
// Routes de l'espace agent
// ============================================

function routerEspaceAgent(chemin: string, methode: string): ReponseDemo | null {
  if (chemin === "/api/dashboard" && methode === "GET") {
    return succes(SYNTHESE_AGENT);
  }

  if (chemin === "/api/marins" && methode === "GET") {
    return succes(pagine(MARINS_AGENT));
  }

  if (chemin === "/api/marins/eleves" && methode === "GET") {
    return succes(
      pagine(
        MARINS_AGENT.filter(function (marin) {
          return marin.isCadet;
        }),
      ),
    );
  }

  if (chemin === "/api/demandes" && methode === "GET") {
    return succes(pagine(DEMANDES_AGENT));
  }

  // Les files de contrôle sont paginées, comme les autres listes agent.
  if (chemin === "/api/documents/a-verifier" && methode === "GET") {
    return succes(pagine(DOCUMENTS_A_VERIFIER));
  }

  if (chemin === "/api/sea-service/a-verifier" && methode === "GET") {
    return succes(pagine(EMBARQUEMENTS_A_VERIFIER));
  }

  if (chemin === "/api/audit" && methode === "GET") {
    return succes(pagine(JOURNAL_AUDIT));
  }

  if (chemin === "/api/referentiels" && methode === "GET") {
    return succes(REFERENTIELS);
  }

  // Actions d'instruction : activation, vérification, décision sur une demande.
  // Le mode démonstration confirme l'action sans modifier durablement le jeu
  // de données, afin que chaque présentation reparte d'un état identique.
  const estActionAgent =
    chemin.startsWith("/api/marins/") ||
    chemin.startsWith("/api/documents/") ||
    chemin.startsWith("/api/sea-service/") ||
    chemin.startsWith("/api/demandes/");

  if (estActionAgent && (methode === "POST" || methode === "PATCH")) {
    return succes({ ok: true, modeDemonstration: true });
  }

  return null;
}

// ============================================
// Routes publiques et formations
// ============================================

function routerPublicEtFormations(chemin: string, methode: string): ReponseDemo | null {
  if (chemin.startsWith("/api/verification/") && methode === "GET") {
    // decodeURIComponent lève sur une séquence mal formée (%E0%A4%A) :
    // sans ce garde, une URL tordue produisait une exception non gérée.
    let code: string;
    try {
      code = decodeURIComponent(chemin.replace("/api/verification/", ""));
    } catch {
      return echec(400, "Code de vérification mal formé.");
    }

    return succes(verifierCodeDemo(code));
  }

  // Le module de formation n'est pas alimenté dans ce jeu de démonstration :
  // les écrans concernés affichent donc leur état vide, qui est un cas réel.
  if (chemin === "/api/formations/me" && methode === "GET") {
    return succes([]);
  }

  if (chemin === "/api/formations/sessions-ouvertes" && methode === "GET") {
    return succes([]);
  }

  if (chemin === "/api/formations/sessions" && methode === "GET") {
    return succes(pagine([]));
  }

  if (chemin === "/api/formations/synthese" && methode === "GET") {
    return succes({
      sessionsAttente: 0,
      sessionsProgrammees: 0,
      inscriptionsEnAttente: 0,
      elevesEnAttenteValidation: 0,
      fileAttente: [],
    });
  }

  return null;
}

// ============================================
// Point d'entrée du serveur de démonstration
// ============================================

// Identifiant de ressource extrait par motif complet, et non par position.
//
// Un découpage sur l'index 4 dépendait entièrement de la forme du chemin :
// la fonction devenait fausse dès qu'une route gagnait ou perdait un
// segment, sans que rien ne le signale. Le motif complet refuse ce qu'il ne
// reconnaît pas.
function identifiantPar(motif: RegExp, chemin: string): string | null {
  return motif.exec(chemin)?.[1] ?? null;
}

const MOTIF_PAIEMENT = /^\/api\/demandes\/me\/([^/]+)\/paiement$/;
const MOTIF_QR = /^\/api\/documents\/me\/([^/]+)\/qr$/;

// Répond à une requête si le chemin est géré. La latence simulée est
// appliquée avant la réponse pour reproduire une connexion mobile.
export async function repondreEnModeDemo(
  cheminComplet: string,
  methode: string,
  corps: unknown,
  jeton: string | null,
): Promise<ReponseDemo> {
  const chemin = cheminSansParametres(cheminComplet);
  const charge = (corps ?? {}) as Record<string, unknown>;

  let reponse: ReponseDemo | null;

  try {
    reponse =
      routerAuthentification(chemin, methode, charge, jeton) ??
      routerEspaceMarin(chemin, methode, charge, jeton) ??
      routerEspaceAgent(chemin, methode) ??
      routerPublicEtFormations(chemin, methode);
  } catch (err) {
    // Les refus métier de l'état de démonstration remontent avec leur code
    // HTTP réel : l'écran affiche le même message et le même comportement
    // qu'en production. Sans ce relais, une règle violée produisait une
    // exception non gérée et une page blanche.
    if (err instanceof RefusDemo) {
      reponse = echec(err.statut, err.message);
    } else {
      throw err;
    }
  }

  if (!reponse) {
    return { traite: false };
  }

  await attendre(LATENCE_MS);
  return reponse;
}