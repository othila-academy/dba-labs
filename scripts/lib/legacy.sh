# Le serveur hérité : ses ports déclarés dans project/legacy/compose.yaml sont publiés, mais jamais au-delà
# de 127.0.0.1 ; son état d'origine est recréé par rebuild.

DBA_RUNTIME="${DBA_RUNTIME:-${XDG_RUNTIME_DIR:-/tmp}/dba-labs}"

legacy_active() { [[ ",${COMPOSE_PROFILES:-}," == *",legacy,"* ]]; }

# Écrit l'override qui remplace les ports déclarés par les mêmes ports sur 127.0.0.1, et prévient pour chacun.
legacy_ports_override() {
  local declared out="$DBA_RUNTIME/legacy-ports.yaml" service
  mkdir -p "$DBA_RUNTIME"
  declared="$(docker compose --project-directory "$DBA_ROOT/infra" -f "$DBA_ROOT/infra/compose.yaml" \
    -f "$DBA_PROJECT/legacy/compose.yaml" config --format json)" \
    || die "project/legacy/compose.yaml est illisible : vérifie sa syntaxe YAML"
  printf 'services:\n' >"$out"
  for service in pg-legacy mongo-legacy; do
    jq -r --arg s "$service" '.services[$s].ports // [] | .[] | select((.host_ip // "0.0.0.0") != "127.0.0.1") |
      "\($s) sur \(.host_ip // "toutes les interfaces"):\(.published)"' <<<"$declared" \
      | while IFS= read -r line; do
          warn "project/legacy/compose.yaml publie $line : ramené à 127.0.0.1 (un serveur aussi ouvert ne sort jamais de ce poste)"
        done
    printf '  %s:\n    ports: !override\n' "$service" >>"$out"
    jq -r --arg s "$service" '.services[$s].ports // [] | .[] | "      - \"127.0.0.1:\(.published):\(.target)\""' <<<"$declared" >>"$out"
  done
  printf '%s\n' "$out"
}

# L'état d'origine du serveur hérité : ses rôles, sa base, ses données.
apply_legacy() {
  legacy_active || return 0
  info "  pg-legacy : project/legacy/postgres/init.sql"
  psql -h pg-legacy -U postgres -d postgres -v ON_ERROR_STOP=1 -qX -f "$DBA_PROJECT/legacy/postgres/init.sql" \
    || die "project/legacy/postgres/init.sql a échoué : corrige-le, puis scripts/db rebuild"
  info "  mongo-legacy : project/legacy/mongo/init.js"
  mongosh --quiet "mongodb://mongo-legacy:27017/?directConnection=true" "$DBA_PROJECT/legacy/mongo/init.js" \
    || die "project/legacy/mongo/init.js a échoué : corrige-le, puis scripts/db rebuild"
}
