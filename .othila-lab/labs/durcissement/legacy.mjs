// Le serveur hérité vu des checks du lab durcissement : pg-legacy et mongo-legacy, sur le réseau dba-net.
import { MongoClient } from 'mongodb';
import { DOWN, TIMEOUT_MS, withPg } from '../../shared/db.mjs';

export const LEGACY_DOWN =
  'le serveur hérité ne répond pas : legacy est-il dans project/stack.env (COMPOSE_PROFILES=rs,legacy) ? Puis scripts/db rebuild';
// L'application garde son mot de passe : l'équipe applicative ne peut pas le changer aujourd'hui (fiche, étape authentification).
export const APP_PG = { user: 'app_mediatheque', password: 'mediatheque2019', database: 'mediatheque' };
export const APP_MONGO = { username: 'app_mediatheque', password: 'mediatheque2019' };

const sansSsl = (error) => /does not support SSL/i.test(error.message);
const panne = (error) => (error.message === DOWN ? new Error(LEGACY_DOWN) : error);

// Une connexion à pg-legacy, chiffrée si le serveur le permet, en clair sinon (comme sslmode=prefer de libpq).
export async function withLegacyPg(fn, options = {}) {
  const opts = { host: 'pg-legacy', database: 'postgres', ...options };
  try {
    try {
      return await withPg(fn, { ...opts, ssl: { rejectUnauthorized: false } });
    } catch (error) {
      if (!sansSsl(error)) throw error;
      return await withPg(fn, { ...opts, ssl: false });
    }
  } catch (error) {
    throw panne(error);
  }
}

// Un client de mongo-legacy ouvert le temps de fn. Une panne réseau donne LEGACY_DOWN ; un refus d'authentification
// (code 18) ou un échec TLS remonte tel quel, pour que le check le dise.
export async function withLegacyMongo(fn, options = {}) {
  const client = new MongoClient('mongodb://mongo-legacy:27017/?directConnection=true', {
    serverSelectionTimeoutMS: TIMEOUT_MS, connectTimeoutMS: TIMEOUT_MS, socketTimeoutMS: TIMEOUT_MS, ...options
  });
  try {
    try {
      await client.connect();
    } catch (error) {
      if (error.code === 18 || options.tls) throw error;
      throw new Error(LEGACY_DOWN);
    }
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}
