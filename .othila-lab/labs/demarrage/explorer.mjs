import { assert } from '@othila-academy/lab';
import { readEnv, withMongo, withPg } from '../../shared/db.mjs';

export const title = 'Faire le tour de la stack';
export const explain = "Rs0 est un « replica set » d'un seul nœud. Pourquoi a-t-il quand même un primaire, et à quoi sert-il de démarrer ainsi ?";
export const instructions = `Dans le terminal du devcontainer, lance scripts/db status : il liste les services, leur santé, la
version de PostgreSQL et le rôle de chaque nœud MongoDB. Connecte-toi ensuite à chaque base :
  scripts/db psql       puis \\l (les bases), \\du (les rôles), \\q pour sortir
  scripts/db mongosh    puis rs.status().members, show dbs, exit
Depuis le devcontainer, PostgreSQL s'appelle pg (port 5432) et MongoDB mongo1 (port 27017) : rien n'est publié sur ta machine.

À expliquer (npx lab submit demarrage explorer) : rs0 est un « replica set » d'un seul nœud. Pourquoi a-t-il quand même un primaire, et à quoi sert-il de démarrer ainsi ?`;

export const prediction = {
  promptId: 'demarrage-bases-neuves',
  question: 'Combien de bases \\l liste-t-il sur un serveur PostgreSQL neuf ?',
  choices: ['1', '3', '4'],
  expected: '3'
};

// La version majeure du cours : celle de l'image épinglée dans infra/images.env.
const expectedMajor = () => Number(/postgres:(\d+)/.exec(readEnv('infra/images.env').DBA_PG_IMAGE)?.[1]);

export const checks = [
  {
    id: 'pg-repond',
    label: 'PostgreSQL répond depuis le devcontainer, dans la version majeure du cours',
    passesOnStart: true,
    run: () =>
      withPg(
        async (client) => {
          const { rows } = await client.query('show server_version_num');
          const major = Math.floor(Number(rows[0].server_version_num) / 10000);
          assert(
            major === expectedMajor(),
            `Attendu : PostgreSQL ${expectedMajor()}. Constaté : PostgreSQL ${major}. L'image vient de infra/images.env : scripts/db rebuild la reprend.`
          );
        },
        { database: 'postgres' }
      )
  },
  {
    id: 'rs0-primaire',
    label: 'le replica set rs0 de MongoDB a un primaire',
    passesOnStart: true,
    run: () =>
      withMongo(async (client) => {
        let status;
        try {
          status = await client.db('admin').command({ replSetGetStatus: 1 });
        } catch (error) {
          throw new Error(`Attendu : rs0 initialisé. Constaté : « ${error.message} ». scripts/db rebuild l'initialise.`);
        }
        assert(
          status.members.some((m) => m.stateStr === 'PRIMARY'),
          `Attendu : un membre PRIMARY. Constaté : ${status.members.map((m) => `${m.name} ${m.stateStr}`).join(', ')}. Une élection prend quelques secondes : relance le check.`
        );
      })
  }
];

export const hints = [
  'scripts/db help liste les commandes : laquelle montre l’état de chaque service ?',
  'scripts/db status, puis scripts/db psql et scripts/db mongosh : ils lisent pour toi les identifiants de infra/.env.lab.',
  'Si un check dit « les bases ne répondent pas » : scripts/db up. Si rs0 n’a pas de primaire : scripts/db rebuild, qui l’initialise.'
];

export const points = 50;
