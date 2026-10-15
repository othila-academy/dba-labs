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
  # rs0 se réinitialise après un down (volumes neufs) : sans cela, MongoDB refuserait toute écriture.
  rs_init
  info "bases prêtes"
}

cmd_down() {
  require_docker
  load_env
  all_profiles
  # Détacher ce devcontainer du réseau, pour que Compose puisse le supprimer avec le reste.
  if [[ -f /.dockerenv ]] && docker network inspect dba-net >/dev/null 2>&1; then
    docker network disconnect -f dba-net "$(self_container_id)" >/dev/null 2>&1 || true
  fi
  compose down -v --remove-orphans
  docker volume rm -f dba-config >/dev/null
  info "bases arrêtées, volumes supprimés"
}

cmd_attach() {
  require_docker
  attach_devcontainer
}

# L'identifiant de ce conteneur : lu dans mountinfo, car sur Codespaces le hostname n'est pas l'identifiant ;
# à défaut, le hostname, qui l'est sous Docker Desktop et Docker Engine.
self_container_id() {
  local id
  id="$(grep -o 'containers/[0-9a-f]\{64\}' /proc/self/mountinfo 2>/dev/null | head -1)"
  if [[ -n $id ]]; then printf '%s\n' "${id#containers/}"; else hostname; fi
}

# Dans un conteneur (devcontainer, Codespaces, CI) : rejoindre dba-net pour joindre pg et mongo1 par leur nom.
attach_devcontainer() {
  [[ -f /.dockerenv ]] || return 0
  docker network inspect dba-net >/dev/null 2>&1 || return 0
  local me
  me="$(self_container_id)"
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
  # En-tête à nous : Compose 5 laisse la colonne santé sans titre (« <no value> »).
  { printf 'service\tétat\tsanté\n'; compose ps --format '{{.Service}}\t{{.State}}\t{{.Health}}'; } | column -t -s $'\t'
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
