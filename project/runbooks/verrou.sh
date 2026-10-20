#!/usr/bin/env bash
# Runbook « l'application attend un verrou » : montrer qui attend qui, terminer les sessions « idle in transaction » qui
# bloquent quelqu'un, et elles seules, puis vérifier qu'il n'y a plus d'attente.
# Usage : project/runbooks/verrou.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=/dev/null
source infra/.env.lab
export PGPASSWORD=$POSTGRES_PASSWORD
sql() { psql -h pg -U postgres -d valmorin -v ON_ERROR_STOP=1 -qX "$@"; }

echo "Sessions bloquées, et qui les bloque :"
sql -c "select pid, usename, application_name, wait_event_type, pg_blocking_pids(pid) as bloquee_par, left(query, 60) as requete
        from pg_stat_activity where cardinality(pg_blocking_pids(pid)) > 0"
echo "Sessions qui bloquent sans rien faire (idle in transaction), terminées :"
sql -c "select pid, usename, application_name, now() - xact_start as transaction_ouverte_depuis, pg_terminate_backend(pid, 5000) as terminee
        from pg_stat_activity
        where state = 'idle in transaction'
          and pid in (select unnest(pg_blocking_pids(pid)) from pg_stat_activity)"
restantes="$(sql -tAc 'select count(*) from pg_stat_activity where cardinality(pg_blocking_pids(pid)) > 0')"
if [[ $restantes -gt 0 ]]; then
  echo "encore $restantes session(s) bloquée(s) : celle qui bloque travaille (state active) ; à voir avec l'équipe applicative" >&2
  exit 1
fi
echo "plus aucune session bloquée"
