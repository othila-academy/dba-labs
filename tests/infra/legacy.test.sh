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
rm -rf "$LEGACY"
"$DB" rebuild >/dev/null
