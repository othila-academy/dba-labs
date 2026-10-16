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
  local lines
  for service in pg-legacy mongo-legacy; do
    jq -r --arg s "$service" '.services[$s].ports // [] | .[] | select((.host_ip // "0.0.0.0") != "127.0.0.1") |
      "\($s) sur \(.host_ip // "toutes les interfaces"):\(.published // "un port au hasard")"' <<<"$declared" \
      | while IFS= read -r line; do
          warn "project/legacy/compose.yaml publie $line : ramené à 127.0.0.1 (un serveur aussi ouvert ne sort jamais de ce poste)"
        done
    # Sans port hôte (« 5432 »), Docker en choisit un : « 127.0.0.1::5432 » garde ce choix, sur 127.0.0.1.
    lines="$(jq -r --arg s "$service" '.services[$s].ports // [] | .[] | "      - \"127.0.0.1:\(.published // ""):\(.target)\""' <<<"$declared")"
    if [[ -n $lines ]]; then
      printf '  %s:\n    ports: !override\n%s\n' "$service" "$lines" >>"$out"
    else
      # Aucun port déclaré : ne rien publier du tout, c'est le meilleur des durcissements.
      printf '  %s:\n    ports: !reset []\n' "$service" >>"$out"
    fi
  done
  printf '%s\n' "$out"
}

# L'état d'origine du serveur hérité : ses rôles, sa base, ses données. Joué dans les conteneurs, par le socket
# local (pg) et l'exception localhost (mongo) : cela marche encore une fois le serveur durci (scram, authentification).
apply_legacy() {
  legacy_active || return 0
  info "  pg-legacy : project/legacy/postgres/init.sql, par le socket local du conteneur"
  compose exec -T -u postgres pg-legacy psql -v ON_ERROR_STOP=1 -qX -d postgres -f /etc/dba/legacy/postgres/init.sql \
    || die "project/legacy/postgres/init.sql a échoué (message ci-dessus) : corrige-le, puis scripts/db rebuild"
  info "  mongo-legacy : project/legacy/mongo/init.js, depuis le conteneur (exception localhost)"
  compose exec -T mongo-legacy mongosh --quiet "mongodb://localhost:27017/?directConnection=true" /etc/dba/legacy/mongo/init.js \
    || die "project/legacy/mongo/init.js a échoué (message ci-dessus) : corrige-le, puis scripts/db rebuild"
}
