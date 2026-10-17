// ============================================
// scripts/manuel-habilitations.ts
// Génère le manuel des habilitations (remarque PGMI-09) à partir de la
// matrice qui s'exécute réellement.
//
// Le manuel n'est jamais écrit à la main : il est produit depuis
// domain/permissions.ts, donc il ne peut pas diverger du comportement du
// serveur. Toute modification de la matrice se répercute à la génération
// suivante, et la chaîne d'intégration échoue si le fichier publié n'est
// plus à jour.
// ============================================
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  PERMISSION,
  PERMISSIONS_PAR_ROLE,
  PORTEE_PAR_ROLE,
  ALL_PERMISSIONS,
} from "../src/domain/permissions.js";
import { AGENT_ROLE_LABELS, ALL_AGENT_ROLES } from "../src/domain/roles.js";
import type { AgentRole } from "../src/domain/roles.js";
import type { Permission } from "../src/domain/permissions.js";

// Libellé métier de chaque permission, dans le vocabulaire du cahier des
// charges. C'est la seule donnée que le script ne déduit pas du code : une
// permission dit ce qu'un agent fait, pas comment le code la nomme.
const LIBELLE_PERMISSION: Record<Permission, string> = {
  [PERMISSION.MARIN_CONSULTER]: "Consulter un dossier marin",
  [PERMISSION.MARIN_RECHERCHER]: "Rechercher dans le registre national",
  [PERMISSION.MARIN_ACTIVER]: "Activer un dossier après vérification d'identité",
  [PERMISSION.MARIN_SUSPENDRE]: "Suspendre un dossier marin",
  [PERMISSION.ELEVE_INSCRIRE]: "Inscrire un élève navigant",
  [PERMISSION.DEMANDE_INSTRUIRE]: "Instruire une demande",
  [PERMISSION.DEMANDE_DECIDER]: "Approuver ou rejeter une demande",
  [PERMISSION.DOCUMENT_VERIFIER]: "Vérifier un document déposé",
  [PERMISSION.EMBARQUEMENT_VERIFIER]: "Vérifier un embarquement déclaré",
  [PERMISSION.FORMATION_PLANIFIER]: "Planifier une session de formation",
  [PERMISSION.FORMATION_EMARGER]: "Émarger une session de formation",
  [PERMISSION.REFERENTIEL_GERER]: "Gérer les référentiels",
  [PERMISSION.AGENT_GERER]: "Gérer les comptes agents",
  [PERMISSION.AUDIT_CONSULTER]: "Consulter le journal d'audit",
  [PERMISSION.TABLEAU_BORD_NATIONAL]: "Consulter le tableau de bord national",
};

// Explication de la portée, pour un lecteur qui n'est pas développeur
const LIBELLE_PORTEE: Record<string, string> = {
  NATIONAL: "Ensemble du registre national",
  AUTORITE: "Dossiers rattachés à son autorité uniquement",
};

// Une ligne par permission, une colonne par rôle, une croix à l'intersection
const construireTableau = (): string => {
  const entete = ["Permission", ...ALL_AGENT_ROLES.map((role) => AGENT_ROLE_LABELS[role])];
  const lignes = [
    `| ${entete.join(" | ")} |`,
    `|${entete.map(() => "---").join("|")}|`,
  ];

  for (const permission of ALL_PERMISSIONS) {
    const cellules = ALL_AGENT_ROLES.map((role: AgentRole) =>
      PERMISSIONS_PAR_ROLE[role].includes(permission) ? "X" : "",
    );
    lignes.push(`| ${LIBELLE_PERMISSION[permission]} | ${cellules.join(" | ")} |`);
  }

  return lignes.join("\n");
};

// Portée des données, qui se lit séparément de la liste des permissions :
// deux rôles peuvent partager une permission sans voir les mêmes dossiers.
const construirePortees = (): string => {
  const lignes = ["| Rôle | Portée des données |", "|---|---|"];
  for (const role of ALL_AGENT_ROLES) {
    lignes.push(`| ${AGENT_ROLE_LABELS[role]} | ${LIBELLE_PORTEE[PORTEE_PAR_ROLE[role]]} |`);
  }
  return lignes.join("\n");
};

const construireDocument = (): string =>
  [
    "# PGMI, manuel des habilitations",
    "",
    "Direction Générale des Affaires Maritimes de Côte d'Ivoire.",
    "",
    "> Document généré automatiquement depuis `backend/src/domain/permissions.ts`.",
    "> Ne pas le modifier à la main : toute retouche serait perdue à la prochaine",
    "> génération, et le manuel cesserait de décrire le comportement réel du serveur.",
    "",
    "## Qui peut faire quoi",
    "",
    "Une croix signifie que le rôle détient la permission. Le serveur refuse",
    "toute action dont la permission n'est pas détenue, y compris si l'écran",
    "a été atteint par une URL saisie à la main.",
    "",
    construireTableau(),
    "",
    "## Portée des données",
    "",
    "La permission dit ce qu'un agent peut faire, la portée dit sur quels",
    "dossiers il peut le faire.",
    "",
    construirePortees(),
    "",
  ].join("\n");

const destination = join(process.cwd(), "..", "MANUEL_HABILITATIONS.md");

await writeFile(destination, construireDocument(), "utf-8");
console.log(`Manuel des habilitations écrit dans ${destination}`);