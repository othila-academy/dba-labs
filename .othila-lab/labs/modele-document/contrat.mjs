// Le contrat des champs que l'application interroge, tel que la fiche le décrit : un document du catalogue, vu des checks.
// Il sert de requête ($jsonSchema) pour trouver les documents qui s'en écartent.
const ENTIER = { bsonType: ['int', 'long'] };
const TEXTES = { bsonType: 'array', items: { bsonType: 'string' } };
export const CONTRAT = {
  bsonType: 'object',
  required: ['_id', 'type', 'titre', 'auteurs', 'annee', 'tags', 'avis_recents', 'note_moyenne'],
  properties: {
    _id: ENTIER,
    type: { enum: ['livre', 'dvd', 'jeu', 'revue'] },
    titre: { bsonType: 'string', minLength: 1 },
    auteurs: TEXTES,
    annee: ENTIER,
    tags: TEXTES,
    avis_recents: {
      bsonType: 'array',
      maxItems: 5,
      items: { bsonType: 'object', required: ['note', 'date', 'texte'], properties: { note: ENTIER, date: { bsonType: 'date' }, texte: { bsonType: 'string' } } }
    },
    note_moyenne: { bsonType: ['double', 'int', 'long', 'decimal', 'null'] }
  }
};
// Un document au contrat, que tout validateur conforme accepte (inséré dans une transaction annulée).
export const VALIDE = () => ({
  _id: 900001,
  type: 'livre',
  titre: 'Le check du soir',
  auteurs: ['Anne Arnaud'],
  annee: 2024,
  tags: ['roman'],
  avis_recents: [{ note: 4, date: new Date('2026-10-01T00:00:00Z'), texte: 'Bien.' }],
  note_moyenne: 4.5
});
