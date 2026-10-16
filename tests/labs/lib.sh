# Outils des tests de labs : jouer les checks comme le rejeu (JSON, sans remontée, état local jetable), lire la base.
# shellcheck disable=SC2034  # DB sert aux fichiers <lab>.test.sh, sourcés après celui-ci
DB="$DBA_ROOT/scripts/db"
# shellcheck source=/dev/null
source "$DBA_ROOT/infra/.env.lab"
LAB_STATE="$(mktemp -d)"

# La ligne JSON de lab check ; 120 s au plus : un check qui ne rend pas la main fait échouer le test.
lab_json() {
  (cd "$DBA_ROOT" && OTHILA_LAB_DIR="$LAB_STATE" timeout 120 npx --no-install lab check "$@" --json --no-report </dev/null 2>/dev/null | tail -1)
}
# Les ids des checks en échec, triés ; lab-check-illisible si lab check n'a rien rendu d'exploitable.
failed_ids() {
  local out
  out="$(lab_json "$@")"
  jq -er 'if (.results | length) > 0 then [.results[].failed[].id] | sort | join(" ") else error("aucun résultat") end' <<<"$out" 2>/dev/null \
    || echo lab-check-illisible
}
# Le message d'échec d'un check.
failure_of() { lab_json "$1" "$2" | jq -r --arg id "$3" '.results[].failed[] | select(.id == $id) | .message'; }
pg_sql() { PGPASSWORD="$POSTGRES_PASSWORD" psql -h pg -U postgres -d "$1" -v ON_ERROR_STOP=1 -qtAX -c "$2"; }
equals() { [[ "$1" == "$2" ]] || { echo "« $1 », attendu « $2 »"; return 1; }; }
matches() { grep -Eq -- "$2" <<<"$1" || { printf '« %s »\nmotif attendu : %s\n' "$1" "$2"; return 1; }; }
