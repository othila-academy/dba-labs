# shellcheck shell=bash
# Lab durcissement : la solution passe ; un clone neuf (clés absentes) se reconstruit ; un rôle trop puissant, un journal
# coupé, un rôle Mongo de trop, un port sur 0.0.0.0 et une section manquante font échouer leur seul check ; serveur hérité
# arrêté : un seul message.
legacy_psql() { PGPASSWORD="$POSTGRES_PASSWORD" psql "host=pg-legacy user=postgres dbname=postgres sslmode=require" -qtAX -c "$1"; }
legacy_mongo() { mongosh --quiet "mongodb://admin:admin-legacy-lab@mongo-legacy:27017/?directConnection=true&authSource=admin" --eval "$1"; }

check "durcissement : tout passe sur la solution" equals "$(failed_ids durcissement)" ""
check "durcissement : clés et certificats écartés par git" equals "$(git -C "$DBA_ROOT" status --porcelain -- project/legacy)" ""

# Un clone neuf : les clés ne sont pas dans git ; scripts/db rebuild les régénère par gen-cert.sh.
rm -f "$DBA_ROOT"/project/legacy/postgres/server.* "$DBA_ROOT"/project/legacy/mongo/server.*
check "clone neuf : scripts/db rebuild régénère les clés" "$DB" rebuild
check "clone neuf : tout passe" equals "$(failed_ids durcissement)" ""

legacy_psql 'alter role app_mediatheque superuser' >/dev/null
check "app_mediatheque superuser → seul app-sans-pouvoirs échoue" equals "$(failed_ids durcissement role-applicatif)" app-sans-pouvoirs
legacy_psql 'alter role app_mediatheque nosuperuser' >/dev/null

legacy_psql 'alter system set log_disconnections = off' >/dev/null
legacy_psql 'select pg_reload_conf()' >/dev/null && sleep 1
check "log_disconnections coupé → seul journal-connexions échoue" equals "$(failed_ids durcissement journalisation)" journal-connexions
legacy_psql 'alter system reset log_disconnections' >/dev/null
legacy_psql 'select pg_reload_conf()' >/dev/null && sleep 1

legacy_mongo 'db.getSiblingDB("mediatheque").grantRolesToUser("app_mediatheque", [{ role: "dbAdmin", db: "mediatheque" }])' >/dev/null
check "un rôle Mongo de trop → seul mongo-utilisateur-applicatif échoue" equals "$(failed_ids durcissement mongo)" mongo-utilisateur-applicatif
legacy_mongo 'db.getSiblingDB("mediatheque").revokeRolesFromUser("app_mediatheque", [{ role: "dbAdmin", db: "mediatheque" }])' >/dev/null

printf 'services:\n  pg-legacy:\n    ports: ["0.0.0.0:25432:5432"]\n' >"$DBA_ROOT/project/legacy/compose.yaml"
check "un port déclaré sur 0.0.0.0 → ports-locaux le nomme" matches "$(failure_of durcissement reseau ports-locaux)" 'pg-legacy sur 0\.0\.0\.0:25432'
git -C "$DBA_ROOT" checkout -- project/legacy/compose.yaml

sed -i 's/^## Surveillance/## Suivi/' "$DBA_ROOT/project/legacy/PLAN-SECURITE.md"
check "une section renommée → plan-securite-sections la nomme" matches "$(failure_of durcissement plan-securite plan-securite-sections)" 'il manque Surveillance'
git -C "$DBA_ROOT" checkout -- project/legacy/PLAN-SECURITE.md

docker stop dba-pg-legacy-1 dba-mongo-legacy-1 >/dev/null
check "serveur hérité arrêté : le même message pour tous les checks qui l'interrogent" equals "$(lab_json durcissement | jq -r '[.results[] | select(.step != "reseau" and .step != "plan-securite") | .failed[].message] | unique | .[]')" "le serveur hérité ne répond pas : legacy est-il dans project/stack.env (COMPOSE_PROFILES=rs,legacy) ? Puis scripts/db rebuild"
"$DB" up >/dev/null
check "durcissement : remis en état" equals "$(failed_ids durcissement)" ""
