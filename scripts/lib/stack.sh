# up, down, restart, attach, status : le cycle de vie de la stack.

cmd_up() {
  require_docker
  load_env
  with_profiles "$@"
  compose version >/dev/null
  config_sync
  info "démarrage des bases${COMPOSE_PROFILES:+ (profils : $COMPOSE_PROFILES)}…"
  compose up -d --wait --wait-timeout 120 \
    || die "les bases ne démarrent pas (message de Docker Compose ci-dessus) : scripts/db status, puis docker compose -p dba logs"
  attach_devcontainer
  # rs0 se réinitialise après un down (volumes neufs) : sans cela, MongoDB refuserait toute écriture.
  rs_init
  legacy_empty_hint
  info "bases prêtes"
}

cmd_down() {
  require_docker
  load_env
  all_profiles
  # Lue par compose() (portée dynamique) ; local, car rebuild enchaîne down puis up, et up doit garder l'override.
  # shellcheck disable=SC2034
  local DBA_SKIP_LEGACY_PORTS=1
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

# Les services de dba-net et leur adresse, une ligne « adresse service » chacun.
dba_hosts_lines() {
  local id
  for id in $(docker network inspect dba-net --format '{{range $id, $c := .Containers}}{{$id}} {{end}}' 2>/dev/null); do
    docker inspect "$id" --format '{{(index .NetworkSettings.Networks "dba-net").IPAddress}} {{index .Config.Labels "com.docker.compose.service"}}' 2>/dev/null
  done | awk 'NF == 2'
}

# Sur Codespaces, le devcontainer partage le réseau de la machine (mode host) : il ne peut pas rejoindre dba-net, mais il
# joint chaque conteneur par son adresse. On écrit donc leurs noms dans /etc/hosts, dans un bloc repéré par « # dba-net »,
# réécrit à chaque appel (les adresses changent à chaque up). Le reste du fichier ne bouge pas.
hosts_fallback() {
  local file=${DBA_HOSTS_FILE:-/etc/hosts} lines content
  lines="$(dba_hosts_lines)"
  [[ -n $lines ]] || return 0
  content="$(grep -v ' # dba-net$' "$file"; awk '{ print $0 " # dba-net" }' <<<"$lines")"
  [[ $content == "$(cat "$file")" ]] && return 0
  # /etc/hosts est monté dans le conteneur : on le réécrit en place, jamais par remplacement.
  if [[ -w $file ]]; then
    printf '%s\n' "$content" >"$file"
  else
    printf '%s\n' "$content" | sudo -n tee "$file" >/dev/null \
      || die "devcontainer en réseau host : impossible d'écrire les noms des bases dans $file (sudo refusé)"
  fi
  info "devcontainer en réseau host (Codespaces) : noms des bases écrits dans $file"
}

# Dans un conteneur (devcontainer, Codespaces, CI) : rejoindre dba-net pour joindre pg et mongo1 par leur nom.
attach_devcontainer() {
  [[ -f /.dockerenv ]] || return 0
  docker network inspect dba-net >/dev/null 2>&1 || return 0
  local me
  me="$(self_container_id)"
  if [[ "$(docker inspect "$me" --format '{{.HostConfig.NetworkMode}}' 2>/dev/null)" == host ]]; then
    hosts_fallback
    return 0
  fi
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
  # Lue par compose() (portée dynamique) ; local, car rebuild enchaîne down puis up, et up doit garder l'override.
  # shellcheck disable=SC2034
  local DBA_SKIP_LEGACY_PORTS=1
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
  compose version >/dev/null
  local services
  services="$(compose config --services)"
  grep -qx -- "$1" <<<"$services" || die "service inconnu : $1 (services actifs : $(paste -sd' ' - <<<"$services"))"
  config_sync
  compose restart "$1"
  compose up -d --wait --wait-timeout 120 "$1" || die "$1 ne redémarre pas : scripts/db status, puis docker compose -p dba logs $1"
  attach_devcontainer
  info "$1 redémarré avec la configuration de project/"
}

# reload : la configuration recopiée, puis rechargée sans couper les connexions. Les paramètres qui
# exigent un redémarrage (shared_preload_libraries, shared_buffers…) restent en attente : on le dit.
cmd_reload() {
  [[ $# -eq 1 ]] || usage_error "reload attend un service, par exemple : scripts/db reload pg"
  [[ $1 == pg || $1 == pg-legacy ]] || die "reload ne sait recharger que pg et pg-legacy : pour $1, scripts/db restart $1"
  require_stack
  load_env
  with_profiles
  compose version >/dev/null
  config_sync
  local sql=(env PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$1" -U postgres -d postgres -qtAX)
  local before pending _
  before="$("${sql[@]}" -c 'select pg_conf_load_time()')" || die "$1 ne répond pas : scripts/db status"
  "${sql[@]}" -c 'select pg_reload_conf()' >/dev/null || die "$1 ne répond pas : scripts/db status"
  # La relecture est asynchrone : on attend que le serveur l'ait faite (5 s au plus) avant de lire ce qui reste en attente.
  for _ in $(seq 1 50); do
    [[ "$("${sql[@]}" -c 'select pg_conf_load_time()')" != "$before" ]] && break
    sleep 0.1
  done
  pending="$("${sql[@]}" -c "select string_agg(name, ', ' order by name) from pg_settings where pending_restart")"
  # pg_file_settings relit les fichiers : une valeur refusée y porte son erreur, avec le fichier et la ligne.
  # Un paramètre qui attend un redémarrage y porte aussi une erreur : celui-là n'est pas une faute, on le signale plus bas.
  local errors
  errors="$("${sql[@]}" -c "select string_agg(coalesce(regexp_replace(sourcefile, '^.*/', ''), '?') || ':' || coalesce(sourceline::text, '?') || ' ' || coalesce(name, '') || ' : ' || error, '; ') from pg_file_settings where error is not null and name not in (select name from pg_settings where pending_restart)")"
  if [[ -n $errors ]]; then
    die "$1 a refusé une partie de sa configuration : $errors → corrige project/config, puis scripts/db reload $1"
  fi
  info "$1 a relu sa configuration"
  if [[ -n $pending ]]; then
    info "PostgreSQL attend un redémarrage pour : $pending → scripts/db restart $1 (même si tu viens de retirer le réglage : le redémarrage le confirmera)"
  fi
}

# Après un down, up recrée un serveur hérité vide : son état d'origine ne revient qu'avec rebuild. On le dit,
# sauf pendant rebuild lui-même, qui l'initialise juste après.
legacy_empty_hint() {
  legacy_active || return 0
  [[ -z ${DBA_IN_REBUILD:-} ]] || return 0
  local roles
  roles="$(compose exec -T -u postgres pg-legacy psql -qtAX -d postgres -c "select count(*) from pg_roles where rolname !~ '^pg_' and rolname <> 'postgres'" 2>/dev/null)"
  [[ $roles == 0 ]] && info "serveur hérité vide (volumes neufs) : son état d'origine se recrée par scripts/db rebuild"
  return 0
}
