# PGMI, manuel des habilitations

Direction Générale des Affaires Maritimes de Côte d'Ivoire.

> Document généré automatiquement depuis `backend/src/domain/permissions.ts`.
> Ne pas le modifier à la main : toute retouche serait perdue à la prochaine
> génération, et le manuel cesserait de décrire le comportement réel du serveur.

## Qui peut faire quoi

Une croix signifie que le rôle détient la permission. Le serveur refuse
toute action dont la permission n'est pas détenue, y compris si l'écran
a été atteint par une URL saisie à la main.

| Permission | Agent DGAM | Superviseur DGAM | Administrateur plateforme | Administrateur métier | ARSTM, Formation | ARSTM, Scolarité | ARSTM, Responsable |
|---|---|---|---|---|---|---|---|
| Consulter un dossier marin | X | X | X |  |  | X | X |
| Rechercher dans le registre national | X | X | X |  |  |  |  |
| Activer un dossier après vérification d'identité | X | X |  |  |  |  |  |
| Suspendre un dossier marin |  | X | X |  |  |  |  |
| Inscrire un élève navigant |  |  |  |  |  | X | X |
| Instruire une demande | X | X |  |  |  |  |  |
| Approuver ou rejeter une demande | X | X |  |  |  |  |  |
| Vérifier un document déposé | X | X |  |  |  |  |  |
| Vérifier un embarquement déclaré | X | X |  |  |  |  |  |
| Planifier une session de formation |  |  |  |  | X |  | X |
| Émarger une session de formation |  |  |  |  | X |  | X |
| Gérer les référentiels |  |  | X | X |  |  |  |
| Gérer les comptes agents |  |  | X |  |  |  |  |
| Consulter le journal d'audit |  | X | X |  |  |  |  |
| Consulter le tableau de bord national |  | X | X |  |  |  |  |

## Portée des données

La permission dit ce qu'un agent peut faire, la portée dit sur quels
dossiers il peut le faire.

| Rôle | Portée des données |
|---|---|
| Agent DGAM | Ensemble du registre national |
| Superviseur DGAM | Ensemble du registre national |
| Administrateur plateforme | Ensemble du registre national |
| Administrateur métier | Dossiers rattachés à son autorité uniquement |
| ARSTM, Formation | Dossiers rattachés à son autorité uniquement |
| ARSTM, Scolarité | Dossiers rattachés à son autorité uniquement |
| ARSTM, Responsable | Dossiers rattachés à son autorité uniquement |
