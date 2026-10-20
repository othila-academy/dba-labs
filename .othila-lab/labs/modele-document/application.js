// Les deux requêtes de l'application : scripts/db mongosh .othila-lab/labs/modele-document/application.js
// Pour lire le plan d'une requête : remplace .toArray() par .explain('executionStats').
// Q1, les mieux notés d'un thème :
printjson(db.catalogue.find({ type: 'livre', tags: 'policier' }).sort({ note_moyenne: -1 }).limit(10).toArray().map((d) => d.titre));
// Q2, les œuvres d'un auteur, des plus récentes aux plus anciennes :
print(`${db.catalogue.find({ auteurs: 'Claire Faure' }).sort({ annee: -1 }).toArray().length} œuvres de Claire Faure`);
