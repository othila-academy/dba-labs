# Raccourcis de connexion, avec les identifiants de lab de infra/.env.lab.

# psql [rôle] [base] [options psql…] : rôle et base ne sont lus que s'ils ne commencent pas par « - ».
cmd_psql() {
  require_stack
  load_env
  local role=postgres db=postgres
  if [[ ${1:-} != -* && -n ${1:-} ]]; then role=$1; shift; fi
  if [[ ${1:-} != -* && -n ${1:-} ]]; then db=$1; shift; fi
  PGPASSWORD="$POSTGRES_PASSWORD" exec psql -h pg -U "$role" -d "$db" "$@"
}

# mongosh [nœud] [options mongosh…] : sans nœud, le replica set rs0.
cmd_mongosh() {
  require_stack
  local uri="mongodb://mongo1:27017/valmorin?replicaSet=rs0"
  if [[ ${1:-} =~ ^mongo[0-9]+$ ]]; then
    uri="mongodb://$1:27017/valmorin?directConnection=true"
    shift
  fi
  exec mongosh --quiet "$uri" "$@"
}
