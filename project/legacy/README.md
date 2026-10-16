# Le serveur hérité

L'ancien prestataire a laissé deux serveurs à la médiathèque : `pg-legacy` (PostgreSQL) et `mongo-legacy` (MongoDB). Ils tournent toujours, avec leur configuration d'origine, celle de ce dossier. Tu les démarres en ajoutant `legacy` à `project/stack.env` (`COMPOSE_PROFILES=legacy`, ou `rs,legacy`), puis `scripts/db up`.

Ce que tu sais de leur configuration :

- `postgres/postgresql.conf` et `postgres/pg_hba.conf` : la configuration du serveur PostgreSQL ;
- `postgres/init.sql` : ce que l'ancien prestataire a créé au démarrage (rôles, base) ;
- `mongo/mongod.conf` et `mongo/init.js` : le serveur MongoDB et ses données ;
- `compose.yaml` : les ports que ces serveurs publient sur la machine.

Le lab `durcissement` te demande de les sécuriser **ici**, dans ces fichiers.

Par sécurité, `scripts/db` ne publie jamais un port sur `0.0.0.0`, quoi que déclare `compose.yaml` : il le ramène à `127.0.0.1` et le dit. Un serveur aussi ouvert que celui-ci ne doit pas être joignable depuis le réseau de la salle.
