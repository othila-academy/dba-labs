# shellcheck shell=bash
# Lab incident-verrou : l'incident bloque vraiment le guichet, sans rien relancer s'il est rejoué ; pg_cancel_backend ne suffit
# pas, terminer le guichet non plus ; le runbook débloque, avec ou sans garde-fous, et le prêt passe ; un garde-fou posé pour
# tout le serveur, ou trop long, est refusé.
"$DB" rebuild >/dev/null
sessions() { pg_sql postgres "select count(*) from pg_stat_activity where application_name = '$1'${2:+ and $2}"; }
prets() { pg_sql valmorin "select count(*) from emprunt where date_emprunt = date '2026-10-15'"; }
garde_fous() { PGPASSWORD="$POSTGRES_PASSWORD" psql -h pg -U postgres -d valmorin -v ON_ERROR_STOP=1 -qX -f "$DBA_ROOT/project/schema/030_garde-fous.sql"; }
reload() { pg_sql postgres 'select pg_reload_conf()' >/dev/null && sleep 1; }

check "verrou : avant l'incident, seul le prêt du guichet manque (l'étape n'est pas acquise)" equals "$(failed_ids incident-verrou debloquer)" pret-enregistre
check "verrou : après un rebuild, le check renvoie à l'incident" matches "$(failure_of incident-verrou debloquer pret-enregistre)" 'scripts/db incident verrou'

# Le départ du lab : sans garde-fous, le guichet attend sans fin.
pg_sql postgres 'alter role app_valmorin reset all'
project_before="$(git -C "$DBA_ROOT" status --porcelain -- project)"
check "incident : il raconte ce qui vient de se passer" output_matches 'script d.inventaire' "$DB" incident verrou
check "incident : l'inventaire reste idle in transaction" equals "$(sessions inventaire "state = 'idle in transaction'")" 1
check "incident : le guichet attend un verrou" equals "$(sessions guichet-centre "wait_event_type = 'Lock'")" 1
check "incident : rejoué, il ne relance rien" output_matches 'rien de plus' "$DB" incident verrou
check "incident : une seule session d'inventaire" equals "$(sessions inventaire)" 1
check "incident : project/ n'a pas bougé" equals "$(git -C "$DBA_ROOT" status --porcelain -- project)" "$project_before"
check "verrou : pendant l'incident, debloquer échoue en entier" equals "$(failed_ids incident-verrou debloquer)" "aucune-session-bloquee pret-enregistre session-fautive-terminee"

pg_sql postgres "select pg_cancel_backend(pid) from pg_stat_activity where application_name = 'inventaire'" >/dev/null
check "pg_cancel_backend sur l'inventaire : rien ne change" equals "$(failed_ids incident-verrou debloquer)" "aucune-session-bloquee pret-enregistre session-fautive-terminee"
pg_sql postgres "select pg_terminate_backend(pid, 5000) from pg_stat_activity where application_name = 'guichet-centre'" >/dev/null
sleep 2
check "terminer le guichet : il réessaie, et attend de nouveau l'inventaire" equals "$(sessions guichet-centre "wait_event_type = 'Lock'")" 1
check "terminer le guichet : session-fautive-terminee le dit" matches "$(failure_of incident-verrou debloquer session-fautive-terminee)" 'idle in transaction'

check "verrou : le runbook débloque" bash -c "cd '$DBA_ROOT' && project/runbooks/verrou.sh"
check "verrou : le prêt du guichet est passé, une fois" equals "$(prets)" 1
check "verrou : debloquer passe" equals "$(failed_ids incident-verrou debloquer)" ""

check "prevenir : sans garde-fous, les deux délais manquent" equals "$(failed_ids incident-verrou prevenir)" "delai-inactivite delai-verrou"
garde_fous
check "prevenir : les garde-fous de la solution passent" equals "$(failed_ids incident-verrou prevenir)" ""
pg_sql postgres 'alter role app_valmorin reset lock_timeout'
pg_sql postgres "alter system set lock_timeout = '10s'"
reload
check "lock_timeout pour tout le serveur → delai-verrou le refuse" matches "$(failure_of incident-verrou prevenir delai-verrou)" 'pour tout le serveur'
pg_sql postgres 'alter system reset lock_timeout'
reload
pg_sql postgres "alter role app_valmorin set idle_in_transaction_session_timeout = '10min'"
check "10 min d'inactivité tolérée → delai-inactivite le refuse" matches "$(failure_of incident-verrou prevenir delai-inactivite)" '5 min au plus'
garde_fous

# Le rejeu de la solution : avec les garde-fous, le guichet abandonne au bout de lock_timeout et réessaie ; le runbook le débloque.
"$DB" incident verrou >/dev/null
check "avec garde-fous : le runbook débloque" bash -c "cd '$DBA_ROOT' && project/runbooks/verrou.sh"
check "avec garde-fous : tout passe" equals "$(failed_ids incident-verrou)" ""

# Entre deux essais du guichet, personne n'attend : le runbook doit observer plus longtemps que le lock_timeout de l'application.
"$DB" incident verrou >/dev/null
pg_sql postgres "select pg_terminate_backend(pid, 5000) from pg_stat_activity where application_name = 'guichet-centre'" >/dev/null
check "runbook lancé entre deux essais du guichet : l'inventaire est quand même terminé" bash -c "cd '$DBA_ROOT' && project/runbooks/verrou.sh >/dev/null && [[ \"\$(PGPASSWORD='$POSTGRES_PASSWORD' psql -h pg -U postgres -d postgres -tAXc \"select count(*) from pg_stat_activity where application_name = 'inventaire'\")\" == 0 ]]"
check "runbook lancé entre deux essais du guichet : tout passe" equals "$(failed_ids incident-verrou)" ""
