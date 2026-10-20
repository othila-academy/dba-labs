# Stratégie de sécurité des bases de la médiathèque

## Menaces

- **Un poste du réseau de la médiathèque** (Wi-Fi public des salles de lecture) qui joint directement les serveurs : avant ce lab, PostgreSQL acceptait n'importe qui sans mot de passe (`trust`), et MongoDB sans identifiants.
- **Une injection SQL dans l'application** : avec un rôle applicatif superuser, elle donnait tout le serveur, jusqu'à la machine (`COPY … TO PROGRAM`).
- **Un mot de passe volé ou deviné** : un hachage md5 se casse vite ; un mot de passe partagé ne dit pas qui l'a utilisé.
- **Une écoute du réseau** : sans chiffrement, mots de passe et données de lecteurs passent en clair.
- **Une erreur humaine** : le script de nettoyage lancé sur la production (lab sauvegarde), la transaction oubliée (lab incident-verrou), une clé privée commitée.

## Mesures techniques

- PostgreSQL : plus aucune règle `trust` ; SCRAM partout (`password_encryption`, mots de passe redonnés) ; connexions réseau chiffrées seulement (`hostssl`, `ssl = on`).
- Rôles au moindre privilège : `app_mediatheque` sans `SUPERUSER`, `CREATEROLE` ni `CREATEDB`, propriétaire de ses seules tables ; à Valmorin, `app_valmorin`, `analyste` (sans les coordonnées) et `dba_valmorin` (lab roles).
- MongoDB : authentification obligatoire ; un administrateur et un utilisateur applicatif limité à `readWrite` sur sa base ; TLS proposé.
- Réseau : aucun port publié ; les serveurs ne sont joignables que depuis le réseau de l'application.
- Garde-fous : `idle_in_transaction_session_timeout` et `lock_timeout` sur le rôle de l'application.
- Reste à faire :
  - TLS obligatoire (`requireTLS`) côté MongoDB, et des certificats signés par une autorité interne plutôt qu'auto-signés ;
  - l'authentification interne du replica set `rs0` (un `keyFile` partagé par ses membres, ou des certificats x.509) : aujourd'hui, ses nœuds se font confiance sans preuve, et `rs0` n'a pas d'utilisateurs ;
  - des sauvegardes chiffrées, et copiées hors du serveur.

## Mesures organisationnelles

- Un compte nominatif par administrateur ; le compte `postgres` et l'administrateur MongoDB ne servent qu'aux interventions, tracées.
- Les mots de passe et les clés ne sont jamais dans git : un coffre (ou les secrets de la plateforme) les fournit, et ils changent au départ d'un prestataire ou d'un agent.
- Une revue des droits par trimestre : qui a quoi, et pourquoi (`\du`, `usersInfo`).
- Les scripts d'exploitation se lancent d'abord sur une copie ; la production demande une seconde personne.

## Sauvegarde et reprise

- RPO visé : 24 h (une sauvegarde par nuit) ; RTO visé : 1 h pour remettre une table, 4 h pour tout le serveur.
- `project/ops/backup.sh` : `pg_dump` au format custom, vérifié par `pg_restore --list` ; `project/ops/backup-mongo.sh` : `mongodump` lu sur un secondaire, vérifié par `mongorestore --dryRun`.
- Une restauration est testée chaque mois, sur une copie, en suivant les runbooks (`project/runbooks/`) ; un test qui échoue est un incident.
- Pour réduire le RPO : l'archivage des journaux (WAL) et la restauration à un instant donné (PITR), côté PostgreSQL.

## Surveillance

- PostgreSQL journalise les connexions, les déconnexions et les requêtes de plus de 500 ms ; `pg_stat_statements` montre les requêtes les plus coûteuses.
- MongoDB : profiler au niveau 1 sur `valmorin`, `mongotop` et `mongostat` lors d'un incident ; `rs.status()` pour la réplication.
- Alertes : connexions refusées en rafale (attaque par mot de passe), session « idle in transaction » de plus d'une minute, membre de rs0 injoignable, sauvegarde de la nuit absente ou en échec.
- Les journaux sont lus chaque semaine par l'administrateur de garde, et conservés trois mois.
