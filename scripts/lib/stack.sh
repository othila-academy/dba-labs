# up, down, restart, attach, status : le cycle de vie de la stack.

cmd_up() {
  require_docker
  load_env
  with_profiles "$@"
  config_sync
  info "démarrage des bases${COMPOSE_PROFILES:+ (profils : $COMPOSE_PROFILES)}…"
  compose up -d --wait --wait-timeout 120 \
    || die "les bases ne sont pas prêtes après 120 s : scripts/db status, puis docker compose -p dba logs"
  attach_devcontainer
  info "bases prêtes"
}

cmd_down() {
  require_docker
  load_env
  all_profiles
  compose down -v --remove-orphans
  docker volume rm -f dba-config >/dev/null
  info "bases arrêtées, volumes supprimés"
}

cmd_attach() {
  require_docker
  attach_devcontainer
}

# Dans un conteneur (devcontainer, Codespaces, CI) : rejoindre dba-net pour joindre pg et mongo1 par leur nom.
attach_devcontainer() {
  [[ -f /.dockerenv ]] || return 0
  docker network inspect dba-net >/dev/null 2>&1 || return 0
  local me
  me="$(hostname)"
  if docker inspect "$me" --format '{{json .NetworkSettings.Networks}}' | grep -q '"dba-net"'; then
    return 0
  fi
  docker network connect dba-net "$me" || die "impossible de rattacher ce conteneur ($me) au réseau dba-net"
  info "devcontainer rattaché au réseau dba-net"
}

cmd_status() {
  require_docker
  load_env
  all_profiles
  attach_devcontainer
  compose ps --format 'table {{.Service}}\t{{.State}}\t{{.Health}}'
  local version
  if version="$(run_psql postgres -tAc 'show server_version' 2>/dev/null)"; then
    info "PostgreSQL $version"
  else
    info "PostgreSQL : injoignable (scripts/db up)"
  fi
  mongosh --quiet "mongodb://mongo1:27017/?directConnection=true" --eval '
    print("MongoDB " + db.version());
    try { rs.status().members.forEach((m) => print("  " + m.name + " · " + m.stateStr)); }
    catch (e) { print("  rs0 non initialisé (scripts/db rebuild)"); }' 2>/dev/null \
    || info "MongoDB : injoignable (scripts/db up)"
}

cmd_restart() {
  [[ $# -eq 1 ]] || usage_error "restart attend un service, par exemple : scripts/db restart pg"
  require_docker
  load_env
  with_profiles
  local services
  services="$(compose config --services)"
  grep -qx -- "$1" <<<"$services" || die "service inconnu : $1 (services actifs : $(paste -sd' ' - <<<"$services"))"
  config_sync
  compose restart "$1"
  compose up -d --wait --wait-timeout 120 "$1" || die "$1 ne redémarre pas : scripts/db status, puis docker compose -p dba logs $1"
  info "$1 redémarré avec la configuration de project/"
}
