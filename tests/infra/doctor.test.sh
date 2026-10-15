# doctor : ses verdicts et ses conseils, sur cette machine et sur des cas construits.
DB="$DBA_ROOT/scripts/db"
# shellcheck source=/dev/null
source "$DBA_ROOT/scripts/lib/common.sh"
# shellcheck source=/dev/null
source "$DBA_ROOT/scripts/lib/doctor.sh"

check "noyau 7.0.12 : dans la plage à risque de MongoDB 8" kernel_in_mongo_risk 7.0.12-linuxkit
check "noyau 6.19.0 (WSL2) : dans la plage à risque" kernel_in_mongo_risk 6.19.0-microsoft-standard-WSL2
check "noyau 7.0.14 : hors de la plage" expect_exit 1 kernel_in_mongo_risk 7.0.14-linuxkit
check "noyau 6.18.7 : hors de la plage" expect_exit 1 kernel_in_mongo_risk 6.18.7
check "noyau 6.8 (Codespaces, CI) : hors de la plage" expect_exit 1 kernel_in_mongo_risk 6.8.0-1030-azure
check "conseil mémoire : macOS et Windows (WSL2) à la fois" bash -c "out=\"\$(source '$DBA_ROOT/scripts/lib/doctor.sh'; memory_advice)\"; grep -q 'Resources' <<<\"\$out\" && grep -q '.wslconfig' <<<\"\$out\""
check "doctor : signale le noyau de cette machine s'il est à risque" bash -c "k=\"\$(docker info --format '{{.KernelVersion}}')\"; source '$DBA_ROOT/scripts/lib/common.sh'; source '$DBA_ROOT/scripts/lib/doctor.sh'; if kernel_in_mongo_risk \"\$k\"; then '$DB' doctor | grep -q 'SERVER-121912'; else ! '$DB' doctor | grep -q 'SERVER-121912'; fi"

# Une image introuvable (hors ligne, proxy, limite de Docker Hub) : un ✗ lisible, jamais une trace Bash.
DOCTOR_COPY="$(mktemp -d)"
cp -R "$DBA_ROOT/scripts" "$DBA_ROOT/infra" "$DOCTOR_COPY/"
sed -i 's|^DBA_PG_IMAGE=.*|DBA_PG_IMAGE=dba-labs-test/absente:0|' "$DOCTOR_COPY/infra/images.env"
check "image absente : ✗ « image absente », code 1" bash -c "out=\"\$('$DOCTOR_COPY/scripts/db' doctor 2>&1)\"; code=\$?; [[ \$code -eq 1 ]] && grep -q '✗ image absente : dba-labs-test/absente' <<<\"\$out\""
check "image absente : aucune trace Bash" bash -c "! '$DOCTOR_COPY/scripts/db' doctor 2>&1 | grep -qE 'line [0-9]+:|syntax error'"
check "image absente : rien n'est téléchargé" bash -c "'$DOCTOR_COPY/scripts/db' doctor >/dev/null 2>&1; ! docker image inspect dba-labs-test/absente:0 >/dev/null 2>&1"
rm -rf "$DOCTOR_COPY"
