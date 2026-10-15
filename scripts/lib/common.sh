# Messages, usage, accès à Docker et à Compose : partagés par toutes les commandes de scripts/db.

USAGE="usage : scripts/db <commande>

  up [profil…]        démarre les bases (profils de project/stack.env et ceux donnés) et attend qu'elles soient prêtes
  down                arrête les bases et supprime leurs volumes
  rebuild             reconstruit tout depuis project/ : down, up, rs0, schéma, scripts Mongo
  restart <service>   recopie la configuration de project/ et redémarre un service (ex. pg)
  reload <service>    recopie la configuration de project/ et la fait relire sans redémarrer (pg, pg-legacy)
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
  set +a
  read_stack_env
}

# project/stack.env est un fichier de l'étudiant : on le lit, on ne l'exécute jamais.
# Une seule clé, COMPOSE_PROFILES, et des profils séparés par des virgules.
read_stack_env() {
  local file="$DBA_PROJECT/stack.env" line key value n=0
  COMPOSE_PROFILES=
  [[ -f $file ]] || return 0
  while IFS= read -r line || [[ -n $line ]]; do
    n=$((n + 1))
    line=${line%$'\r'}
    [[ $line =~ ^[[:space:]]*(#|$) ]] && continue
    [[ $line == *=* ]] || die "project/stack.env, ligne $n : « $line » n'est pas de la forme CLE=valeur"
    key=${line%%=*}
    value=${line#*=}
    [[ $key == COMPOSE_PROFILES ]] || die "project/stack.env : $key n'est pas reconnu, seule la clé COMPOSE_PROFILES l'est"
    [[ $value =~ ^[a-z0-9,-]*$ ]] || die "project/stack.env : COMPOSE_PROFILES=$value : sépare les profils par des virgules, sans espace (ex. COMPOSE_PROFILES=rs,legacy)"
    COMPOSE_PROFILES=$value
  done <"$file"
  export COMPOSE_PROFILES
}

# Les commandes qui n'attendent aucun argument le disent, plutôt que d'ignorer ce qu'on leur donne.
no_args() {
  local command=$1
  shift
  [[ $# -eq 0 ]] || usage_error "$command n'attend pas d'argument (reçu : $*)"
}

# Docker, puis la base pg joignable par son nom depuis ce conteneur.
require_stack() {
  require_docker
  getent hosts pg >/dev/null 2>&1 || die "les bases ne répondent pas : scripts/db up (ou scripts/db rebuild)"
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
  local -a from_file=()
  IFS=, read -ra from_file <<<"$list"
  for p in "${from_file[@]}"; do
    [[ -z $p || ",$known," == *",$p,"* ]] || die "profil inconnu : $p, dans project/stack.env (profils connus : ${known:-aucun})"
  done
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
