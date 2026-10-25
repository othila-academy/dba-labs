import { expectAccepted, expectDenied, inRollback } from '../../shared/db.mjs';
import { EMPRUNT_RENDU, as } from '../../shared/valmorin.mjs';

export const title = 'Le rôle de l’application';
export const explain = 'Quel privilège as-tu refusé à app_valmorin, et quelle erreur ou quelle attaque cela empêche-t-il ?';
export const instructions = `Crée dans 010_roles.sql le rôle app_valmorin, celui de l'application des médiathèques, avec le mot de
passe de lab app-valmorin-lab. L'application lit et modifie les données de toutes les tables (inscriptions, prêts, retours),
mais elle ne change jamais la structure de la base et ne supprime jamais une table. Puis scripts/db rebuild, et essaie en te
connectant avec lui : psql -h pg -U app_valmorin -d valmorin (il demande le mot de passe de lab). scripts/db psql, lui, envoie
toujours le mot de passe de postgres : il ne sert qu'à postgres.

À expliquer (npx lab submit roles application) : quel privilège as-tu refusé à app_valmorin, et quelle erreur ou quelle attaque cela empêche-t-il ?`;

export const prediction = {
  promptId: 'roles-drop-application',
  question: 'app_valmorin a SELECT, INSERT, UPDATE et DELETE sur emprunt. Peut-il faire DROP TABLE emprunt ?',
  choices: ['oui', 'non'],
  expected: 'non'
};

const app = (fn) => () => inRollback(fn, as('app_valmorin'));

export const checks = [
  {
    id: 'app-insere',
    label: 'app_valmorin enregistre un emprunt (transaction annulée)',
    run: app((client) => expectAccepted(client, EMPRUNT_RENDU, 'un emprunt enregistré par app_valmorin'))
  },
  {
    id: 'app-lit',
    label: 'app_valmorin lit les coordonnées des adhérents (email, téléphone)',
    run: app((client) => expectAccepted(client, 'select email, telephone from adherent limit 1', 'la lecture des coordonnées par app_valmorin'))
  },
  {
    id: 'app-sans-ddl',
    label: 'app_valmorin ne peut pas créer de table',
    run: app((client) => expectDenied(client, 'create table check_app (id integer)', 'créer une table'))
  },
  {
    id: 'app-sans-drop',
    label: 'app_valmorin ne peut pas supprimer la table emprunt',
    run: app((client) => expectDenied(client, 'drop table emprunt', 'supprimer la table emprunt'))
  }
];

export const hints = [
  'Ce que l’application fait aux lignes et ce qu’elle fait à la structure ne relèvent pas des mêmes privilèges. Lesquels GRANT donne-t-il sur une table ?',
  'grant select, insert, update, delete sur les tables ; la structure (create, alter, drop) reste au propriétaire, dba_valmorin.',
  'create role app_valmorin login password \'app-valmorin-lab\'; grant select, insert, update, delete on all tables in schema public to app_valmorin; grant usage on all sequences in schema public to app_valmorin;'
];

export const points = 150;
