# shellcheck shell=bash
# Lab replica-set : la solution passe, la bascule et la sauvegarde comprises ; l'incident arrête le primaire et lui seul ; pendant
# la panne, une écriture majoritaire passe ; une archive illisible, w: 1 par défaut et une chaîne sans replicaSet échouent pour
# la bonne raison ; les checks n'ajoutent aucune base.
rs3() { mongosh --quiet "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/valmorin?replicaSet=rs0&serverSelectionTimeoutMS=15000" --eval "$1"; }
"$DB" rebuild >/dev/null
check "replica-set : après rebuild, rs0 et la chaîne de l'application passent" equals "$(failed_ids replica-set repliquer)$(failed_ids replica-set connecter)" ""
check "replica-set : après rebuild, le term est 1 et la bascule reste à faire" equals "$(rs3 'Number(rs.status().term)') $(failed_ids replica-set basculer)" "1 bascule-observee"
project_before="$(git -C "$DBA_ROOT" status --porcelain -- project)"
check "incident : il raconte la panne du primaire" output_matches 'mongo1, le nœud primaire de rs0, ne répond plus' "$DB" incident primaire
check "incident : mongo1 est arrêté" equals "$(docker inspect dba-mongo1-1 --format '{{.State.Status}}')" exited
check "incident : rejoué, il n'arrête pas un second nœud" output_matches 'déjà arrêté \(mongo1\)' "$DB" incident primaire
check "incident : mongo2 et mongo3 tournent toujours" equals "$(docker inspect dba-mongo2-1 dba-mongo3-1 --format '{{.State.Status}}' | paste -sd' ' -)" "running running"
check "incident : project/ n'a pas bougé" equals "$(git -C "$DBA_ROOT" status --porcelain -- project)" "$project_before"
check "pendant la panne : une écriture w: majority passe (2 membres sur 3)" equals "$(rs3 'db.journal.insertOne({ a: 1 }, { writeConcern: { w: "majority", wtimeout: 15000 } }).acknowledged')" true
rs3 'db.journal.drop()' >/dev/null
# La consigne de basculer se connecte par les trois hôtes : scripts/db mongosh ne connaît que mongo1, arrêté pendant la panne.
consigne() { (cd "$DBA_ROOT" && node -e "import('./.othila-lab/labs/replica-set/basculer.mjs').then((m) => process.stdout.write(m.instructions))"); }
check "basculer : la consigne joint rs0 par les trois hôtes" matches "$(consigne)" 'mongosh "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/valmorin\?replicaSet=rs0"'
check "pendant la panne : la chaîne de la consigne joint rs0" equals "$(mongosh --quiet 'mongodb://mongo1:27017,mongo2:27017,mongo3:27017/valmorin?replicaSet=rs0' --eval 'rs.status().ok')" 1
check "pendant la panne : trois-membres nomme le nœud absent" matches "$(failure_of replica-set repliquer trois-membres)" 'mongo1:27017 injoignable'
check "après la panne, scripts/db up relance mongo1" "$DB" up
check "replica-set : la bascule est vue" equals "$(failed_ids replica-set basculer)" ""
check "sauvegarde : backup-mongo.sh affiche le chemin de l'archive" matches "$(cd "$DBA_ROOT" && project/ops/backup-mongo.sh | tail -1)" '^backups/valmorin-mongo-[0-9]{8}-[0-9]{6}\.archive$'
check "replica-set : tout passe sur la solution" equals "$(failed_ids replica-set)" ""
check "replica-set : les checks ne laissent aucune base lab_check" equals "$(rs3 'db.adminCommand({ listDatabases: 1, nameOnly: true }).databases.some((d) => d.name === "lab_check")')" false

head -c 2000000 /dev/urandom >"$DBA_ROOT/backups/valmorin-mongo-29991231-235959.archive"
check "sauvegarde : une archive illisible → archive-valide le dit" matches "$(failure_of replica-set sauvegarder archive-valide)" 'lisible par mongorestore'
rm -f "$DBA_ROOT/backups/valmorin-mongo-29991231-235959.archive"

rs3 'db.adminCommand({ setDefaultRWConcern: 1, defaultWriteConcern: { w: 1 } }).ok' >/dev/null
check "w: 1 par défaut → seul ecriture-majoritaire échoue" equals "$(failed_ids replica-set repliquer)" ecriture-majoritaire
rs3 'db.adminCommand({ setDefaultRWConcern: 1, defaultWriteConcern: { w: "majority" } }).ok' >/dev/null

echo 'MONGO_URI=mongodb://mongo1:27017/valmorin' >"$DBA_ROOT/project/app.env"
check "une chaîne à un seul hôte, sans replicaSet → seul mongo-uri échoue" equals "$(failed_ids replica-set connecter)" mongo-uri
git -C "$DBA_ROOT" checkout -- project/app.env
check "replica-set : remis en état" equals "$(failed_ids replica-set)" ""
