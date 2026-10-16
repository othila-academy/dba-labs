#!/usr/bin/env bash
# Tous les tests de l'infrastructure, dans le devcontainer : shellcheck, outillage, interface, puis scénario complet.
set -uo pipefail
DBA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Les tests de l'infrastructure jouent le project/ du starter (tag base) : celui de main porte les solutions des labs.
if [[ -z ${DBA_PROJECT:-} ]]; then
  BASE_COPY="$(mktemp -d)"
  git -C "$DBA_ROOT" archive base project | tar -x -C "$BASE_COPY" || { echo "tag base introuvable" >&2; exit 1; }
  DBA_PROJECT="$BASE_COPY/project"
fi
export DBA_ROOT DBA_PROJECT
# shellcheck source=tests/infra/lib.sh
source "$DBA_ROOT/tests/infra/lib.sh"
trap 'rm -f "$TEST_OUT"; rm -rf "${BASE_COPY:-}"' EXIT

check "shellcheck : scripts et tests" shellcheck -x "$DBA_ROOT/scripts/db" "$DBA_ROOT"/scripts/lib/*.sh "$DBA_ROOT"/tests/infra/*.sh
for file in tools starter cli doctor seed stack legacy; do
  [[ -f "$DBA_ROOT/tests/infra/$file.test.sh" ]] || continue
  printf '\n· %s\n' "$file"
  # shellcheck source=/dev/null
  source "$DBA_ROOT/tests/infra/$file.test.sh"
done
summary
