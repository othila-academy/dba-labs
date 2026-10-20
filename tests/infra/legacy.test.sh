# Le serveur hérité : faillible par construction, mais jamais joignable depuis le réseau de la salle.
DB="$DBA_ROOT/scripts/db"
equals() { [[ "$1" == "$2" ]] || { echo "« $1 », attendu « $2 »"; return 1; }; }
LEGACY="$(mktemp -d)"
cp -R "$DBA_PROJECT" "$LEGACY/project"
echo 'COMPOSE_PROFILES=legacy' >"$LEGACY/project/stack.env"
run_legacy() { DBA_PROJECT="$LEGACY/project" "$DB" "$@"; }

check "legacy : rebuild avec le profil" run_legacy rebuild
# rebuild enchaîne down puis up : up doit garder l'override, même après le down qui s'en passe.
check "legacy : après rebuild, pg-legacy publié sur 127.0.0.1 seulement" equals "$(docker port dba-pg-legacy-1 5432/tcp)" 127.0.0.1:25432
check "legacy : l'avertissement sur 0.0.0.0" output_matches 'publie .* sur 0\.0\.0\.0:25432 : ramené à 127\.0\.0\.1' run_legacy up
check "legacy : pg-legacy publié sur 127.0.0.1 seulement" equals "$(docker port dba-pg-legacy-1 5432/tcp)" 127.0.0.1:25432
check "legacy : mongo-legacy publié sur 127.0.0.1 seulement" equals "$(docker port dba-mongo-legacy-1 27017/tcp)" 127.0.0.1:27018
check "legacy : trust — l'application se connecte sans mot de passe" equals "$(psql -h pg-legacy -U app_mediatheque -d mediatheque -tAXc 'select 1')" 1
check "legacy : le rôle applicatif est superuser" equals "$(psql -h pg-legacy -U postgres -tAXc "select rolsuper from pg_roles where rolname = 'app_mediatheque'")" t
check "legacy : son mot de passe est en md5" output_matches '^md5' psql -h pg-legacy -U postgres -tAXc "select rolpassword from pg_authid where rolname = 'app_mediatheque'"
check "legacy : ssl désactivé" equals "$(psql -h pg-legacy -U postgres -tAXc 'show ssl')" off
check "legacy : mongo-legacy sans authentification liste ses bases" output_matches 'mediatheque' mongosh --quiet "mongodb://mongo-legacy:27017/?directConnection=true" --eval 'db.adminCommand({ listDatabases: 1 }).databases.map((d) => d.name).join(",")'
check "legacy : la déclaration de l'étudiant reste sur 0.0.0.0 (ce que lira le lab)" output_matches '"host_ip":"0\.0\.0\.0"' bash -c "set -a; source '$DBA_ROOT/infra/images.env'; set +a; cd '$DBA_ROOT/infra' && COMPOSE_PROFILES=legacy docker compose -f compose.yaml -f '$LEGACY/project/legacy/compose.yaml' config --format json | jq -c '.services[\"pg-legacy\"].ports'"

# Forme courte sans IP : publiée sur toutes les interfaces, donc ramenée à 127.0.0.1 elle aussi.
sed -i 's/"0.0.0.0:25432:5432"/"25432:5432"/' "$LEGACY/project/legacy/compose.yaml"
check "legacy : un port sans IP est aussi ramené à 127.0.0.1" bash -c "DBA_PROJECT='$LEGACY/project' '$DB' up >/dev/null && [[ \"\$(docker port dba-pg-legacy-1 5432/tcp)\" == 127.0.0.1:25432 ]]"
check "legacy : reload pg-legacy" run_legacy reload pg-legacy
check "legacy : down retire aussi le serveur hérité" bash -c "DBA_PROJECT='$LEGACY/project' '$DB' down >/dev/null && [[ -z \"\$(docker ps -aq --filter name=dba-pg-legacy)\" ]]"
# I2 : une clé privée doit arriver en 600 (PostgreSQL refuse une clé lisible par d'autres), le certificat reste lisible.
set -a
# shellcheck source=/dev/null
source "$DBA_ROOT/infra/images.env"
set +a
touch "$LEGACY/project/legacy/postgres/server.key" "$LEGACY/project/legacy/postgres/server.crt"
run_legacy up >/dev/null 2>&1
check "legacy : clé privée copiée en 600, propriétaire 999" equals "$(docker run --rm -v dba-config:/cfg --entrypoint stat "$DBA_PG_IMAGE" -c '%a %u' /cfg/legacy/postgres/server.key)" "600 999"
check "legacy : certificat copié en 644" equals "$(docker run --rm -v dba-config:/cfg --entrypoint stat "$DBA_PG_IMAGE" -c '%a %u' /cfg/legacy/postgres/server.crt)" "644 999"
rm -f "$LEGACY/project/legacy/postgres/server.key" "$LEGACY/project/legacy/postgres/server.crt"

# Lab durcissement : les clés ne sont jamais dans git ; scripts/db lance project/legacy/gen-cert.sh, s'il existe, avant de
# démarrer le serveur hérité, et seulement quand le profil legacy est actif.
GEN="$LEGACY/project/legacy/gen-cert.sh"
cat >"$GEN" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
[[ -f postgres/server.key ]] || openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=pg-legacy \
  -keyout postgres/server.key -out postgres/server.crt 2>/dev/null
EOF
chmod +x "$GEN"
check "legacy : up lance gen-cert.sh et le dit" output_matches 'project/legacy/gen-cert\.sh' run_legacy up
check "legacy : la clé générée arrive en 600 dans le serveur" equals "$(docker run --rm -v dba-config:/cfg --entrypoint stat "$DBA_PG_IMAGE" -c '%a %u' /cfg/legacy/postgres/server.key)" "600 999"
printf '#!/usr/bin/env bash\necho "openssl introuvable" >&2\nexit 3\n' >"$GEN"
check "legacy : gen-cert.sh en échec arrête up, et le nomme" output_matches '^erreur : project/legacy/gen-cert\.sh a échoué' run_legacy up
chmod -x "$GEN"
check "legacy : gen-cert.sh non exécutable, le message dit chmod +x" output_matches 'chmod \+x project/legacy/gen-cert\.sh' run_legacy up
chmod +x "$GEN"
echo 'COMPOSE_PROFILES=' >"$LEGACY/project/stack.env"
check "legacy : sans le profil legacy, gen-cert.sh n'est pas lancé" bash -c "! DBA_PROJECT='$LEGACY/project' '$DB' up 2>&1 | grep -q gen-cert"
echo 'COMPOSE_PROFILES=legacy' >"$LEGACY/project/stack.env"
rm -f "$GEN" "$LEGACY/project/legacy/postgres/server.key" "$LEGACY/project/legacy/postgres/server.crt"

# I4 : après un down, up laisse le serveur hérité vide ; il le dit et renvoie au rebuild.
run_legacy down >/dev/null 2>&1
check "legacy : up sur un serveur hérité vide renvoie à scripts/db rebuild" output_matches 'serveur hérité vide.*scripts/db rebuild' run_legacy up
check "README du serveur hérité : démarrer par scripts/db rebuild" grep -q 'scripts/db rebuild' "$DBA_ROOT/project/legacy/README.md"

# I1 : un service sans port déclaré, un port sans port hôte : la stack démarre quand même.
printf 'services:\n  pg-legacy:\n    ports: ["5432"]\n' >"$LEGACY/project/legacy/compose.yaml"
check "legacy : sans port pour mongo-legacy, sans port hôte pour pg-legacy : up démarre" run_legacy up
check "legacy : mongo-legacy ne publie rien" equals "$(docker port dba-mongo-legacy-1)" ""
check "legacy : pg-legacy sur un port éphémère de 127.0.0.1" output_matches '^127\.0\.0\.1:[0-9]+$' docker port dba-pg-legacy-1 5432/tcp
rm -rf "$LEGACY"

# I3 : un serveur hérité durci (scram, authentification Mongo) se reconstruit encore : l'initialisation passe
# par le socket local du conteneur (pg) et par l'exception localhost (mongo).
HARD="$(mktemp -d)"
cp -R "$DBA_PROJECT" "$HARD/project"
echo 'COMPOSE_PROFILES=legacy' >"$HARD/project/stack.env"
printf 'local all postgres peer\nhost all all 0.0.0.0/0 scram-sha-256\nhost all all ::/0 scram-sha-256\n' >"$HARD/project/legacy/postgres/pg_hba.conf"
printf "set password_encryption = 'scram-sha-256';\ncreate role app_mediatheque login password 'durci';\ncreate database mediatheque owner app_mediatheque;\n" >"$HARD/project/legacy/postgres/init.sql"
printf 'security:\n  authorization: enabled\n' >>"$HARD/project/legacy/mongo/mongod.conf"
printf "const admin = db.getSiblingDB('admin');\nadmin.createUser({ user: 'admin', pwd: 'durci', roles: ['root'] });\nadmin.auth('admin', 'durci');\ndb.getSiblingDB('mediatheque').prets.insertOne({ ok: 1 });\n" >"$HARD/project/legacy/mongo/init.js"
check "legacy durci : rebuild va au bout" env DBA_PROJECT="$HARD/project" "$DB" rebuild
check "legacy durci : sans mot de passe, l'application est refusée" expect_exit 2 psql -h pg-legacy -U app_mediatheque -d mediatheque -w -c 'select 1'
check "legacy durci : sans identifiants, mongo-legacy ne liste pas ses bases" bash -c "! mongosh --quiet 'mongodb://mongo-legacy:27017/?directConnection=true' --eval 'db.adminCommand({ listDatabases: 1 })' >/dev/null 2>&1"
rm -rf "$HARD"
"$DB" rebuild >/dev/null
