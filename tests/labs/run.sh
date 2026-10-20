#!/usr/bin/env bash
# Les tests des labs, dans le devcontainer : définitions et aides (node --test), puis, lab par lab dans l'ordre de la
# chaîne, les checks contre la solution de main et contre des variantes fautives. Chaque fichier met les bases dans l'état qu'il attend.
set -uo pipefail
DBA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export DBA_ROOT
# shellcheck source=tests/infra/lib.sh
source "$DBA_ROOT/tests/infra/lib.sh"
# shellcheck source=tests/labs/lib.sh
source "$DBA_ROOT/tests/labs/lib.sh"
trap 'rm -f "$TEST_OUT"; rm -rf "$LAB_STATE"' EXIT

shopt -s nullglob
scripts=("$DBA_ROOT"/tests/labs/*.sh "$DBA_ROOT"/.othila-lab/incidents/*.sh "$DBA_ROOT"/project/ops/*.sh "$DBA_ROOT"/project/runbooks/*.sh "$DBA_ROOT"/project/legacy/*.sh)
shopt -u nullglob
check "shellcheck : tests des labs, incidents, scripts des solutions" shellcheck -x "${scripts[@]}"
check "bases démarrées" "$DB" up
check "définitions des labs et aides des checks (node --test)" node --test "$DBA_ROOT"/tests/labs/*.test.mjs
check "catalogue lu par lab-cli" bash -c "cd '$DBA_ROOT' && npx --no-install lab catalog --json >/dev/null"
for lab in $(jq -r '.seances[].labs[]' "$DBA_ROOT/.othila-lab/formation.json"); do
  [[ -f "$DBA_ROOT/tests/labs/$lab.test.sh" ]] || continue
  printf '\n· %s\n' "$lab"
  # shellcheck source=/dev/null
  source "$DBA_ROOT/tests/labs/$lab.test.sh"
done
summary
