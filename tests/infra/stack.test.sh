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

# Codespaces : le devcontainer est en mode réseau host, il ne peut pas rejoindre dba-net. scripts/db écrit alors les noms des
# services et leurs adresses dans un fichier hosts (un bloc repéré, réécrit à chaque appel). Essayé ici sur un fichier jetable.
HOSTS_ESSAI="$(mktemp)"
printf '127.0.0.1 localhost\n10.9.9.9 pg # dba-net\n' >"$HOSTS_ESSAI"
check "réseau host : les noms des services pointent vers leurs adresses sur dba-net" bash -c "source '$DBA_ROOT/scripts/lib/common.sh'; source '$DBA_ROOT/scripts/lib/stack.sh'; DBA_HOSTS_FILE='$HOSTS_ESSAI' hosts_fallback >/dev/null && grep -qx \"\$(docker inspect dba-pg-1 --format '{{(index .NetworkSettings.Networks \"dba-net\").IPAddress}}') pg # dba-net\" '$HOSTS_ESSAI'"
check "réseau host : l'ancienne adresse a disparu, le reste du fichier est gardé" bash -c "! grep -q '10.9.9.9' '$HOSTS_ESSAI' && grep -qx '127.0.0.1 localhost' '$HOSTS_ESSAI' && [[ \$(grep -c ' pg # dba-net\$' '$HOSTS_ESSAI') == 1 ]]"
check "réseau host : mongo1 a aussi son adresse" grep -q ' mongo1 # dba-net$' "$HOSTS_ESSAI"
rm -f "$HOSTS_ESSAI"
FIX_INCIDENTS="$DBA_ROOT/tests/infra/fixtures/incidents"
check "incident : joué avec les fonctions et les identifiants de scripts/db" output_matches '14:02 — essai 42' bash -c "DBA_INCIDENTS='$FIX_INCIDENTS' '$DB' incident essai | paste -sd' ' -"
check "incident en échec : code 1" expect_exit 1 env DBA_INCIDENTS="$FIX_INCIDENTS" "$DB" incident panne
check "healthcheck pg sur TCP (pas le socket du serveur d'initialisation)" output_matches '127\.0\.0\.1' docker inspect dba-pg-1 --format '{{json .Config.Healthcheck.Test}}'
check "healthcheck mongo espacé (15 s), rapide au démarrage" equals "$(docker inspect dba-mongo1-1 --format '{{.Config.Healthcheck.Interval}} {{.Config.Healthcheck.StartInterval}}')" "15s 1s"
check "psql : options sans rôle ni base" equals "$("$DB" psql -tAXc 'select 3')" 3
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
check "down : le réseau dba-net est supprimé" expect_exit 1 docker network inspect dba-net
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
check "profil inconnu : la liste des profils connus" output_matches 'profil inconnu : rss \(profils connus : legacy,rs\)' "$DB" up rss
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
check "status : en-tête du tableau en français, sans « <no value> »" bash -c "out=\"\$('$DB' status)\"; grep -q '^service *état *santé' <<<\"\$out\" && ! grep -q 'no value' <<<\"\$out\""

# Lab replica-set : rs0 à trois membres, puis la panne du primaire. up relance le nœud arrêté et attend un primaire, où qu'il
# soit, et trois membres sains ; sans le profil rs, il nomme les membres qui manquent. Un membre ajouté ne vote qu'après sa
# synchronisation initiale (newlyAdded) : sans trois votants, l'arrêt du primaire n'en ferait élire aucun.
rs3() { mongosh --quiet "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0&serverSelectionTimeoutMS=15000" --eval "$1"; }
sains() { rs3 'rs.status().members.filter((m) => m.health === 1 && ["PRIMARY", "SECONDARY"].includes(m.stateStr)).length'; }
rs3 'for (const host of ["mongo2:27017", "mongo3:27017"]) if (!rs.conf().members.some((m) => m.host === host)) rs.add({ host });
  for (let i = 0; i < 240 && rs.status().writableVotingMembersCount < 3; i += 1) sleep(500)' >/dev/null
check "rs0 à trois membres : trois membres sains" equals "$(sains)" 3
docker stop dba-mongo1-1 >/dev/null
check "panne de mongo1 : un autre nœud est élu" equals "$(rs3 'for (let i = 0; i < 60 && !db.hello().primary; i += 1) sleep(500); String(db.hello().primary !== "mongo1:27017" && Boolean(db.hello().primary))')" true
check "après la panne, up relance mongo1, sans erreur" "$DB" up rs
check "après la panne, trois membres sains dès la fin de up" equals "$(sains)" 3
check "après la panne, mongo1 revient secondaire" equals "$(rs3 'rs.status().members.find((m) => m.name === "mongo1:27017").stateStr')" SECONDARY
# La vue du primaire, celle que lisent les applications et les checks, compte aussi : elle peut avoir un battement de cœur de
# retard sur le nœud relancé. Quatre pannes de suite, du primaire du moment.
pannes_ok=0
for _ in 1 2 3 4; do
  primaire="$(rs3 'db.hello().primary')"
  docker stop "dba-${primaire%%:*}-1" >/dev/null
  "$DB" up rs >/dev/null 2>&1 && [[ "$(sains)" == 3 ]] && pannes_ok=$((pannes_ok + 1))
done
check "quatre pannes du primaire de suite : après chaque up, le primaire voit trois membres sains" equals "$pannes_ok" 4
docker stop dba-mongo2-1 dba-mongo3-1 >/dev/null
check "rs0 à trois membres sans le profil rs : up nomme les absents et le profil" output_matches 'mongo2:27017, mongo3:27017 ne répondent pas.*profil rs' "$DB" up
check "rs0 à trois membres sans le profil rs : code 1" expect_exit 1 "$DB" up

# Le lendemain : down le soir, up le matin. rs0 doit avoir son primaire sans rebuild.
check "down puis up : rs0 a un primaire, sans rebuild" bash -c "'$DB' down >/dev/null && '$DB' up >/dev/null && [[ \"\$(mongosh --quiet 'mongodb://mongo1:27017/?replicaSet=rs0&serverSelectionTimeoutMS=10000' --eval 'db.hello().isWritablePrimary')\" == true ]]"
# Codespaces : le hostname n'est pas l'identifiant du conteneur ; celui-ci se lit dans mountinfo.
if in_container; then
  check "identifiant du devcontainer lu sans dépendre du hostname" bash -c "source '$DBA_ROOT/scripts/lib/common.sh'; source '$DBA_ROOT/scripts/lib/stack.sh'; [[ \"\$(self_container_id)\" == \"\$(docker inspect \"\$(hostname)\" --format '{{.Id}}')\" ]]"
fi

# reload : recharger sans redémarrer ; dire quand un paramètre exige un redémarrage.
RELOAD="$(mktemp -d)"
cp -R "$DBA_PROJECT" "$RELOAD/project"
DBA_PROJECT="$RELOAD/project" "$DB" up >/dev/null
started="$(docker inspect dba-pg-1 --format '{{.State.StartedAt}}')"
echo "work_mem = '9MB'" >"$RELOAD/project/config/postgres/conf.d/50-reload.conf"
check "reload pg : nouveau work_mem sans redémarrage" bash -c "DBA_PROJECT='$RELOAD/project' '$DB' reload pg >/dev/null && [[ \"\$(PGPASSWORD='$POSTGRES_PASSWORD' psql -h pg -U postgres -tAXc 'show work_mem')\" == 9MB ]]"
check "reload pg : le serveur n'a pas redémarré" equals "$(docker inspect dba-pg-1 --format '{{.State.StartedAt}}')" "$started"
echo "shared_preload_libraries = 'pg_stat_statements'" >"$RELOAD/project/config/postgres/conf.d/60-preload.conf"
check "reload pg : un paramètre à redémarrage est signalé" output_matches 'shared_preload_libraries.*scripts/db restart pg' env DBA_PROJECT="$RELOAD/project" "$DB" reload pg
check "reload sans service : code 2" expect_exit 2 "$DB" reload
check "reload d'un service non PostgreSQL : message et code 1" output_matches '^erreur : reload ne sait recharger que pg' "$DB" reload mongo1
echo "work_mem = '9XB'" >"$RELOAD/project/config/postgres/conf.d/70-faute.conf"
check "reload pg : une valeur invalide est refusée, avec le fichier et le paramètre" output_matches '70-faute\.conf.*work_mem' env DBA_PROJECT="$RELOAD/project" "$DB" reload pg
check "reload pg : une valeur invalide donne le code 1" expect_exit 1 env DBA_PROJECT="$RELOAD/project" "$DB" reload pg
rm -rf "$RELOAD"
"$DB" restart pg >/dev/null
