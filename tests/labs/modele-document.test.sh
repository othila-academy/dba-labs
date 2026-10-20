# shellcheck shell=bash
# shellcheck disable=SC2016 # les $set, $push… des scripts mongosh sont des opérateurs MongoDB, pas des variables
# Lab modele-document : la solution passe, sans laisser de trace ; un validateur différent mais conforme passe aussi ; chaque
# faute ciblée (validation modérée, titre facultatif, moyenne fausse, 6 avis, index retiré, profiler coupé, section absente)
# fait échouer son seul check.
catalogue_js() { mongosh --quiet "mongodb://mongo1:27017/valmorin?replicaSet=rs0" "$DBA_ROOT/project/mongo/001_catalogue.js" >/dev/null; }
validateur() { mongo_eval "db.runCommand({ collMod: 'catalogue', validator: { \$jsonSchema: $1 }, validationLevel: '${2:-strict}' }).ok"; }
# Un validateur conforme mais écrit autrement que la solution : annee en number, sans maxItems, peu de champs requis.
VARIANTE="{ bsonType: 'object', required: ['type', 'titre', 'annee'], properties: { type: { bsonType: 'string' }, titre: { bsonType: 'string' }, annee: { bsonType: 'number' } } }"
# La même, sans titre requis : une faute.
SANS_TITRE="{ bsonType: 'object', required: ['type', 'annee'], properties: { type: { bsonType: 'string' }, titre: { bsonType: 'string' }, annee: { bsonType: 'number' } } }"

check "modele-document : tout passe sur la solution" equals "$(failed_ids modele-document)" ""
before="$(mongo_eval 'db.catalogue.countDocuments()')"
check "modele-document : deux lab check de suite, même résultat" equals "$(failed_ids modele-document)" ""
check "modele-document : les checks ne laissent aucun document" equals "$(mongo_eval 'db.catalogue.countDocuments()') $(mongo_eval 'db.catalogue.countDocuments({ _id: 900001 })')" "$before 0"

validateur "$VARIANTE" >/dev/null
check "un validateur conforme écrit autrement : modeliser passe" equals "$(failed_ids modele-document modeliser)" ""
validateur "$VARIANTE" moderate >/dev/null
check "validationLevel moderate → seul validateur-strict échoue" equals "$(failed_ids modele-document modeliser)" validateur-strict
validateur "$SANS_TITRE" >/dev/null
check "titre facultatif → seul rejet-sans-titre échoue" equals "$(failed_ids modele-document modeliser)" rejet-sans-titre
catalogue_js

mongo_eval 'db.runCommand({ update: "catalogue", updates: [{ q: { _id: 1 }, u: { $set: { note_moyenne: 0.5 } } }], bypassDocumentValidation: true }).ok' >/dev/null
check "note_moyenne fausse → seul avis-recents échoue" equals "$(failed_ids modele-document modeliser)" avis-recents
catalogue_js
mongo_eval 'const d = db.catalogue.findOne({ "avis_recents.4": { $exists: true } }); db.runCommand({ update: "catalogue", updates: [{ q: { _id: d._id }, u: { $push: { avis_recents: d.avis_recents[0] } } }], bypassDocumentValidation: true }).ok' >/dev/null
check "6 avis récents → avis-recents et contrat-champs échouent" equals "$(failed_ids modele-document modeliser)" "avis-recents contrat-champs"
catalogue_js

mongo_eval 'db.catalogue.dropIndex({ auteurs: 1, annee: -1 })' >/dev/null
check "index de Q2 retiré → seul q2-index échoue" equals "$(failed_ids modele-document indexer)" q2-index
mongo_eval 'db.setProfilingLevel(0)' >/dev/null
check "profiler coupé → profiler-actif échoue aussi" equals "$(failed_ids modele-document indexer)" "profiler-actif q2-index"
check "profiler coupé : le message dit qu'il se perd au redémarrage" matches "$(failure_of modele-document indexer profiler-actif)" 'redémarrage'
catalogue_js

sed -i "s/^## Choix d.imbrication/## Imbrication/" "$DBA_ROOT/project/mongo/MODELE.md"
check "section renommée → modele-sections la nomme" matches "$(failure_of modele-document justifier modele-sections)" "Choix d'imbrication"
git -C "$DBA_ROOT" checkout -- project/mongo/MODELE.md
check "modele-document : remis en état" equals "$(failed_ids modele-document)" ""
