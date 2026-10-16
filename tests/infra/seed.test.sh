# Les phases de rebuild et les données de démonstration, sur des copies de project/.
# Les requêtes MongoDB contiennent des opérateurs $ que le shell ne doit pas développer.
# shellcheck disable=SC2016
DB="$DBA_ROOT/scripts/db"
# shellcheck source=/dev/null
source "$DBA_ROOT/infra/.env.lab"
pg_sql() { PGPASSWORD="$POSTGRES_PASSWORD" psql -h pg -U postgres -d "$1" -qtAX -c "$2"; }
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

# Les tests de schéma incomplet ont laissé une stack sans valmorin : on recharge le projet complet.
DBA_PROJECT="$SEEDED/project" "$DB" rebuild >/dev/null
check "seeds : 50 000 adhérents" equals "$(pg_sql valmorin 'select count(*) from adherent')" 50000
check "seeds : 100 000 ouvrages" equals "$(pg_sql valmorin 'select count(*) from ouvrage')" 100000
check "seeds : 250 000 exemplaires" equals "$(pg_sql valmorin 'select count(*) from exemplaire')" 250000
check "seeds : 2 000 000 emprunts" equals "$(pg_sql valmorin 'select count(*) from emprunt')" 2000000
check "seeds : chaque ouvrage a 1 à 3 auteurs" equals "$(pg_sql valmorin "select min(n) || '-' || max(n) from (select count(*) n from ouvrage_auteur group by ouvrage_id) s")" 1-3
check "règles : email et carte uniques" equals "$(pg_sql valmorin 'select count(distinct email) = count(*) and count(distinct numero_carte) = count(*) from adherent')" t
check "règles : ISBN unique quand présent, absent pour une partie" equals "$(pg_sql valmorin 'select count(distinct isbn) = count(isbn) and count(isbn) < count(*) from ouvrage')" t
check "règles : état dans la liste" equals "$(pg_sql valmorin "select count(*) from exemplaire where etat not in ('neuf', 'bon', 'abime', 'retire')")" 0
check "règles : retour prévu après l'emprunt" equals "$(pg_sql valmorin 'select count(*) from emprunt where date_retour_prevue <= date_emprunt')" 0
check "règles : retour jamais avant l'emprunt, jamais après le 15/10/2026" equals "$(pg_sql valmorin "select count(*) from emprunt where date_retour < date_emprunt or date_retour > date '2026-10-15'")" 0
check "règles : des emprunts non rendus, entre 1 et 2 %" equals "$(pg_sql valmorin 'select count(*) filter (where date_retour is null) * 100 between count(*) and 2 * count(*) from emprunt')" t
check "règles : aucun emprunt avant l'inscription de l'adhérent" equals "$(pg_sql valmorin 'select count(*) from emprunt e join adherent a on a.id = e.adherent_id where e.date_emprunt < a.date_inscription')" 0
check "règles : au plus un emprunt en cours par exemplaire" equals "$(pg_sql valmorin 'select count(*) from (select exemplaire_id from emprunt where date_retour is null group by exemplaire_id having count(*) > 1) s')" 0
check "contrat : homonymes, titres répétés et chevauchements annoncés" bash -c "grep -q 'homonymes' '$DBA_ROOT/infra/seed/CONTRAT.md' && grep -q 'même titre' '$DBA_ROOT/infra/seed/CONTRAT.md' && grep -q 'chevauch' '$DBA_ROOT/infra/seed/CONTRAT.md'"
check "facultatifs : téléphone, ISBN, éditeur parfois absents" equals "$(pg_sql valmorin 'select bool_and(n > 0) from (select count(*) filter (where telephone is null) n from adherent union all select count(*) filter (where editeur is null) from ouvrage) s')" t
# L'empreinte est prise avant toute écriture des tests (le test des séquences ajoute un adhérent).
fingerprint() { pg_sql valmorin "select (select sum(hashtext(a::text)) from adherent a) + (select sum(hashtext(e::text)) from emprunt e) + (select sum(hashtext(x::text)) from exemplaire x) + (select sum(hashtext(o::text)) from ouvrage o)"; }
first="$(fingerprint)"
check "séquences recalées : un nouvel adhérent prend l'id 50 001" equals "$(pg_sql valmorin "insert into adherent (numero_carte, nom, prenom, email, date_inscription, site_id) values ('VAL999999', 'Test', 'Test', 'test.seq@valmorin.example', date '2026-10-15', 1) returning id")" 50001
check "prestataire : deux index identiques sur emprunt (date_retour_prevue)" equals "$(pg_sql valmorin "select count(*) from pg_index i join pg_class c on c.oid = i.indexrelid where i.indrelid = 'emprunt'::regclass and pg_get_indexdef(i.indexrelid) like '%(date_retour_prevue)'")" 2

# Les deux requêtes du lab requete-lente parcourent emprunt en entier tant qu'aucun index adapté n'existe.
Q1="select * from emprunt where adherent_id = 4242 and date_emprunt between date '2025-01-01' and date '2025-12-31'"
Q2="select x.site_id, count(*) from emprunt e join exemplaire x on x.id = e.exemplaire_id where e.date_retour is null and e.date_retour_prevue < date '2026-10-15' group by x.site_id"
seq_scan_on_emprunt() { pg_sql valmorin "explain (format json) $1" | jq -e '[.. | objects | select(.["Node Type"]? == "Seq Scan" and .["Relation Name"]? == "emprunt")] | length > 0' >/dev/null; }
check "lab requete-lente : la requête 1 fait un Seq Scan sur emprunt au départ" seq_scan_on_emprunt "$Q1"
check "lab requete-lente : la requête 2 fait un Seq Scan sur emprunt au départ" seq_scan_on_emprunt "$Q2"

# Déterminisme : deux rebuild, mêmes données.
DBA_PROJECT="$SEEDED/project" "$DB" rebuild >/dev/null
check "déterminisme : deux rebuild, même empreinte" equals "$(fingerprint)" "$first"

# Un schéma plus strict que les données : la contrainte refusée est citée.
STRICT="$(mktemp -d)"
cp -R "$SEEDED/project" "$STRICT/project"
sed -i 's/email text,/email varchar(20),/' "$STRICT/project/schema/001_schema.sql"
check "seeds refusés par le schéma : la cause est citée, en français" output_matches 'varchar\(20\)|value too long|ne passent pas ton schéma' env DBA_PROJECT="$STRICT/project" "$DB" rebuild
check "seeds refusés par le schéma : code 1" expect_exit 1 env DBA_PROJECT="$STRICT/project" "$DB" rebuild
rm -rf "$STRICT"
# Une règle naturelle de DBA, posée avant les données : les seeds doivent la respecter.
UNIQ="$(mktemp -d)"
cp -R "$SEEDED/project" "$UNIQ/project"
echo 'create unique index un_emprunt_en_cours on emprunt (exemplaire_id) where date_retour is null;' >"$UNIQ/project/schema/002_regle.sql"
check "seeds : passent un index unique « un seul emprunt en cours par exemplaire »" env DBA_PROJECT="$UNIQ/project" "$DB" rebuild
rm -rf "$UNIQ"

# Le dernier test de la tâche 4 laisse un rebuild en échec : on recharge le projet complet.
DBA_PROJECT="$SEEDED/project" "$DB" rebuild >/dev/null
mongo_eval() { mongosh --quiet "mongodb://mongo1:27017/valmorin?replicaSet=rs0" --eval "$1"; }
check "mongo : 100 000 notices brutes" equals "$(mongo_eval 'db.notices_brutes.countDocuments()')" 100000
check "mongo : 300 000 avis bruts" equals "$(mongo_eval 'db.avis_bruts.countDocuments()')" 300000
check "mongo : quatre types de notices" equals "$(mongo_eval 'db.notices_brutes.distinct("type").sort().join(",")')" "dvd,jeu,livre,revue"
check "mongo : notices hétérogènes (titre ou nom, tags ou mots_cles)" equals "$(mongo_eval 'db.notices_brutes.countDocuments({ titre: { $exists: false }, nom: { $exists: true } }) > 0 && db.notices_brutes.countDocuments({ mots_cles: { $exists: true } }) > 0')" true
check "mongo : des années en texte, à convertir" equals "$(mongo_eval 'db.notices_brutes.countDocuments({ annee: { $type: "string" } }) > 0')" true
check "mongo : chaque avis vise une notice existante" equals "$(mongo_eval 'db.avis_bruts.countDocuments({ notice_id: { $lt: 1 } }) + db.avis_bruts.countDocuments({ notice_id: { $gt: 100000 } })')" 0
check "mongo : index de jointure sur avis_bruts" equals "$(mongo_eval 'db.avis_bruts.getIndexes().some((i) => JSON.stringify(i.key) === JSON.stringify({ notice_id: 1, date: -1 }))')" true
mongo_fingerprint() { mongo_eval 'const a = db.avis_bruts.aggregate([{ $group: { _id: null, s: { $sum: "$note" } } }]).toArray()[0].s; const n = db.notices_brutes.findOne({ _id: 4242 }); a + "|" + JSON.stringify(n)'; }
first_mongo="$(mongo_fingerprint)"
DBA_PROJECT="$SEEDED/project" "$DB" rebuild >/dev/null
check "mongo : déterminisme, deux rebuild, même empreinte" equals "$(mongo_fingerprint)" "$first_mongo"
rm -rf "$SEEDED"
