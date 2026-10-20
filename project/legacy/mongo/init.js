// Le MongoDB hérité, avec authentification : l'administrateur d'abord (exception localhost), puis l'utilisateur de
// l'application, limité à readWrite sur sa base, et enfin ses données.
const admin = db.getSiblingDB('admin');
admin.createUser({ user: 'admin', pwd: 'admin-legacy-lab', roles: ['root'] });
admin.auth('admin', 'admin-legacy-lab');
const mediatheque = db.getSiblingDB('mediatheque');
mediatheque.createUser({ user: 'app_mediatheque', pwd: 'mediatheque2019', roles: [{ role: 'readWrite', db: 'mediatheque' }] });
mediatheque.prets.drop();
mediatheque.prets.insertMany([
  { abonne: 'durand@valmorin.example', titre: 'Le port oublié', rendu: false },
  { abonne: 'leroy@valmorin.example', titre: 'La forêt du nord', rendu: true }
]);
