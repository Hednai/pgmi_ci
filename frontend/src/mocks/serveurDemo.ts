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
  DEMANDES_MARIN,
  DOCUMENTS_A_VERIFIER,
  DOCUMENTS_MARIN,
  EMBARQUEMENTS_A_VERIFIER,
  JOURNAL_AUDIT,
  MARIN_DEMO,
  MARINS_AGENT,
  MOYENS_PAIEMENT_DEMO,
  REFERENTIELS,
  SERVICE_MER_MARIN,
  SYNTHESE_AGENT,
  SYNTHESE_MARIN,
  VERIFICATION_INTROUVABLE,
  VERIFICATIONS_PUBLIQUES,
} from "./donneesDemo.js";

// Jetons de démonstration. Ils ne sont pas signés : ils servent uniquement
// à distinguer les deux publics au rechargement de la page.
export const JETON_MARIN_DEMO = "demo.marin.token";
export const JETON_AGENT_DEMO = "demo.agent.token";

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
    return succes({
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      compteExistant: true,
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
    return succes(DOCUMENTS_MARIN);
  }

  if (chemin === "/api/sea-service/me" && methode === "GET") {
    return succes(SERVICE_MER_MARIN);
  }

  if (chemin === "/api/conformite/me" && methode === "GET") {
    return succes([CONFORMITE_OOW]);
  }

  if (chemin === "/api/demandes/me" && methode === "GET") {
    return succes(DEMANDES_MARIN);
  }

  if (chemin === "/api/demandes/moyens-paiement" && methode === "GET") {
    return succes(MOYENS_PAIEMENT_DEMO);
  }

  // Création d'une demande : la référence est générée côté serveur réel.
  if (chemin === "/api/demandes/me" && methode === "POST") {
    const nouvelleDemande = {
      ...DEMANDES_MARIN[1],
      id: `dem-${Date.now()}`,
      reference: `REN-2026-${Math.floor(1000 + Math.random() * 8999)}`,
      status: "AWAITING_PAYMENT",
      createdAt: new Date().toISOString(),
    };
    return succes(nouvelleDemande);
  }

  // Paiement des frais : le webhook du prestataire est simulé immédiatement.
  if (chemin.startsWith("/api/demandes/me/") && chemin.endsWith("/paiement")) {
    return succes({
      id: `pay-${Date.now()}`,
      provider: String(corps.provider ?? "ORANGE_MONEY"),
      channel: "MOBILE_MONEY",
      amount: Number(corps.amount ?? 15000),
      currency: "XOF",
      status: "COMPLETED",
      paidAt: new Date().toISOString(),
    });
  }

  // Code de vérification d'un document du marin.
  if (chemin.startsWith("/api/documents/me/") && chemin.endsWith("/qr")) {
    return succes({ verificationCode: "8F72K9X4P", url: "https://pgmi.ci/v/8F72K9X4P" });
  }

  // Dépôt d'une preuve d'embarquement.
  if (chemin.startsWith("/api/sea-service/me/") && chemin.endsWith("/preuve")) {
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
    const code = decodeURIComponent(chemin.replace("/api/verification/", "")).toUpperCase();
    return succes(VERIFICATIONS_PUBLIQUES[code] ?? VERIFICATION_INTROUVABLE);
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

  const reponse =
    routerAuthentification(chemin, methode, charge, jeton) ??
    routerEspaceMarin(chemin, methode, charge, jeton) ??
    routerEspaceAgent(chemin, methode) ??
    routerPublicEtFormations(chemin, methode);

  if (!reponse) {
    return { traite: false };
  }

  await attendre(LATENCE_MS);
  return reponse;
}
