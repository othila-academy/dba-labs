# shellcheck shell=bash
# Lab sauvegarde : le parcours de la solution (sauvegarde, incident, runbook) ; l'incident idempotent et sans effet sur
# project/ ; un dump illisible, une restauration -t seule et une restauration complète échouent pour la bonne raison.
nouveaux() { pg_sql valmorin "select count(*) from adherent where numero_carte between 'VAL050001' and 'VAL050012'"; }
dump="$(cd "$DBA_ROOT" && project/ops/backup.sh | tail -1)"
check "sauvegarde : backup.sh affiche le chemin du dump" matches "$dump" '^backups/valmorin-[0-9]{8}-[0-9]{6}\.dump$'
project_before="$(git -C "$DBA_ROOT" status --porcelain -- project)"
check "incident : il raconte ce qui vient de se passer" output_matches '12 lecteurs se sont inscrits' "$DB" incident sauvegarde
check "incident : rejoué, il ne fait rien de plus" "$DB" incident sauvegarde
check "incident : 12 adhérents, une seule fois" equals "$(nouveaux)" 12
check "incident : emprunt a disparu" equals "$(pg_sql valmorin "select coalesce(to_regclass('emprunt')::text, 'absente')")" absente
check "incident : project/ n'a pas bougé" equals "$(git -C "$DBA_ROOT" status --porcelain -- project)" "$project_before"
check "sauvegarde : après l'incident, la restauration est à faire" equals "$(failed_ids sauvegarde restaurer)" "application-retablie emprunt-restauree"
check "sauvegarde : le runbook restaure" bash -c "cd '$DBA_ROOT' && project/runbooks/sauvegarde.sh"
check "sauvegarde : tout passe sur la solution" equals "$(failed_ids sauvegarde)" ""

restore() { PGPASSWORD="$POSTGRES_PASSWORD" pg_restore -h pg -U postgres -d valmorin "$@" "$DBA_ROOT/$dump" >/dev/null 2>&1 || true; }
"$DB" incident sauvegarde >/dev/null
restore -t emprunt
check "sauvegarde : -t emprunt seul → le check parle des clés" matches "$(failure_of sauvegarde restaurer emprunt-restauree)" 'clé'
"$DB" incident sauvegarde >/dev/null
restore -c --if-exists
check "sauvegarde : restauration complète → le check parle des adhérents perdus" matches "$(failure_of sauvegarde restaurer emprunt-restauree)" 'adhérents inscrits depuis la sauvegarde'

touch "$DBA_ROOT/backups/valmorin-29991231-235959.dump"
check "sauvegarde : un dump illisible → dump-valide le dit" matches "$(failure_of sauvegarde sauvegarder dump-valide)" 'lisible par pg_restore'
rm -f "$DBA_ROOT/backups/valmorin-29991231-235959.dump"
check "sauvegarde : rebuild remet la solution" "$DB" rebuild
