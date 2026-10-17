# API PGMI

Express 5, TypeScript, Prisma. Architecture par fonctionnalité : chaque
dossier de `src/features/` porte ses routes, son contrôleur, son service et
ses schémas de validation.

## Organisation

```
src/
├── config/       env validé par Zod, CORS, constantes techniques
├── domain/       statuts, rôles, règles métier R1 à R21
├── lib/          Prisma, journalisation, JWT, QR, mots de passe
├── middleware/   authentification, RBAC, validation, erreurs
├── utils/        erreurs, audit, dates, références, pagination
├── services/     fournisseurs externes (notification, paiement, stockage)
├── features/     une fonctionnalité, un dossier
└── jobs/         scan quotidien d'expiration (module B ARSTM)
```

Le dossier `domain/` est le cœur : il n'importe rien du reste de
l'application. Pour auditer les règles du système, ces trois fichiers
suffisent.

## Principales routes

### Authentification
| Méthode | Route | Accès |
| --- | --- | --- |
| POST | `/api/auth/otp/request` | public, 5 par heure et par numéro |
| POST | `/api/auth/otp/verify` | public |
| POST | `/api/auth/register` | public |
| POST | `/api/auth/agent/login` | public |
| POST | `/api/auth/agent/logout` | agent |
| POST | `/api/auth/refresh` | public |

### Marins
| Méthode | Route | Accès |
| --- | --- | --- |
| GET | `/api/marins/me/synthese` | marin |
| PATCH | `/api/marins/me/preferences` | marin |
| GET | `/api/marins` | agent |
| POST | `/api/marins/:id/activation` | agent DGAM |
| POST | `/api/marins/eleves` | ARSTM scolarité (module C) |
| GET | `/api/marins/validations-attente` | agent DGAM |

### Documents et service en mer
| Méthode | Route | Accès |
| --- | --- | --- |
| POST | `/api/documents/me` | marin actif |
| GET | `/api/documents/me/:id/qr` | marin |
| POST | `/api/documents/:id/verification` | agent DGAM |
| POST | `/api/documents/:id/revocation` | superviseur |
| POST | `/api/sea-service/me` | marin actif |
| POST | `/api/sea-service/:id/verification` | agent DGAM |

### Demandes
| Méthode | Route | Accès |
| --- | --- | --- |
| POST | `/api/demandes/me` | marin actif |
| POST | `/api/demandes/me/:id/paiement` | marin actif |
| POST | `/api/demandes/eleves` | ARSTM scolarité (module D) |
| POST | `/api/demandes/:id/approbation` | agent DGAM |
| POST | `/api/demandes/:id/rejet` | agent DGAM, motif obligatoire |
| POST | `/api/demandes/:id/encaissement` | agent DGAM, guichet |

### Formation ARSTM
| Méthode | Route | Accès |
| --- | --- | --- |
| GET | `/api/formations/synthese` | ARSTM |
| GET | `/api/formations/file-attente` | ARSTM |
| POST | `/api/formations/sessions` | ARSTM formation |
| POST | `/api/formations/sessions/:id/planification` | ARSTM formation |
| POST | `/api/formations/sessions/:id/resultats` | ARSTM formation |
| POST | `/api/formations/me` | marin |
| POST | `/api/formations/me/:id/reponse` | marin |

### Public et supervision
| Méthode | Route | Accès |
| --- | --- | --- |
| GET | `/v/:code` | public, page HTML statique |
| GET | `/api/verification/:code` | public |
| GET | `/api/referentiels` | public |
| GET | `/api/conformite/me` | marin |
| GET | `/api/dashboard` | agent |
| GET | `/api/audit` | superviseur, lecture seule |

## Règles appliquées côté serveur

Toutes les règles sont refusées côté serveur, pas seulement masquées dans
l'interface. Les principales et leur point d'application :

| Règle | Application |
| --- | --- |
| R1, activation en personne | `requireActiveMarin`, `activerMarin` |
| R2, document approuvé immuable | `IMMUTABLE_DOCUMENT_STATUSES` |
| R3, matricule unique et définitif | `attribuerMatricule` |
| R4, seuls les jours vérifiés comptent | `verifierEmbarquement`, moteur de conformité |
| R5, audit immuable | `logAction`, aucune route d'écriture |
| R6, celui qui soumet ne décide pas | `approuverDemande`, `assignerDemande` |
| R8, paiement avant instruction | `confirmerPaiementDemande` |
| R9, rejet motivé | `rejeterDemande` |
| R10, nom masqué sur le QR | `masquerNom` |
| R12, le renouvellement remplace | `delivrerDocumentOfficiel` |
| R13, la conformité informe | `compliance.service` |
| R15, quorum de session | `planifierSession` |
| R17, SMS non désactivables | `majPreferences`, `notifierMarin` |
| R19, inscription ARSTM en personne | `inscrireEleveNavigant` |
| R20, matricule validé par la DGAM | `PENDING_DGAM_VALIDATION` |
| R21, l'ARSTM ne décide jamais | `approuverDemande`, `rejeterDemande` |

## Sécurité

Helmet, CORS restreint, rate limiting (par numéro sur l'OTP, par IP ailleurs),
validation Zod sur toutes les entrées, nettoyage XSS du corps des requêtes,
jetons courts avec révocation serveur, secrets d'au moins 32 caractères
contrôlés au démarrage, journalisation avec masquage des secrets et des codes.
