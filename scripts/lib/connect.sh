# Raccourcis de connexion, avec les identifiants de lab de infra/.env.lab.

# psql [rôle] [base] [options psql…]
cmd_psql() {
  load_env
  local role=${1:-postgres} db=${2:-postgres}
  shift $(($# > 2 ? 2 : $#))
  PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h pg -U "$role" -d "$db" "$@"
}

# mongosh [nœud] [options mongosh…] : sans nœud, le replica set rs0.
cmd_mongosh() {
  local uri="mongodb://mongo1:27017/valmorin?replicaSet=rs0"
  if [[ ${1:-} =~ ^mongo[0-9]+$ ]]; then
    uri="mongodb://$1:27017/valmorin?directConnection=true"
    shift
  fi
  exec mongosh --quiet "$uri" "$@"
}
