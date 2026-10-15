# Messages, usage, accès à Docker et à Compose : partagés par toutes les commandes de scripts/db.

USAGE="usage : scripts/db <commande>

  up [profil…]        démarre les bases (profils de project/stack.env et ceux donnés) et attend qu'elles soient prêtes
  down                arrête les bases et supprime leurs volumes
  rebuild             reconstruit tout depuis project/ : down, up, rs0, schéma, scripts Mongo
  restart <service>   recopie la configuration de project/ et redémarre un service (ex. pg)
  status              état des services, versions, rôle de chaque nœud Mongo
  psql [rôle] [base]  se connecter à PostgreSQL (postgres sur la base postgres par défaut)
  mongosh [nœud]      se connecter à MongoDB (le replica set rs0 par défaut, ou un nœud : mongo2)
  attach              rattache ce devcontainer au réseau des bases
  doctor              vérifie Docker, sa mémoire, le disque, le processeur et les images"

info() { printf '%s\n' "$*"; }
step() { printf '\n▶ %s\n' "$*"; }
warn() { printf 'attention : %s\n' "$*" >&2; }
die() {
  printf 'erreur : %s\n' "$*" >&2
  exit 1
}
usage_error() {
  printf '%s\n\n%s\n' "$1" "$USAGE" >&2
  exit 2
}

require_docker() {
  docker info >/dev/null 2>&1 \
    || die "Docker ne répond pas : lance Docker Desktop (ou le service docker), puis relance la commande"
}

# Les variables des images, des identifiants de lab et des profils du projet, exportées pour Compose et les clients.
load_env() {
  set -a
  # shellcheck source=/dev/null
  source "$DBA_ROOT/infra/images.env"
  # shellcheck source=/dev/null
  source "$DBA_ROOT/infra/.env.lab"
  if [[ -f "$DBA_PROJECT/stack.env" ]]; then
    # shellcheck source=/dev/null
    source "$DBA_PROJECT/stack.env"
  fi
  set +a
}

compose() {
  local files=(-f "$DBA_ROOT/infra/compose.yaml")
  if [[ "${DBA_PUBLISH_PORTS:-0}" == 1 ]]; then
    files+=(-f "$DBA_ROOT/infra/compose.ports.yaml")
  fi
  docker compose --project-directory "$DBA_ROOT/infra" "${files[@]}" "$@"
}

# Profils actifs : ceux de project/stack.env, plus ceux donnés, sans doublon ; un profil inconnu arrête tout.
with_profiles() {
  local list="${COMPOSE_PROFILES:-}" known p
  known="$(COMPOSE_PROFILES='' compose config --profiles | paste -sd, -)"
  for p in "$@"; do
    [[ ",$known," == *",$p,"* ]] || die "profil inconnu : $p (profils connus : ${known:-aucun})"
    [[ ",$list," == *",$p,"* ]] || list="${list:+$list,}$p"
  done
  export COMPOSE_PROFILES="$list"
}

# Tous les profils : down et status voient aussi les services qu'un profil a démarrés.
all_profiles() {
  COMPOSE_PROFILES="$(COMPOSE_PROFILES='' compose config --profiles | paste -sd, -)"
  export COMPOSE_PROFILES
}
