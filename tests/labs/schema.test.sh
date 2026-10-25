# shellcheck shell=bash
# Lab schema : la solution passe (données comprises) ; un schéma différent mais conforme passe aussi ; chaque faute
# ciblée fait échouer exactement le check qui la concerne. Les variantes jouent sur une base valmorin sans données.
check "schema : tout passe sur la solution" equals "$(failed_ids schema)" ""

SOLUTION="$DBA_ROOT/project/schema/001_schema.sql"
# valmorin recréée vide, avec un seul fichier de schéma, puis une modification éventuelle.
fresh_schema() {
  pg_sql postgres 'drop database if exists valmorin with (force)' \
    && pg_sql postgres 'create database valmorin' \
    && PGPASSWORD="$POSTGRES_PASSWORD" psql -h pg -U postgres -d valmorin -v ON_ERROR_STOP=1 -qX -1 -f "$1" >/dev/null \
    && { [[ -z ${2:-} ]] || pg_sql valmorin "$2" >/dev/null; }
}

fresh_schema "$DBA_ROOT/tests/labs/fixtures/schema-variante.sql"
check "schema : un schéma différent mais conforme passe (sauf les données, absentes)" equals "$(failed_ids schema)" "donnees-chargees"

fresh_schema "$SOLUTION" 'alter table emprunt drop constraint emprunt_adherent_id_fkey, add foreign key (adherent_id) references adherent (id) on delete cascade'
check "schema : on delete cascade → seul rejet-suppression-adherent échoue" equals "$(failed_ids schema cles-etrangeres)" "rejet-suppression-adherent"

fresh_schema "$SOLUTION" 'alter table emprunt add unique (exemplaire_id)'
check "schema : chevauchements interdits → seul accepte-valides échoue" equals "$(failed_ids schema regles)" "accepte-valides"

fresh_schema "$SOLUTION" 'alter table site alter column id set generated always'
check "schema : generated always → seul id-identite échoue" equals "$(failed_ids schema tables)" "id-identite"

fresh_schema "$SOLUTION" 'alter table adherent alter column nom drop not null'
check "schema : nom facultatif → seul obligatoires échoue" equals "$(failed_ids schema regles)" "obligatoires"
check "schema : le message nomme la colonne" matches "$(failure_of schema regles obligatoires)" 'adherent\.nom'

fresh_schema "$SOLUTION" 'alter table exemplaire drop constraint exemplaire_etat_check'
check "schema : état libre → seul rejet-etat-inconnu échoue" equals "$(failed_ids schema regles)" "rejet-etat-inconnu"

fresh_schema "$SOLUTION" "alter table ouvrage add check (isbn ~ '^97[89][0-9]{10}\$')"
check "schema : une règle de format ISBN-13 (978 ou 979) → les règles passent encore" equals "$(failed_ids schema regles)" ""

check "schema : rebuild remet la solution" "$DB" rebuild

# Le MCD donne toutes les colonnes du contrat, y compris celles des clés étrangères (absentes de infra/seed/CONTRAT.md).
for col in exemplaire.ouvrage_id exemplaire.site_id emprunt.exemplaire_id emprunt.adherent_id adherent.site_id; do
  check "schema : MCD.md nomme la colonne $col" grep -q "${col#*.}" "$DBA_ROOT/.othila-lab/labs/schema/MCD.md"
done
check "schema : la consigne de tables donne un exemple de create table" matches "$(cd "$DBA_ROOT" && node -e "import('./.othila-lab/labs/schema/tables.mjs').then((m) => process.stdout.write(m.instructions))")" 'create table site'
