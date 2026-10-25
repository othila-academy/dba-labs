// Squelette de project/mongo/001_catalogue.js. Copie-le : cp .othila-lab/labs/modele-document/catalogue-squelette.js project/mongo/001_catalogue.js
// Le validateur est écrit ; le pipeline est à compléter aux endroits « À COMPLÉTER ».
// Pour l'essayer sans tout reconstruire : scripts/db mongosh project/mongo/001_catalogue.js (il recrée catalogue à chaque fois).
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

// Une notice brute devient un document du contrat (lis infra/seed/CONTRAT.md : les types ne se ressemblent pas).
db.notices_brutes.aggregate([
  {
    $lookup: {
      from: 'avis_bruts', localField: '_id', foreignField: 'notice_id', as: 'avis',
      pipeline: [
        // À COMPLÉTER : trier les avis, du plus récent au plus ancien ($sort sur date).
        { $project: { _id: 0, note: 1, date: 1, texte: 1 } }
      ]
    }
  },
  {
    $project: {
      type: 1,
      titre: '$titre', // À COMPLÉTER : un jeu n'a pas de titre, mais un nom ($ifNull)
      auteurs: [], // À COMPLÉTER : « Prénom Nom » des auteurs d'un livre ($map, $concat), [réalisateur] pour un DVD, [] sinon ($switch)
      annee: '$annee', // À COMPLÉTER : toujours un entier ($toInt) ; pour une revue, l'année de sa parution ($year)
      tags: '$tags', // À COMPLÉTER : les mots_cles, pour un jeu ($ifNull)
      avis_recents: [], // À COMPLÉTER : les 5 avis les plus récents ($slice sur '$avis')
      note_moyenne: null // À COMPLÉTER : la moyenne de toutes les notes ($avg sur '$avis.note')
    }
  },
  { $merge: { into: 'catalogue', on: '_id', whenMatched: 'replace', whenNotMatched: 'insert' } }
]);

// Étape indexer : les index des deux requêtes, et le profiler, ici.

print(`catalogue : ${db.catalogue.countDocuments()} documents`);
