# Le serveur hérité

L'ancien prestataire a laissé deux serveurs à la médiathèque : `pg-legacy` (PostgreSQL) et `mongo-legacy` (MongoDB). Ils tournent toujours, avec leur configuration d'origine, celle de ce dossier. Tu les démarres en ajoutant `legacy` à `project/stack.env` (`COMPOSE_PROFILES=legacy`, ou `rs,legacy`), puis `scripts/db rebuild` : c'est lui qui recrée leur état d'origine (`up` seul les démarre vides).

Ce que tu sais de leur configuration :

- `postgres/postgresql.conf` et `postgres/pg_hba.conf` : la configuration du serveur PostgreSQL ;
- `postgres/init.sql` : ce que l'ancien prestataire a créé au démarrage (rôles, base) ;
- `mongo/mongod.conf` et `mongo/init.js` : le serveur MongoDB et ses données ;
- `compose.yaml` : les ports que ces serveurs publient sur la machine.

Le lab `durcissement` te demande de les sécuriser **ici**, dans ces fichiers.

Les clés privées ne vont jamais dans git. Si `project/legacy/gen-cert.sh` existe, `scripts/db` le lance avant chaque démarrage du serveur hérité (`up`, `restart`, `rebuild`) : il doit générer les certificats et les clés qui manquent, et ne rien faire s'ils sont là. Un clone neuf se reconstruit ainsi sans étape de plus.

Par sécurité, `scripts/db` ne publie jamais un port sur `0.0.0.0`, quoi que déclare `compose.yaml` : il le ramène à `127.0.0.1` et le dit. Un serveur aussi ouvert que celui-ci ne doit pas être joignable depuis le réseau de la salle.
