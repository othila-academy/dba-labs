// Les bases du cours, vues d'un check : identifiants de infra/.env.lab, 5 s au plus par opération, connexions
// toujours fermées, transactions annulées, et un seul message quand les bases ne répondent pas, le même pour tous les checks.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { MongoClient } from 'mongodb';

// La racine du cours, ou du worktree de rejeu : ce module est dans .othila-lab/shared/.
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const TIMEOUT_MS = 5000;
export const DOWN =
  'les bases ne répondent pas : dans le terminal du devcontainer, lance scripts/db up (ou scripts/db rebuild), puis relance le check';

// Un fichier CLE=valeur du cours (infra/.env.lab, infra/images.env), relatif à la racine.
export function readEnv(relative) {
  const env = {};
  for (const raw of readFileSync(path.join(ROOT, relative), 'utf8').split('\n')) {
    const line = raw.trim();
    const at = line.indexOf('=');
    if (!line || line.startsWith('#') || at < 1) continue;
    env[line.slice(0, at)] = line.slice(at + 1);
  }
  return env;
}

const UNREACHABLE = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', '57P03']);

// Une erreur de connexion à PostgreSQL, dite à l'apprenant ; null si elle n'est pas prévue ici.
export function connectionMessage(error, { user, database }) {
  if (UNREACHABLE.has(error.code) || /timeout|terminated/i.test(error.message ?? '')) return DOWN;
  if (error.code === '3D000')
    return `la base ${database} n'existe pas : un fichier de project/schema la crée-t-il, et as-tu relancé scripts/db rebuild ?`;
  if (error.code === '28P01')
    return `${user} ne se connecte pas avec le mot de passe de la fiche : le rôle existe-t-il, avec LOGIN et ce mot de passe ?`;
  if (error.code === '28000') return `${user} ne peut pas se connecter (« ${error.message} ») : regarde ses attributs avec \\du dans psql`;
  return null;
}

// Un client PostgreSQL ouvert le temps de fn, fermé ensuite quoi qu'il arrive.
export async function withPg(fn, { user = 'postgres', password, database = 'valmorin', host = 'pg' } = {}) {
  const client = new pg.Client({
    host,
    port: 5432,
    user,
    database,
    password: password ?? readEnv('infra/.env.lab').POSTGRES_PASSWORD,
    connectionTimeoutMillis: TIMEOUT_MS,
    statement_timeout: TIMEOUT_MS,
    query_timeout: TIMEOUT_MS + 1000,
    application_name: 'lab-check'
  });
  client.on('error', () => {}); // une coupure après la fin du check ne doit pas faire tomber lab check
  try {
    await client.connect();
  } catch (error) {
    await client.end().catch(() => {});
    throw new Error(connectionMessage(error, { user, database }) ?? `connexion de ${user} à ${database} impossible : ${error.message}`);
  }
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => {});
  }
}

// fn joue dans une transaction toujours annulée : le check ne laisse aucune trace.
export function inRollback(fn, options) {
  return withPg(async (client) => {
    await client.query('begin');
    try {
      return await fn(client);
    } finally {
      await client.query('rollback').catch(() => {});
    }
  }, options);
}

const asQuery = (q) => (typeof q === 'string' ? { sql: q, params: [] } : q);

// La requête doit passer ; sinon, l'erreur de la base est citée.
export async function expectAccepted(client, q, what) {
  const { sql, params } = asQuery(q);
  try {
    return await client.query(sql, params);
  } catch (error) {
    throw new Error(`Attendu : la base accepte ${what}. Constaté : elle refuse (« ${error.message} »).`);
  }
}

// La requête doit échouer avec un code que accepts reconnaît ; un savepoint garde la transaction utilisable.
async function expectError(client, q, accepts, accepted, other) {
  const { sql, params } = asQuery(q);
  await client.query('savepoint lab_check');
  try {
    await client.query(sql, params);
  } catch (error) {
    await client.query('rollback to savepoint lab_check');
    if (accepts(error.code ?? '')) return error;
    throw new Error(other(error));
  }
  await client.query('rollback to savepoint lab_check');
  throw new Error(accepted);
}

// Un refus par une règle du schéma : intégrité (23…), valeur hors d'un type énuméré (22P02), exception d'un déclencheur (P0001).
const RULE = (code) => code.startsWith('23') || code === '22P02' || code === 'P0001';

export const expectRejected = (client, q, what) =>
  expectError(
    client,
    q,
    RULE,
    `Attendu : la base refuse ${what}. Constaté : elle l'accepte. Quelle règle de la fiche l'interdit ?`,
    (error) => `Attendu : la base refuse ${what} par une règle du schéma. Constaté : une autre erreur (« ${error.message} ») : relis les noms du dictionnaire.`
  );

// Un refus faute de privilège (42501).
export const expectDenied = (client, q, what) =>
  expectError(
    client,
    q,
    (code) => code === '42501',
    `Attendu : ${client.user} n'a pas le droit de ${what}. Constaté : c'est permis. D'où lui vient ce droit ?`,
    (error) => `Attendu : ${client.user} n'a pas le droit de ${what}. Constaté : une autre erreur (« ${error.message} »).`
  );

// Un client MongoDB ouvert le temps de fn ; par défaut, directement sur mongo1.
export async function withMongo(fn, { uri = 'mongodb://mongo1:27017/?directConnection=true' } = {}) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: TIMEOUT_MS, connectTimeoutMS: TIMEOUT_MS, socketTimeoutMS: TIMEOUT_MS });
  try {
    try {
      await client.connect();
    } catch {
      throw new Error(DOWN);
    }
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

// fn joue dans une transaction MongoDB toujours annulée : le check ne laisse aucune trace (rs0 est un replica set).
export async function inAbortedTransaction(client, fn) {
  const session = client.startSession();
  session.startTransaction();
  try {
    return await fn(session);
  } finally {
    await session.abortTransaction().catch(() => {});
    await session.endSession().catch(() => {});
  }
}
