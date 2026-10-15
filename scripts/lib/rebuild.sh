# rebuild : l'état des bases reconstruit depuis project/, et seulement depuis project/.

cmd_rebuild() {
  local started=$SECONDS
  step "1/5 · arrêt et suppression des volumes"
  cmd_down
  step "2/5 · démarrage des bases"
  cmd_up
  step "3/5 · replica set rs0"
  rs_init
  step "4/5 · schéma PostgreSQL (project/schema)"
  apply_schema
  step "5/5 · scripts MongoDB (project/mongo)"
  apply_mongo
  info ""
  info "bases reconstruites depuis project/ en $((SECONDS - started)) s"
}

run_psql() {
  local db=$1
  shift
  PGPASSWORD="$POSTGRES_PASSWORD" psql -h pg -U postgres -d "$db" -v ON_ERROR_STOP=1 -qX "$@"
}

rs_init() {
  mongosh --quiet "mongodb://mongo1:27017/?directConnection=true" "$DBA_ROOT/infra/mongo/init-rs.js" \
    || die "initialisation de rs0 impossible : scripts/db status"
}

apply_schema() {
  local files=() file name
  shopt -s nullglob
  files=("$DBA_PROJECT"/schema/*.sql)
  shopt -u nullglob
  if [[ ${#files[@]} -eq 0 ]]; then
    info "aucun fichier dans project/schema : rien à appliquer"
    return 0
  fi
  for file in "${files[@]}"; do
    name="$(basename "$file")"
    if [[ "$name" == 000_* ]]; then
      info "  $name, sur la base postgres"
      run_psql postgres -f "$file" || die "$name a échoué : corrige-le, puis scripts/db rebuild"
    else
      info "  $name, sur la base valmorin, en une transaction"
      run_psql valmorin -1 -f "$file" || die "$name a échoué : corrige-le, puis scripts/db rebuild"
    fi
  done
}

apply_mongo() {
  local files=() file
  shopt -s nullglob
  files=("$DBA_PROJECT"/mongo/*.js)
  shopt -u nullglob
  if [[ ${#files[@]} -eq 0 ]]; then
    info "aucun script dans project/mongo : rien à appliquer"
    return 0
  fi
  for file in "${files[@]}"; do
    info "  $(basename "$file")"
    mongosh --quiet "mongodb://mongo1:27017/valmorin?replicaSet=rs0" "$file" \
      || die "$(basename "$file") a échoué : corrige-le, puis scripts/db rebuild"
  done
}
