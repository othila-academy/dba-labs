# shellcheck shell=bash
# Lab roles : la solution passe ; les checks ne laissent aucune trace ; un privilège de trop fait échouer son check.
instructions_of() { (cd "$DBA_ROOT" && node -e "import('./.othila-lab/labs/$1.mjs').then((m) => process.stdout.write(m.instructions))"); }
check "roles : la consigne d'analyste impose des privilèges sur les colonnes de adherent" matches "$(instructions_of roles/analyste)" 'privilèges sur les colonnes de adherent'
check "roles : la consigne d'application donne la commande de connexion du rôle" matches "$(instructions_of roles/application)" 'psql -h pg -U app_valmorin -d valmorin'
check "roles : tout passe sur la solution" equals "$(failed_ids roles)" ""
before="$(pg_sql valmorin 'select count(*) from emprunt')"
check "roles : deux lab check de suite, même résultat" equals "$(failed_ids roles)" ""
check "roles : les checks ne laissent aucune ligne" equals "$(pg_sql valmorin 'select count(*) from emprunt')" "$before"
check "roles : ni table, ni rôle de test" equals "$(pg_sql valmorin "select coalesce(to_regclass('check_app')::text, '') || coalesce(to_regclass('check_dba')::text, '')")" ""

pg_sql valmorin 'grant select on adherent to analyste'
check "roles : select sur tout adherent → les deux checks de coordonnées échouent" equals "$(failed_ids roles analyste)" "analyste-sans-email analyste-sans-telephone"
pg_sql valmorin 'revoke select on adherent from analyste; grant select (id, numero_carte, nom, prenom, date_inscription, site_id) on adherent to analyste'

pg_sql postgres 'alter role dba_valmorin createrole'
check "roles : CREATEROLE → seul dba-sans-pouvoirs échoue" equals "$(failed_ids roles proprietaire)" "dba-sans-pouvoirs"
pg_sql postgres 'alter role dba_valmorin nocreaterole'
check "roles : remis en état" equals "$(failed_ids roles)" ""
