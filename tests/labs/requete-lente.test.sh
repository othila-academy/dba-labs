# shellcheck shell=bash
# Lab requete-lente : la solution passe ; la charge de l'application se voit dans pg_stat_statements ; les plans ont de la
# marge et tiennent quand ANALYZE rééchantillonne ; retirer un index fait échouer le seul check concerné.
query_of() { (cd "$DBA_ROOT" && node -e "import('./.othila-lab/labs/requete-lente/requetes.mjs').then((m) => process.stdout.write(m.$1))"); }
Q1="$(query_of Q1)"
Q2="$(query_of Q2)"
check "requete-lente : tout passe sur la solution" equals "$(failed_ids requete-lente)" ""
check "requete-lente : application.sql se joue" "$DB" psql postgres valmorin -f "$DBA_ROOT/.othila-lab/labs/requete-lente/application.sql"
check "requete-lente : pg_stat_statements a compté Q2 trois fois au moins" test "$(pg_sql valmorin "select coalesce(sum(calls), 0) from pg_stat_statements where query like '%date_retour_prevue <%'")" -ge 3

# Le coût estimé de tout le plan, tel que retenu, puis sans parcours d'index ni de bitmap : c'est l'écart que le
# planificateur arbitre (Seq Scan parallèle compris).
plan_cost() { pg_sql valmorin "$1 explain (format json) $2" | jq '.[0].Plan."Total Cost"'; }
margin_ok() {
  local chosen forced
  chosen="$(plan_cost '' "$1")"
  forced="$(plan_cost 'set enable_indexscan = off; set enable_bitmapscan = off; set enable_indexonlyscan = off;' "$1")"
  awk -v c="$chosen" -v f="$forced" 'BEGIN { if (f >= 2 * c) exit 0; print "coût retenu " c ", sans index " f " : marge inférieure à 2"; exit 1 }'
}
check "requete-lente : Q1, deux fois moins cher que sans index" margin_ok "$Q1"
check "requete-lente : Q2, deux fois moins cher que sans index" margin_ok "$Q2"
# ANALYZE tire un nouvel échantillon à chaque fois : les plans doivent tenir.
stable() {
  local i
  for i in 1 2 3 4 5; do
    pg_sql valmorin 'analyze emprunt' && [[ "$(failed_ids requete-lente indexer)" == "" ]] || { echo "plan instable au ANALYZE n° $i"; return 1; }
  done
}
check "requete-lente : les plans tiennent sur 5 ANALYZE successifs" stable

pg_sql valmorin 'drop index emprunt_en_cours_retour_prevue_idx'
check "requete-lente : sans l'index partiel → seul q2-sans-seq-scan échoue" equals "$(failed_ids requete-lente indexer)" "q2-sans-seq-scan"
pg_sql valmorin 'create index emprunt_en_cours_retour_prevue_idx on emprunt (date_retour_prevue) where date_retour is null'
pg_sql valmorin 'create index idx_emprunt_dateprevue on emprunt (date_retour_prevue)'
check "requete-lente : le doublon reposé → doublon-supprime échoue" equals "$(failed_ids requete-lente doublon)" "doublon-supprime"
pg_sql valmorin 'drop index idx_emprunt_dateprevue'
check "requete-lente : remis en état" equals "$(failed_ids requete-lente)" ""
