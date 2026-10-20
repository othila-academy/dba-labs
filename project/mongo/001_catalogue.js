// Le catalogue de l'application : un document par notice, au contrat des champs qu'elle interroge (fiche du lab
// modele-document), construit depuis les exports bruts. Joué par scripts/db rebuild, sur valmorin.
db.catalogue.drop();
const entier = { bsonType: ['int', 'long'] };
const textes = { bsonType: 'array', items: { bsonType: 'string' } };
db.createCollection('catalogue', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['type', 'titre', 'auteurs', 'annee', 'tags', 'avis_recents', 'note_moyenne'],
      properties: {
        type: { enum: ['livre', 'dvd', 'jeu', 'revue'] },
        titre: { bsonType: 'string', minLength: 1 },
        auteurs: textes,
        annee: entier,
        tags: textes,
        avis_recents: {
          bsonType: 'array',
          maxItems: 5,
          items: { bsonType: 'object', required: ['note', 'date', 'texte'], properties: { note: entier, date: { bsonType: 'date' }, texte: { bsonType: 'string' } } }
        },
        note_moyenne: { bsonType: ['double', 'null'] }
      }
    }
  },
  validationLevel: 'strict',
  validationAction: 'error'
});

// Chaque type de notice vers le contrat : le nom d'un jeu devient son titre, ses mots-clés ses tags ; l'année d'une revue
// est celle de sa parution ; un ancien export a écrit certaines années en texte.
db.notices_brutes.aggregate([
  {
    $lookup: {
      from: 'avis_bruts', localField: '_id', foreignField: 'notice_id', as: 'avis',
      pipeline: [{ $sort: { date: -1 } }, { $project: { _id: 0, note: 1, date: 1, texte: 1 } }]
    }
  },
  {
    $project: {
      type: 1,
      titre: { $ifNull: ['$titre', '$nom'] },
      auteurs: {
        $switch: {
          branches: [
            { case: { $eq: ['$type', 'livre'] }, then: { $map: { input: '$auteurs', as: 'a', in: { $concat: ['$$a.prenom', ' ', '$$a.nom'] } } } },
            { case: { $eq: ['$type', 'dvd'] }, then: ['$realisateur'] }
          ],
          default: []
        }
      },
      annee: { $ifNull: [{ $toInt: '$annee' }, { $year: '$parution' }] },
      tags: { $ifNull: ['$tags', '$mots_cles'] },
      // Le motif « subset » : les 5 avis que l'écran affiche ; tous les avis restent dans avis_bruts.
      avis_recents: { $slice: ['$avis', 5] },
      note_moyenne: { $avg: '$avis.note' }
    }
  },
  { $merge: { into: 'catalogue', on: '_id', whenMatched: 'replace', whenNotMatched: 'insert' } }
]);

// Les deux requêtes de l'application : égalité d'abord, puis le tri.
db.catalogue.createIndex({ type: 1, tags: 1, note_moyenne: -1 });
db.catalogue.createIndex({ auteurs: 1, annee: -1 });
// Le profiler note les opérations plus lentes que slowms (100 ms) ; il se perd au redémarrage, d'où sa place ici.
db.setProfilingLevel(1);
print(`catalogue : ${db.catalogue.countDocuments()} documents`);
