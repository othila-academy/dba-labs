// Les données que l'ancien prestataire a laissées dans le MongoDB hérité.
const mediatheque = db.getSiblingDB('mediatheque');
mediatheque.prets.drop();
mediatheque.prets.insertMany([
  { abonne: 'durand@valmorin.example', titre: 'Le port oublié', rendu: false },
  { abonne: 'leroy@valmorin.example', titre: 'La forêt du nord', rendu: true }
]);
