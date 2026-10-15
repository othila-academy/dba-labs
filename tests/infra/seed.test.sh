# Les phases de rebuild et les données de démonstration, sur des copies de project/.
DB="$DBA_ROOT/scripts/db"
# shellcheck source=/dev/null
source "$DBA_ROOT/infra/.env.lab"
pg_sql() { PGPASSWORD="$POSTGRES_PASSWORD" psql -h pg -U postgres -d "$1" -tAX -c "$2"; }
equals() { [[ "$1" == "$2" ]] || { echo "« $1 », attendu « $2 »"; return 1; }; }

# Un projet avec le schéma de test complet.
SEEDED="$(mktemp -d)"
cp -R "$DBA_PROJECT" "$SEEDED/project"
cp "$DBA_ROOT"/tests/infra/fixtures/schema/*.sql "$SEEDED/project/schema/"
echo 'create table bilan_sites as select count(*) as n from site;' >"$SEEDED/project/post/010_bilan.sql"

check "rebuild avec le schéma complet : sans erreur" env DBA_PROJECT="$SEEDED/project" "$DB" rebuild
check "seeds : les 6 sites" equals "$(pg_sql valmorin 'select count(*) from site')" 6
check "post : joué après les seeds (il voit les 6 sites)" equals "$(pg_sql valmorin 'select n from bilan_sites')" 6
check "ANALYZE : les tables seedées ont des statistiques" equals "$(pg_sql valmorin "select count(*) from pg_stat_user_tables where relname = 'site' and last_analyze is not null")" 1

# Un schéma incomplet : on le dit, on saute les seeds PostgreSQL, on continue.
PARTIAL="$(mktemp -d)"
cp -R "$DBA_PROJECT" "$PARTIAL/project"
cp "$DBA_ROOT/tests/infra/fixtures/schema/000_database.sql" "$PARTIAL/project/schema/"
echo 'create table site (id integer primary key, nom text, ville text);' >"$PARTIAL/project/schema/001_site.sql"
check "schéma incomplet : les tables manquantes sont nommées" output_matches 'données de démonstration PostgreSQL ignorées : tables absentes : adherent, auteur, ouvrage, ouvrage_auteur, exemplaire, emprunt' env DBA_PROJECT="$PARTIAL/project" "$DB" rebuild
check "schéma incomplet : rebuild va au bout (code 0)" env DBA_PROJECT="$PARTIAL/project" "$DB" rebuild
check "schéma incomplet : aucune ligne insérée" equals "$(pg_sql valmorin 'select count(*) from site')" 0
check "sans base valmorin : seeds ignorés, avec la raison" output_matches 'base valmorin absente' "$DB" rebuild
rm -rf "$PARTIAL"
