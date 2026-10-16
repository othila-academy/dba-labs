# rebuild : l'état des bases reconstruit depuis project/, et seulement depuis project/.

cmd_rebuild() {
  local started=$SECONDS
  step "1/8 · arrêt et suppression des volumes"
  cmd_down
  step "2/8 · démarrage des bases et de rs0"
  cmd_up
  step "3/8 · schéma PostgreSQL (project/schema)"
  apply_schema
  step "4/8 · données de démonstration PostgreSQL"
  apply_pg_seeds
  step "5/8 · après les données (project/post)"
  apply_post
  step "6/8 · statistiques (ANALYZE)"
  analyze_all
  step "7/8 · données de démonstration MongoDB"
  apply_mongo_seeds
  step "8/8 · scripts MongoDB (project/mongo)"
  apply_mongo
  info ""
  info "bases reconstruites depuis project/ en $((SECONDS - started)) s"
}

# Les tables du dictionnaire de données (lab schema) : les seeds n'insèrent que là.
SEED_TABLES=(site adherent auteur ouvrage ouvrage_auteur exemplaire emprunt)

# Les tables du dictionnaire absentes de valmorin, séparées par « , » ; vide si toutes sont là.
missing_tables() {
  local list
  list="$(printf "'%s'," "${SEED_TABLES[@]}")"
  run_psql valmorin -tAc "select coalesce(string_agg(t, ', ' order by o), '')
    from unnest(array[${list%,}]) with ordinality as u(t, o) where to_regclass('public.' || t) is null"
}

apply_pg_seeds() {
  if [[ -z "$(run_psql postgres -tAc "select 1 from pg_database where datname = 'valmorin'")" ]]; then
    info "données de démonstration PostgreSQL ignorées : base valmorin absente (lab demarrage)"
    return 0
  fi
  local missing file
  missing="$(missing_tables)"
  if [[ -n $missing ]]; then
    info "données de démonstration PostgreSQL ignorées : tables absentes : $missing (lab schema)"
    return 0
  fi
  for file in "$DBA_ROOT"/infra/seed/postgres/*.sql; do
    info "  $(basename "$file")"
    # Les résultats des select (setseed, setval) n'intéressent personne ; les erreurs, elles, restent affichées.
    run_psql valmorin -1 -f "$file" >/dev/null \
      || die "les données de démonstration ne passent pas ton schéma ($(basename "$file")) : lis la contrainte citée ci-dessus, compare-la au dictionnaire de données (infra/seed/CONTRAT.md), corrige project/schema, puis scripts/db rebuild"
  done
}

apply_post() {
  local files=() file
  shopt -s nullglob
  files=("$DBA_PROJECT"/post/*.sql)
  shopt -u nullglob
  if [[ ${#files[@]} -eq 0 ]]; then
    info "aucun fichier dans project/post : rien à appliquer"
    return 0
  fi
  if [[ -z "$(run_psql postgres -tAc "select 1 from pg_database where datname = 'valmorin'")" ]]; then
    die "project/post a des fichiers mais la base valmorin n'existe pas : project/schema/000_*.sql doit la créer"
  fi
  for file in "${files[@]}"; do
    info "  $(basename "$file"), sur la base valmorin, en une transaction"
    run_psql valmorin -1 -f "$file" || die "$(basename "$file") a échoué : corrige-le, puis scripts/db rebuild"
  done
}

# Des statistiques fraîches et calculées au même moment : les plans des labs ne dépendent pas de l'autovacuum.
analyze_all() {
  if [[ -z "$(run_psql postgres -tAc "select 1 from pg_database where datname = 'valmorin'")" ]]; then
    info "pas de base valmorin : rien à analyser"
    return 0
  fi
  run_psql valmorin -c 'analyze' && info "  statistiques à jour"
}

apply_mongo_seeds() {
  local file
  for file in "$DBA_ROOT"/infra/seed/mongo/*.js; do
    [[ -e $file ]] || { info "aucune donnée de démonstration MongoDB"; return 0; }
    info "  $(basename "$file")"
    mongosh --quiet "mongodb://mongo1:27017/valmorin?replicaSet=rs0" "$file" \
      || die "données de démonstration MongoDB en échec ($(basename "$file")) : scripts/db status"
  done
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
