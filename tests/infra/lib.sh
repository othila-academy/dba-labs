# Mini-cadre de test des scripts du cours : check <libellé> <commande…>, puis summary en fin de fichier.
TESTS_PASSED=${TESTS_PASSED:-0}
TESTS_FAILED=${TESTS_FAILED:-0}
TEST_OUT="$(mktemp)"
trap 'rm -f "$TEST_OUT"' EXIT

check() {
  local label=$1
  shift
  if "$@" >"$TEST_OUT" 2>&1; then
    printf '✓ %s\n' "$label"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    printf '✗ %s\n' "$label"
    sed 's/^/    /' "$TEST_OUT"
    TESTS_FAILED=$((TESTS_FAILED + 1))
  fi
}

# expect_exit <code> <commande…> : la commande sort avec ce code.
expect_exit() {
  local want=$1 got=0
  shift
  "$@" || got=$?
  [[ $got -eq $want ]] || { echo "code $got, attendu $want"; return 1; }
}

# output_matches <regex> <commande…> : la sortie (stdout et stderr) contient le motif, quel que soit le code.
output_matches() {
  local re=$1 out
  shift
  out="$("$@" 2>&1)" || true
  grep -Eq -- "$re" <<<"$out" || { printf 'sortie :\n%s\nmotif attendu : %s\n' "$out" "$re"; return 1; }
}

summary() {
  printf '\n%d passé(s), %d en échec\n' "$TESTS_PASSED" "$TESTS_FAILED"
  [[ $TESTS_FAILED -eq 0 ]]
}
