#!/usr/bin/env bash
# Squelette du runbook « l'application attend un verrou ». Copie-le dans project/runbooks/verrou.sh, rends-le exécutable
# (chmod +x project/runbooks/verrou.sh), puis complète les deux requêtes marquées « À COMPLÉTER ».
# Usage : project/runbooks/verrou.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
# shellcheck source=/dev/null
source infra/.env.lab
export PGPASSWORD=$POSTGRES_PASSWORD
sql() { psql -h pg -U postgres -d valmorin -v ON_ERROR_STOP=1 -qX "$@"; }
attentes() { sql -tAc 'select count(*) from pg_stat_activity where cardinality(pg_blocking_pids(pid)) > 0'; }

echo "Sessions bloquées, et qui les bloque :"
# À COMPLÉTER : les sessions qui attendent un verrou, avec la liste de celles qui les bloquent (pg_blocking_pids(pid)).
sql -c "select pid, application_name, state from pg_stat_activity where false"

echo "Sessions qui bloquent sans rien faire (idle in transaction), terminées :"
# L'application réessaie : entre deux essais, personne n'attend. On observe donc 15 s au plus (30 fois 0,5 s).
terminees=0
for _ in $(seq 1 30); do
  # À COMPLÉTER : termine (pg_terminate_backend) les sessions « idle in transaction » qui bloquent quelqu'un, et elles
  # seules ; la requête rend une ligne par session terminée.
  lignes="$(sql -tAc "select pid from pg_stat_activity where false")"
  if [[ -n $lignes ]]; then
    printf '  %s\n' "$lignes"
    terminees=$((terminees + $(wc -l <<<"$lignes")))
  fi
  [[ $terminees -gt 0 && "$(attentes)" -eq 0 ]] && break
  sleep 0.5
done

restantes="$(attentes)"
if [[ $restantes -gt 0 ]]; then
  echo "encore $restantes session(s) bloquée(s) : celle qui bloque travaille (state active) ; à voir avec l'équipe applicative" >&2
  exit 1
fi
if [[ $terminees -eq 0 ]]; then
  echo "aucune session inactive n'a bloqué personne en 15 s"
else
  echo "plus aucune session bloquée ($terminees session(s) terminée(s))"
fi
