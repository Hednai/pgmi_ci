# PGMI, Plateforme de Gestion des Marins Ivoiriens

Dossier maritime numérique des gens de mer de Côte d'Ivoire, pour la
Direction Générale des Affaires Maritimes et Portuaires (DGAM), avec le
module de partenariat ARSTM intégré.

## Structure du dépôt

Deux applications indépendantes, pas de monorepo : chacune s'installe et se
lance seule, ce qui simplifie le déploiement (le backend sur Render, le
frontend sur Vercel ou Netlify) et évite un outillage supplémentaire.

```
pgmi/
├── backend/     API Express 5 + Prisma + PostgreSQL/SQLite
└── frontend/    Client React 19 + TypeScript + Vite (PWA)
```

## Démarrage

Deux terminaux, une commande d'installation chacun.

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run setup        # génère le client Prisma, crée la base, insère les données
npm run dev          # http://localhost:4000
```

`npm run setup` enchaîne `prisma generate`, `prisma db push` et le seed.
La base par défaut est un fichier SQLite (`prisma/dev.db`) : aucune
installation de serveur de base de données n'est nécessaire pour démarrer.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

Le proxy Vite renvoie `/api` vers `http://localhost:4000` : il n'y a rien à
configurer de plus en développement.

## Comptes de démonstration

Mot de passe commun : `Pgmi2026!`

| Rôle | Identifiant |
| --- | --- |
| Agent DGAM | `m.kone@dgam.ci` |
| Superviseur DGAM | `superviseur@dgam.ci` |
| Administrateur plateforme | `admin@dgam.ci` |
| Administrateur métier | `referentiels@dgam.ci` |
| ARSTM, formation | `formation@arstm.ci` |
| ARSTM, scolarité | `scolarite@arstm.ci` |
| ARSTM, direction | `direction@arstm.ci` |

Côté marin, la connexion se fait par SMS. En développement, le code OTP est
renvoyé directement dans la réponse de l'API et s'affiche à l'écran.

Numéro de démonstration : `+2250701020304` (Kouassi Yao Jean,
matricule `CI-MAR-2024-0847`).

## Parcours à dérouler pour une démonstration

1. **Marin** : se connecter, consulter le dossier, ouvrir le QR code d'un
   certificat, déclarer un embarquement, soumettre une demande et la payer.
2. **Vérification publique** : ouvrir `http://localhost:4000/v/<code>` avec
   le code affiché sous le QR. La page se charge sans framework.
3. **Agent DGAM** : instruire la demande, vérifier un document, activer un
   dossier marin en attente.
4. **ARSTM** : consulter la file d'attente par module, ouvrir une session,
   constater le refus de programmation sous le quorum, inscrire un élève
   navigant.

## Passer en PostgreSQL

Une seule ligne change dans `backend/prisma/schema.prisma` :

```prisma
datasource db {
  provider = "postgresql"   // au lieu de "sqlite"
  url      = env("DATABASE_URL")
}
```

Puis `DATABASE_URL` dans `.env`, et `npm run setup`. Aucun champ du schéma
n'est spécifique à SQLite : les statuts sont des chaînes validées par
`src/domain/status.ts`, ce qui garde le modèle portable et les référentiels
administrables sans migration.

## Choix d'implémentation à connaître

**Hachage des mots de passe.** Le cahier des charges retient argon2id.
L'implémentation livrée utilise scrypt (module `node:crypto`) pour éviter une
compilation native à l'installation. Tout est isolé dans `src/lib/password.ts`
et le format stocké porte son algorithme en préfixe : passer à argon2 revient
à réécrire ce seul fichier, les anciens hachages restant vérifiables.

**Fournisseurs externes.** SMS, WhatsApp, email, paiement et stockage passent
par des interfaces (`NotificationProvider`, `PaymentProvider`,
`StorageProvider`). Les implémentations livrées écrivent dans le journal et
confirment en bac à sable, ce qui permet de dérouler tout le parcours sans
compte Africa's Talking ni CinetPay. Brancher un opérateur réel consiste à
ajouter une classe, sans toucher au métier.

**Page de vérification QR.** Servie en HTML statique par le backend sur
`/v/:code`, sans framework ni police distante, pour tenir la contrainte
d'ouverture sous une seconde en 2G. L'écran React `/verification` couvre le
cas de la saisie manuelle d'un code illisible.

**Planificateur.** Le scan quotidien d'expiration tourne dans le processus du
serveur (`src/jobs/scheduler.ts`). Sur un hébergement qui met le service en
veille, il faut le remplacer par un ordonnanceur externe appelant
`executerScanExpiration()`.

## Tests

```bash
cd backend && npm test
```

Les tests couvrent les invariants qui ne dépendent pas de la base : matrice
de transitions du workflow, séparation DGAM et ARSTM, immuabilité des
documents traités, paliers de relance, masquage du nom sur la page publique,
calcul du service en mer, hachage des mots de passe.

## Documentation complémentaire

- `backend/README.md` : cartographie de l'API et des règles métier.
- `CONFORMITE.md` : correspondance entre le cahier des charges, le dossier
  ARSTM et le code livré.
