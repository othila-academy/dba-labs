import { assert } from '@othila-academy/lab';
import { APP_MONGO, withLegacyMongo } from './legacy.mjs';

export const title = 'L’authentification de MongoDB';
export const instructions = `mongo-legacy accepte tout le monde, sans identifiants. Dans project/legacy/mongo/ :
  - mongod.conf : security.authorization: enabled ;
  - init.js, joué par scripts/db rebuild depuis le conteneur, par l'exception localhost (tant qu'aucun utilisateur n'existe,
    une connexion locale peut créer le premier) : crée d'abord l'administrateur (admin, mot de passe admin-legacy-lab, rôle
    root, dans la base admin) et authentifie-toi avec lui ; puis crée l'utilisateur de l'application (app_mediatheque, mot de
    passe mediatheque2019, dans la base mediatheque, avec le seul rôle readWrite sur mediatheque) ; enfin, les données.
Puis scripts/db rebuild, et : mongosh "mongodb://mongo-legacy:27017/?directConnection=true" --eval 'db.adminCommand({ listDatabases: 1 })'.

À expliquer (npx lab submit durcissement mongo) : pourquoi l'exception localhost devient-elle un risque si l'on oublie de créer l'administrateur ?`;

export const checks = [
  {
    id: 'mongo-authentification',
    label: 'mongo-legacy refuse de lister ses bases à une connexion sans identifiants',
    run: () =>
      withLegacyMongo(async (client) => {
        let bases;
        try {
          bases = await client.db('admin').command({ listDatabases: 1, nameOnly: true });
        } catch (error) {
          if (error.code === 13) return;
          throw new Error(`Attendu : un refus (Unauthorized). Constaté : une autre erreur (« ${error.message} »).`);
        }
        throw new Error(`Attendu : un refus sans identifiants. Constaté : on liste ${bases.databases.map((d) => d.name).join(', ')}. security.authorization est-il actif ?`);
      })
  },
  {
    id: 'mongo-utilisateur-applicatif',
    label: 'app_mediatheque se connecte à mongo-legacy, lit ses prêts, et n’a que readWrite sur mediatheque',
    run: async () => {
      let roles = null;
      let refus = null;
      for (const authSource of ['mediatheque', 'admin']) {
        try {
          roles = await withLegacyMongo(async (client) => {
            const status = await client.db('mediatheque').command({ connectionStatus: 1 });
            await client.db('mediatheque').collection('prets').countDocuments();
            return status.authInfo.authenticatedUserRoles;
          }, { auth: APP_MONGO, authSource });
          break;
        } catch (error) {
          if (error.code !== 18) throw new Error(error.message.startsWith('le serveur hérité') ? error.message : `Attendu : app_mediatheque lit les prêts. Constaté : « ${error.message} ».`);
          refus = error;
        }
      }
      assert(roles, `Attendu : app_mediatheque se connecte avec le mot de passe de la fiche. Constaté : refus (« ${refus?.message} »). L'utilisateur existe-t-il, dans la base mediatheque ?`);
      const vus = roles.map((r) => `${r.role}@${r.db}`).sort();
      assert(vus.length === 1 && vus[0] === 'readWrite@mediatheque', `Attendu : le seul rôle readWrite sur mediatheque. Constaté : ${vus.join(', ') || 'aucun'}.`);
    }
  }
];

export const hints = [
  'Sans authorization, MongoDB ne vérifie personne. Avec, il faut un premier utilisateur : qui peut le créer, et depuis où ?',
  "admin = db.getSiblingDB('admin') ; admin.createUser({ user: 'admin', pwd: '…', roles: ['root'] }) ; admin.auth('admin', '…') ; db.getSiblingDB('mediatheque').createUser({ user: 'app_mediatheque', pwd: '…', roles: [{ role: 'readWrite', db: 'mediatheque' }] }).",
  "mongod.conf : security: { authorization: enabled }. init.js : les deux createUser et l'auth ci-dessus, en tête, puis le drop et l'insertMany des prêts, inchangés."
];

export const points = 150;
