# shellcheck shell=bash
# Lab demarrage : tout passe sur la solution ; stack arrêtée, un seul message et lab check rend la main.
check "demarrage : rebuild" "$DB" rebuild
check "demarrage : tout passe sur la solution" equals "$(failed_ids demarrage)" ""
"$DB" down >/dev/null 2>&1
DOWN_MESSAGE="$(cd "$DBA_ROOT" && node -e "import('./.othila-lab/shared/db.mjs').then((m) => process.stdout.write(m.DOWN))")"
started=$SECONDS
down_json="$(lab_json demarrage)"
check "stack arrêtée : les checks des bases échouent" equals "$(jq -r '[.results[].failed[].id] | sort | join(" ")' <<<"$down_json")" "base-valmorin pg-repond rs0-primaire"
check "stack arrêtée : un seul message, celui de scripts/db up" equals "$(jq -r '[.results[].failed[].message] | unique | join(" | ")' <<<"$down_json")" "$DOWN_MESSAGE"
check "stack arrêtée : lab check rend la main en moins de 30 s" test $((SECONDS - started)) -lt 30
check "demarrage : rebuild après down" "$DB" rebuild
