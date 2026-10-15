# up, down, restart, attach, status : le cycle de vie de la stack.
cmd_up() { require_docker; }
cmd_status() { require_docker; }
cmd_restart() {
  [[ $# -eq 1 ]] || usage_error "restart attend un service, par exemple : scripts/db restart pg"
  require_docker
}
