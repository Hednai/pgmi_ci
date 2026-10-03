// ============================================
// lib/apiClient.ts
// Client HTTP unique de l'application.
//
// Il porte trois responsabilités que les composants n'ont donc pas à gérer :
//   - injection du jeton d'accès ;
//   - rafraîchissement automatique et transparent à l'expiration ;
//   - normalisation des erreurs en une exception unique et lisible.
// ============================================
import { t } from "../i18n/index.js";
import type { ReponseApi } from "../types/api.js";

const BASE = import.meta.env.VITE_API_URL ?? "";

// Mode démonstration : les requêtes sont servies par un jeu de données local
// au lieu du réseau. Il permet de présenter la plateforme sans backend
// déployé. Toute autre valeur que "true" laisse le comportement réseau normal.
const MODE_DEMO = import.meta.env.VITE_MODE_DEMO === "true";

// Le serveur de démonstration et son jeu de données sont chargés à la
// demande, et une seule fois. Hors mode démonstration, ce code ne part
// jamais sur le réseau : il forme un fragment séparé que le navigateur
// ne télécharge pas.
let chargementServeurDemo: Promise<typeof import("../mocks/serveurDemo.js")> | null = null;

const obtenirServeurDemo = () => {
  chargementServeurDemo = chargementServeurDemo ?? import("../mocks/serveurDemo.js");
  return chargementServeurDemo;
};

// Clés de stockage. Le jeton de rafraîchissement est conservé en
// localStorage : sans cela, un marin devrait ressaisir un code SMS à chaque
// ouverture de l'application, ce qui est inacceptable sur le terrain.
const CLE_ACCES = "pgmi.accessToken";
const CLE_RAFRAICHISSEMENT = "pgmi.refreshToken";

export const jetons = {
  lireAcces: () => localStorage.getItem(CLE_ACCES),
  lireRafraichissement: () => localStorage.getItem(CLE_RAFRAICHISSEMENT),
  enregistrer: (acces: string, rafraichissement?: string) => {
    localStorage.setItem(CLE_ACCES, acces);
    if (rafraichissement) localStorage.setItem(CLE_RAFRAICHISSEMENT, rafraichissement);
  },
  effacer: () => {
    localStorage.removeItem(CLE_ACCES);
    localStorage.removeItem(CLE_RAFRAICHISSEMENT);
  },
};

// Erreur applicative : porte le code HTTP et l'identifiant de règle métier
// renvoyé par le serveur, ce qui permet aux écrans d'expliquer un refus.
export class ErreurApi extends Error {
  public statut: number;
  public regle?: string;

  constructor(message: string, statut: number, regle?: string) {
    super(message);
    this.statut = statut;
    this.regle = regle;
  }
}

interface OptionsRequete {
  methode?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  corps?: unknown;
  // Requête publique : aucun jeton n'est envoyé
  publique?: boolean;
}

// Un seul rafraîchissement à la fois : si trois appels expirent ensemble,
// ils attendent la même promesse au lieu de lancer trois renouvellements.
let rafraichissementEnCours: Promise<boolean> | null = null;

const rafraichirJeton = async (): Promise<boolean> => {
  const refreshToken = jetons.lireRafraichissement();
  if (!refreshToken) return false;

  try {
    const reponse = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!reponse.ok) return false;

    const corps = (await reponse.json()) as ReponseApi<{ accessToken: string }>;
    jetons.enregistrer(corps.data.accessToken);
    return true;
  } catch {
    return false;
  }
};

const executer = async <T>(chemin: string, options: OptionsRequete, reessai = true): Promise<T> => {
  // Interception du mode démonstration, avant toute sortie réseau. Un chemin
  // non géré par le serveur local repart vers l'API comme d'habitude.
  if (MODE_DEMO) {
    const { repondreEnModeDemo } = await obtenirServeurDemo();
    const reponseDemo = await repondreEnModeDemo(
      chemin,
      options.methode ?? "GET",
      options.corps,
      options.publique ? null : jetons.lireAcces(),
    );

    if (reponseDemo.traite) {
      if (reponseDemo.erreur) {
        throw new ErreurApi(reponseDemo.erreur.message, reponseDemo.erreur.statut);
      }
      return reponseDemo.donnees as T;
    }
  }

  const entetes: Record<string, string> = {};
  if (options.corps !== undefined) entetes["Content-Type"] = "application/json";

  const jeton = jetons.lireAcces();
  if (jeton && !options.publique) entetes.Authorization = `Bearer ${jeton}`;

  let reponse: Response;
  try {
    reponse = await fetch(`${BASE}${chemin}`, {
      method: options.methode ?? "GET",
      headers: entetes,
      body: options.corps !== undefined ? JSON.stringify(options.corps) : undefined,
    });
  } catch {
    // Panne réseau : message compréhensible plutôt qu'une erreur technique
    throw new ErreurApi(t.commun.erreurReseau, 0);
  }

  // Jeton expiré : un renouvellement est tenté une fois, puis la requête
  // initiale est rejouée. L'utilisateur ne voit rien.
  if (reponse.status === 401 && reessai && !options.publique) {
    rafraichissementEnCours = rafraichissementEnCours ?? rafraichirJeton();
    const renouvele = await rafraichissementEnCours;
    rafraichissementEnCours = null;

    if (renouvele) return executer<T>(chemin, options, false);
    jetons.effacer();
  }

  let corps: ReponseApi<T> | null = null;
  try {
    corps = (await reponse.json()) as ReponseApi<T>;
  } catch {
    corps = null;
  }

  if (!reponse.ok) {
    throw new ErreurApi(
      corps?.message ?? t.commun.erreurReseau,
      reponse.status,
      corps?.rule,
    );
  }

  return (corps?.data ?? null) as T;
};

export const api = {
  get: <T>(chemin: string, publique = false) => executer<T>(chemin, { publique }),
  post: <T>(chemin: string, corps?: unknown, publique = false) =>
    executer<T>(chemin, { methode: "POST", corps, publique }),
  patch: <T>(chemin: string, corps?: unknown) =>
    executer<T>(chemin, { methode: "PATCH", corps }),
  delete: <T>(chemin: string) => executer<T>(chemin, { methode: "DELETE" }),
};

// Convertir un fichier du navigateur en charge utile acceptée par l'API.
// La conversion est faite ici plutôt que dans chaque écran d'upload.
export const lireFichier = (fichier: File): Promise<{ nom: string; mimeType: string; contenuBase64: string }> =>
  new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      const resultat = String(lecteur.result);
      resoudre({
        nom: fichier.name,
        mimeType: fichier.type,
        contenuBase64: resultat.slice(resultat.indexOf(",") + 1),
      });
    };
    lecteur.onerror = () => rejeter(new Error("Lecture du fichier impossible."));
    lecteur.readAsDataURL(fichier);
  });
