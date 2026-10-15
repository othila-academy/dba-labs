#!/usr/bin/env bash
# Tous les tests de l'infrastructure, dans le devcontainer : shellcheck, outillage, interface, puis scénario complet.
set -uo pipefail
DBA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DBA_PROJECT="${DBA_PROJECT:-$DBA_ROOT/project}"
export DBA_ROOT DBA_PROJECT
# shellcheck source=tests/infra/lib.sh
source "$DBA_ROOT/tests/infra/lib.sh"

check "shellcheck : scripts et tests" shellcheck -x "$DBA_ROOT/scripts/db" "$DBA_ROOT"/scripts/lib/*.sh "$DBA_ROOT"/tests/infra/*.sh
for file in tools cli doctor seed stack; do
  [[ -f "$DBA_ROOT/tests/infra/$file.test.sh" ]] || continue
  printf '\n· %s\n' "$file"
  # shellcheck source=/dev/null
  source "$DBA_ROOT/tests/infra/$file.test.sh"
done
summary
