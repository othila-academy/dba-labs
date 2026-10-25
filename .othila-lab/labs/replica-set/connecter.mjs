import { existsSync } from 'node:fs';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { assert } from '@othila-academy/lab';
import { ROOT, TIMEOUT_MS, readEnv } from '../../shared/db.mjs';
import { parseMongoUri } from './rs.mjs';

export const title = 'Facultatif : connecter l’application';
export const explain = 'Pourquoi lister les trois hôtes, si le pilote découvre tout seul les membres de rs0 ?';
export const instructions = `Facultatif. L'application a besoin de sa chaîne de connexion. Écris project/app.env, au format CLE=valeur :
  MONGO_URI=mongodb://…
Elle liste les trois membres et nomme le replica set : le pilote les essaie tous, trouve le primaire, et suit les élections.
Essaie-la : mongosh "<ta chaîne>" --eval 'db.hello().primary'.

À expliquer (npx lab submit replica-set connecter) : pourquoi lister les trois hôtes, si le pilote découvre tout seul les membres de rs0 ?`;

const APP_ENV = path.join(ROOT, 'project/app.env');
const HOTES = ['mongo1:27017', 'mongo2:27017', 'mongo3:27017'];

function mongoUri() {
  assert(existsSync(APP_ENV), 'Attendu : project/app.env, avec une ligne MONGO_URI=mongodb://… Constaté : absent.');
  const uri = readEnv('project/app.env').MONGO_URI;
  assert(uri, 'Attendu : une ligne MONGO_URI=mongodb://… dans project/app.env. Constaté : absente.');
  return uri;
}

export const checks = [
  {
    id: 'mongo-uri',
    label: 'project/app.env donne un MONGO_URI qui liste mongo1, mongo2 et mongo3 et nomme replicaSet=rs0',
    run: async () => {
      const uri = mongoUri();
      const parsed = parseMongoUri(uri);
      assert(parsed, `Attendu : une chaîne mongodb://hôte:port,hôte:port,…/?replicaSet=rs0. Constaté : « ${uri} ».`);
      const manquent = HOTES.filter((h) => !parsed.hosts.includes(h));
      assert(manquent.length === 0, `Attendu : les trois membres dans MONGO_URI. Constaté : il manque ${manquent.join(', ')}. Si ce seul hôte tombe au démarrage de l'application ?`);
      assert(parsed.options.get('replicaSet') === 'rs0', `Attendu : replicaSet=rs0 dans les options de MONGO_URI. Constaté : ${parsed.options.get('replicaSet') ?? 'absent'}.`);
    }
  },
  {
    id: 'mongo-uri-connecte',
    label: 'MONGO_URI permet de se connecter à rs0',
    run: async () => {
      const uri = mongoUri();
      let hello;
      let client;
      try {
        client = new MongoClient(uri, { serverSelectionTimeoutMS: TIMEOUT_MS, connectTimeoutMS: TIMEOUT_MS });
        await client.connect();
        hello = await client.db('admin').command({ hello: 1 });
      } catch (error) {
        throw new Error(`Attendu : une connexion à rs0 par MONGO_URI. Constaté : « ${error.message} ». Essaie-la avec mongosh.`);
      } finally {
        await client?.close().catch(() => {});
      }
      assert(hello.setName === 'rs0', `Attendu : le replica set rs0. Constaté : ${hello.setName ?? 'un serveur seul'}.`);
    }
  }
];

export const hints = [
  'Une chaîne de connexion à un replica set nomme plusieurs hôtes, séparés par des virgules, et une option qui dit le nom du set.',
  'mongodb://hôte1:port,hôte2:port,hôte3:port/base?replicaSet=… ; les noms sont ceux de dba-net : mongo1, mongo2, mongo3.',
  'MONGO_URI=mongodb://mongo1:27017,mongo2:27017,mongo3:27017/valmorin?replicaSet=rs0'
];

export const points = 75;
