# Scénario complet de la stack : à jouer dans le devcontainer, Docker de l'hôte requis.
DB="$DBA_ROOT/scripts/db"
# shellcheck source=/dev/null
source "$DBA_ROOT/infra/.env.lab"

pg_sql() { PGPASSWORD="$POSTGRES_PASSWORD" psql -h pg -U postgres -d "$1" -tAX -c "$2"; }
equals() { [[ "$1" == "$2" ]] || { echo "« $1 », attendu « $2 »"; return 1; }; }
pg_show() { equals "$(pg_sql postgres "show $1")" "$2"; }
no_dba_containers() { [[ -z "$(docker ps -aq --filter label=com.docker.compose.project=dba)" ]]; }
no_dba_volumes() { [[ -z "$(docker volume ls -q --filter name='^dba-')" ]]; }
in_container() { [[ -f /.dockerenv ]]; }
no_bind_mount() { ! docker inspect dba-pg-1 --format '{{range .Mounts}}{{.Type}} {{end}}' | grep -qw bind; }

check "down : part d'une machine propre" "$DB" down
check "up : démarre et attend la santé" "$DB" up
check "psql -h pg répond depuis le devcontainer" equals "$(pg_sql postgres 'select 1')" 1
check "PostgreSQL en version 18" output_matches '^18\.' pg_sql postgres 'show server_version'
check "configuration copiée : shared_buffers = 256MB" pg_show shared_buffers 256MB
check "pg_hba vient de project/ (copie dans dba-config)" pg_show hba_file /etc/dba/project/postgres/pg_hba.conf
check "PGDATA dans le volume nommé" output_matches 'dba-pgdata' docker inspect dba-pg-1 --format '{{range .Mounts}}{{.Name}} {{.Destination}}{{"\n"}}{{end}}'
check "aucun bind mount de project/" no_bind_mount
check "aucun port publié par défaut" equals "$(docker port dba-pg-1)" ""
check "idempotence : up une seconde fois" "$DB" up
check "idempotence : attach deux fois" bash -c "'$DB' attach && '$DB' attach"
if in_container; then
  check "rattachement : détaché du réseau, up le rattache" bash -c "docker network disconnect dba-net \"\$(hostname)\" && '$DB' up && PGPASSWORD='$POSTGRES_PASSWORD' psql -h pg -U postgres -tAc 'select 1'"
fi
check "down : se termine sans erreur" "$DB" down
check "down : plus aucun conteneur du projet" no_dba_containers
check "down : plus aucun volume du projet, dba-config compris" no_dba_volumes
check "down sur une stack arrêtée : code 0" "$DB" down

# rebuild sur un projet de test : une copie de project/ avec deux fichiers SQL et un script Mongo.
SANDBOX="$(mktemp -d)"
cp -R "$DBA_PROJECT" "$SANDBOX/project"
mkdir -p "$SANDBOX/project/schema" "$SANDBOX/project/mongo"
echo 'create database valmorin;' >"$SANDBOX/project/schema/000_database.sql"
echo 'create table essai (id int primary key);' >"$SANDBOX/project/schema/001_essai.sql"
echo 'db.essai.insertOne({ ok: 1 });' >"$SANDBOX/project/mongo/001_essai.js"
mongo_rs() { mongosh --quiet "mongodb://mongo1:27017/valmorin?replicaSet=rs0" --eval "$1"; }

check "rebuild : se termine sans erreur" env DBA_PROJECT="$SANDBOX/project" "$DB" rebuild
check "rebuild : rs0 a un primaire" equals "$(mongosh --quiet 'mongodb://mongo1:27017/?replicaSet=rs0' --eval 'db.hello().isWritablePrimary')" true
check "rebuild : 000 joué sur postgres, 001 sur valmorin" equals "$(pg_sql valmorin "select to_regclass('essai') is not null")" t
check "rebuild : project/mongo joué sur valmorin" equals "$(mongo_rs 'db.essai.countDocuments()')" 1
check "rebuild : une seconde fois, même résultat" bash -c "DBA_PROJECT='$SANDBOX/project' '$DB' rebuild >/dev/null && [[ \"\$(PGPASSWORD='$POSTGRES_PASSWORD' psql -h pg -U postgres -d valmorin -tAXc 'select count(*) from essai')\" == 0 ]]"
echo 'create tabl cassee (id int);' >"$SANDBOX/project/schema/002_cassee.sql"
check "schéma en erreur : rebuild nomme le fichier" output_matches '002_cassee\.sql a échoué' env DBA_PROJECT="$SANDBOX/project" "$DB" rebuild
check "schéma en erreur : code 1" expect_exit 1 env DBA_PROJECT="$SANDBOX/project" "$DB" rebuild
rm -f "$SANDBOX/project/schema/002_cassee.sql"
check "projet vide : rebuild le dit et passe" output_matches 'aucun fichier dans project/schema' "$DB" rebuild
rm -rf "$SANDBOX"

# Un réglage dans project/config/postgres/conf.d/, pris en compte par restart.
SPIKE_CONF="$DBA_PROJECT/config/postgres/conf.d/99-spike.conf"
"$DB" up >/dev/null
echo "work_mem = '7MB'" >"$SPIKE_CONF"
check "restart pg : relit project/config" bash -c "'$DB' restart pg >/dev/null && [[ \"\$(PGPASSWORD='$POSTGRES_PASSWORD' psql -h pg -U postgres -tAXc 'show work_mem')\" == 7MB ]]"
rm -f "$SPIKE_CONF"
check "restart pg : réglage retiré, valeur par défaut" bash -c "'$DB' restart pg >/dev/null && [[ \"\$(PGPASSWORD='$POSTGRES_PASSWORD' psql -h pg -U postgres -tAXc 'show work_mem')\" == 4MB ]]"
check "restart d'un service inconnu : message et code 1" output_matches '^erreur : service inconnu : pgg' "$DB" restart pgg

check "up rs : mongo2 et mongo3 sains" bash -c "'$DB' up rs >/dev/null && [[ \"\$(docker inspect dba-mongo2-1 --format '{{.State.Health.Status}}')\" == healthy && \"\$(docker inspect dba-mongo3-1 --format '{{.State.Health.Status}}')\" == healthy ]]"
check "profil inconnu : la liste des profils connus" output_matches 'profil inconnu : rss \(profils connus : rs\)' "$DB" up rss
check "profil inconnu : code 1" expect_exit 1 "$DB" up rss
check "DBA_PUBLISH_PORTS=1 : pg publié sur 127.0.0.1:15432 seulement" bash -c "DBA_PUBLISH_PORTS=1 '$DB' up >/dev/null && [[ \"\$(docker port dba-pg-1 5432/tcp)\" == 127.0.0.1:15432 ]]"
check "DBA_PUBLISH_PORTS=1 : mongo1 publié sur 127.0.0.1:37017 seulement" equals "$(docker port dba-mongo1-1 27017/tcp)" 127.0.0.1:37017
check "sans DBA_PUBLISH_PORTS : la publication disparaît" bash -c "'$DB' up >/dev/null && [[ -z \"\$(docker port dba-pg-1)\" ]]"

"$DB" up rs >/dev/null
check "status : versions PostgreSQL et MongoDB" output_matches 'PostgreSQL 18\..*' "$DB" status
check "status : rôle de chaque nœud" output_matches 'mongo1:27017 · PRIMARY' "$DB" status
check "psql : une requête passe par le raccourci" equals "$("$DB" psql postgres postgres -tAXc 'select 2')" 2
check "mongosh : le raccourci joint rs0" output_matches '^true$' "$DB" mongosh --eval 'db.hello().isWritablePrimary'
check "mongosh mongo2 : connexion directe à un nœud" output_matches '^(true|false)$' "$DB" mongosh mongo2 --eval 'db.hello().isWritablePrimary'
check "doctor : vert sur cette machine" "$DB" doctor
check "doctor : Docker injoignable, ✗ et code 1" expect_exit 1 env DOCKER_HOST=unix:///nonexistent "$DB" doctor
