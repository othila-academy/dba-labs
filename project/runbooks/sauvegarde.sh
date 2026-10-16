#!/usr/bin/env bash
# Runbook « table emprunt supprimée » : restaurer emprunt seule (table, données, séquence, contraintes, clés étrangères,
# index, droits) depuis la dernière sauvegarde, sans toucher au reste : les adhérents inscrits depuis restent là.
# Usage : project/runbooks/sauvegarde.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=/dev/null
source infra/.env.lab
export PGPASSWORD=$POSTGRES_PASSWORD
# shellcheck disable=SC2012 # noms horodatés, sans espace : ls -t suffit pour trouver le plus récent
dump="$(ls -t backups/valmorin-*.dump 2>/dev/null | head -1)"
[[ -n $dump ]] || { echo "aucune sauvegarde dans backups/ : rien à restaurer" >&2; exit 1; }
list="$(mktemp)"
trap 'rm -f "$list"' EXIT
# Tout ce qui appartient à emprunt dans le dump, et rien d'autre.
pg_restore --list "$dump" | grep emprunt >"$list"
pg_restore -h pg -U postgres -d valmorin --exit-on-error -L "$list" "$dump"
psql -h pg -U postgres -d valmorin -qXc 'analyze emprunt'
echo "emprunt restaurée depuis $dump"
