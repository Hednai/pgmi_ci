// ============================================
// lib/password.ts
// Hachage des mots de passe agents.
//
// Le cahier des charges retient argon2id. L'implémentation par défaut utilise
// scrypt (module crypto natif de Node) pour que le projet s'installe sans
// compilation native. Les deux fonctions ci-dessous sont la seule surface
// d'appel du reste du code : passer à argon2 revient à réécrire ce fichier,
// sans toucher aux services ni aux contrôleurs.
//
// Le format stocké porte son algorithme en préfixe (scrypt$sel$hash), donc
// les anciens hachages restent vérifiables après une migration.
// ============================================
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// promisify ne retient que la surcharge à trois arguments : le type est
// redéclaré pour pouvoir passer les paramètres de coût.
const scrypt = promisify(scryptCallback) as (
  motDePasse: string,
  sel: string,
  longueur: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// Paramètres OWASP pour scrypt (N = 2^16, r = 8, p = 1)
const COUT_CPU = 65536;
const TAILLE_BLOC = 8;
const PARALLELISME = 1;
const LONGUEUR_CLE = 64;
const LONGUEUR_SEL = 16;

// Hacher un mot de passe en clair
export const hashPassword = async (motDePasse: string): Promise<string> => {
  const sel = randomBytes(LONGUEUR_SEL).toString("hex");
  const derivee = (await scrypt(motDePasse, sel, LONGUEUR_CLE, {
    N: COUT_CPU,
    r: TAILLE_BLOC,
    p: PARALLELISME,
    // Node refuse N élevé sans relever la limite mémoire
    maxmem: 256 * 1024 * 1024,
  }));

  return `scrypt$${sel}$${derivee.toString("hex")}`;
};

// Vérifier un mot de passe contre un haché stocké.
// La comparaison est à temps constant pour ne pas fuiter d'information.
export const verifyPassword = async (
  motDePasse: string,
  hache: string,
): Promise<boolean> => {
  const parties = hache.split("$");
  if (parties.length !== 3 || parties[0] !== "scrypt") return false;

  const [, sel, attendu] = parties;
  if (!sel || !attendu) return false;

  const derivee = (await scrypt(motDePasse, sel, LONGUEUR_CLE, {
    N: COUT_CPU,
    r: TAILLE_BLOC,
    p: PARALLELISME,
    maxmem: 256 * 1024 * 1024,
  }));

  const tampon = Buffer.from(attendu, "hex");
  if (tampon.length !== derivee.length) return false;

  return timingSafeEqual(tampon, derivee);
};
