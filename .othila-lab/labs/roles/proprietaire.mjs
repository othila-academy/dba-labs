import { assert } from '@othila-academy/lab';
import { expectAccepted, inRollback, withPg } from '../../shared/db.mjs';
import { TABLE_NAMES, as } from '../../shared/valmorin.mjs';

export const title = 'Le propriétaire du schéma';
export const explain = 'Dba_valmorin administre la base ; pourquoi ne pas en faire un superutilisateur ?';
export const instructions = `Crée project/schema/010_roles.sql : scripts/db rebuild le joue sur valmorin, après 001_schema.sql.
Crée le rôle dba_valmorin, qui se connecte avec le mot de passe de lab dba-valmorin-lab. Il possède les 7 tables et peut créer
de nouveaux objets dans le schéma public, mais il n'est ni superutilisateur, ni capable de créer des rôles ou des bases.
Repère : 001_schema.sql est joué par postgres, qui possède donc les 7 tables ; la propriété d'un objet existant se transfère
(alter table <table> owner to <rôle>).
Puis scripts/db rebuild, et essaie : psql -h pg -U dba_valmorin -d valmorin (le mot de passe est demandé).

À expliquer (npx lab submit roles proprietaire) : dba_valmorin administre la base ; pourquoi ne pas en faire un superutilisateur ?`;

export const prediction = {
  promptId: 'roles-superuser-proprietaire',
  question: 'Une fois emprunt passée à dba_valmorin, postgres peut-il encore la lire ?',
  choices: ['oui', 'non'],
  expected: 'oui'
};

export const checks = [
  {
    id: 'dba-connecte',
    label: 'dba_valmorin se connecte à valmorin avec son mot de passe de lab',
    run: () => withPg(async () => {}, as('dba_valmorin'))
  },
  {
    id: 'dba-proprietaire',
    label: 'dba_valmorin possède les 7 tables du dictionnaire',
    run: () =>
      withPg(async (client) => {
        const { rows } = await client.query(
          `select c.relname as tbl, pg_get_userbyid(c.relowner) as owner from pg_class c
           where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and c.relname = any ($1)`,
          [TABLE_NAMES]
        );
        const others = rows.filter((r) => r.owner !== 'dba_valmorin').map((r) => `${r.tbl} (${r.owner})`);
        assert(rows.length === TABLE_NAMES.length, `Attendu : les 7 tables du dictionnaire. Constaté : ${rows.length}.`);
        assert(others.length === 0, `Attendu : dba_valmorin propriétaire. Constaté : ${others.join(', ')}. \\dt dans scripts/db psql postgres valmorin montre le propriétaire de chaque table.`);
      })
  },
  {
    id: 'dba-cree',
    label: 'dba_valmorin peut créer une table dans le schéma public (transaction annulée)',
    run: () => inRollback((client) => expectAccepted(client, 'create table check_dba (id integer)', 'une table créée par dba_valmorin dans public'), as('dba_valmorin'))
  },
  {
    id: 'dba-sans-pouvoirs',
    label: 'dba_valmorin n’est ni superutilisateur, ni CREATEROLE, ni CREATEDB, ni BYPASSRLS',
    run: () =>
      withPg(async (client) => {
        const { rows } = await client.query(
          "select rolsuper, rolcreaterole, rolcreatedb, rolbypassrls from pg_roles where rolname = 'dba_valmorin'"
        );
        assert(rows.length === 1, 'Attendu : un rôle dba_valmorin. Constaté : absent.');
        const powers = Object.entries(rows[0]).filter(([, on]) => on).map(([name]) => name.replace(/^rol/, '').toUpperCase());
        assert(powers.length === 0, `Attendu : aucun pouvoir sur le serveur. Constaté : ${powers.join(', ')}. \\du dans psql liste les attributs des rôles.`);
      })
  },
  {
    id: 'aucun-superuser',
    label: 'aucun rôle, hors postgres, n’est superutilisateur',
    passesOnStart: true,
    run: () =>
      withPg(async (client) => {
        const { rows } = await client.query("select rolname from pg_roles where rolsuper and rolname <> 'postgres'");
        assert(rows.length === 0, `Attendu : postgres seul superutilisateur. Constaté : aussi ${rows.map((r) => r.rolname).join(', ')}.`);
      })
  }
];

export const hints = [
  'Un rôle qui se connecte, c’est un rôle avec LOGIN. Qui possède une table, et comment changer de propriétaire ?',
  'create role … login password … ; alter table … owner to … pour chacune des 7 tables ; le droit de créer dans un schéma s’accorde par grant … on schema public.',
  'create role dba_valmorin login password \'dba-valmorin-lab\'; alter table site owner to dba_valmorin; (et les 6 autres) ; grant usage, create on schema public to dba_valmorin;'
];

export const points = 100;
