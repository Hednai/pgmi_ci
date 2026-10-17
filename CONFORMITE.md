# Correspondance cahier des charges et code livré

## Exigences fonctionnelles

| Exigence | État | Où |
| --- | --- | --- |
| EF-001 Inscription du marin | Livré | `features/auth`, `ConnexionPage`, `InscriptionPage` |
| EF-002 Authentification OTP | Livré | `auth.service`, `OtpInput` |
| EF-003 Dossier professionnel | Livré | `features/marins`, `AccueilPage`, `ProfilPage` |
| EF-004 Dépôt de documents | Livré | `features/documents`, `DocumentsPage` |
| EF-005 Vérification par un agent | Livré | `verifierDocument`, `VerificationsAgentPage` |
| EF-006 QR code vérifiable | Livré | `lib/qrcode`, `public/verify.html` |
| EF-007 Sea Service Record | Livré | `features/embarkations`, `ServiceMerPage` |
| EF-008 Demandes de renouvellement | Livré | `features/requests`, `NouvelleDemandePage` |
| EF-009 Paiement Mobile Money | Livré en bac à sable | `services/payment`, `PaiementPage` |
| EF-010 Workflow d'instruction | Livré | `REQUEST_TRANSITIONS`, `DemandesAgentPage` |
| EF-011 Délivrance numérique | Livré | `delivrerDocumentOfficiel` |
| EF-012 Notifications multicanal | Livré en mode console | `services/notification` |
| EF-013 Moteur de conformité | Livré | `features/compliance`, `ConformitePage` |
| EF-014 Journal d'audit | Livré | `utils/auditLog`, `JournalPage` |
| EF-015 Référentiels administrables | Livré | `features/referentials`, `ReferentielsPage` |

## Exigences non fonctionnelles

| Exigence | État | Remarque |
| --- | --- | --- |
| ENF-001 Mobile-first, PWA | Livré | manifeste portrait, navigation basse |
| ENF-002 Jetons 15 min et 7 jours | Livré | `domain/rules` |
| ENF-003 Validation et nettoyage | Livré | Zod sur toutes les entrées, `xssClean` |
| ENF-005 Rate limiting | Livré | par numéro sur l'OTP |
| ENF-007 RBAC | Livré | `middleware/rbac`, rôles dans `domain/roles` |
| ENF-008 Vérification QR sous 1 s en 2G | Livré | page HTML statique, un seul appel |
| ENF-009 Compression des pièces | Partiel | contrôle de taille serveur ; compression client à ajouter |
| ENF-012 Cibles tactiles 44 px | Livré | règle de base dans `index.css` |
| ENF-015 Multi-pays préparé | Livré | hiérarchie `Authority`, `authorityId` partout |
| Hachage argon2id | Écart assumé | scrypt isolé dans `lib/password.ts`, voir README |
| Redis, cache distribué | Non livré | cache HTTP sur les référentiels à la place |

## Dossier ARSTM

| Module | État | Où |
| --- | --- | --- |
| Rôles et rattachement ARSTM | Livré | `AUTHORITY_LEVEL.TRAINING_INSTITUTION`, 3 rôles ARSTM |
| Module A, sessions à quorum | Livré | `planifierSession` refuse sous le seuil (R15) |
| Module B, programmation proactive | Livré | `jobs/expiryScan.job`, paliers J-365 à J-30 |
| Module C, inscription des élèves | Livré | `inscrireEleveNavigant`, validation DGAM (R20) |
| Module D, demande de livret | Livré | `soumettreDemandePourEleve` (R21) |
| R15 à R21 | Livré | voir tableau des règles dans `backend/README.md` |

## Reste à faire avant mise en production

1. Brancher les fournisseurs réels : Africa's Talking, WhatsApp Business,
   Resend, CinetPay, Supabase Storage. Les interfaces sont en place, il
   s'agit d'ajouter une implémentation par fournisseur.
2. Basculer le hachage sur argon2id si la contrainte de compilation native
   est acceptable sur l'hébergement retenu.
3. Compression des images côté client avant envoi (ENF-009).
4. Remplacer le planificateur interne par un ordonnanceur externe si
   l'hébergement met le service en veille.
5. Ajouter des tests d'intégration sur la base : le socle Supertest est prêt,
   les tests actuels couvrent les invariants hors base.
6. Générer les migrations Prisma (`prisma migrate dev`) plutôt que `db push`
   dès que le schéma se stabilise.
