import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { assert } from '@othila-academy/lab';
import { ROOT, withPg } from '../../shared/db.mjs';

export const title = 'Créer la base valmorin';
export const instructions = `Crée la base valmorin dans un fichier : project/schema/000_database.sql. scripts/db rebuild joue les
fichiers de project/schema dans l'ordre de leur nom : ceux qui commencent par 000_ sur la base postgres (une base se crée
depuis une autre), les suivants sur valmorin. Lance scripts/db rebuild, puis vérifie avec \\l dans scripts/db psql.
Essaie aussi l'inverse : crée une base essai à la main dans psql, puis relance scripts/db rebuild. Où est-elle passée ?

À expliquer (npx lab submit demarrage base) : pourquoi décrire la base dans un fichier plutôt que la créer dans psql ?`;

export const prediction = {
  promptId: 'demarrage-base-a-la-main',
  question: 'Une base créée à la main dans psql existe-t-elle encore après scripts/db rebuild ?',
  choices: ['oui', 'non'],
  expected: 'non'
};

export const checks = [
  {
    id: 'fichier-000',
    label: 'un fichier project/schema/000_*.sql existe : scripts/db rebuild le rejoue sur la base postgres',
    run: async () => {
      const dir = path.join(ROOT, 'project/schema');
      const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^000_.*\.sql$/.test(f)) : [];
      assert(
        files.length > 0,
        'Attendu : un fichier project/schema/000_<nom>.sql. Constaté : aucun. Ce que scripts/db rebuild ne rejoue pas disparaît au rebuild suivant.'
      );
    }
  },
  {
    id: 'base-valmorin',
    label: 'la base valmorin existe',
    run: () =>
      withPg(
        async (client) => {
          const { rows } = await client.query("select 1 from pg_database where datname = 'valmorin'");
          assert(
            rows.length === 1,
            'Attendu : une base valmorin. Constaté : absente. As-tu relancé scripts/db rebuild après avoir écrit le fichier ? Sa sortie (étape 3/9) dit quels fichiers elle joue.'
          );
        },
        { database: 'postgres' }
      )
  }
];

export const hints = [
  'Quels fichiers scripts/db rebuild joue-t-il, et sur quelle base ? Sa sortie le dit, à l’étape 3/9.',
  'Un fichier project/schema/000_database.sql, avec une seule instruction SQL qui crée une base ; puis scripts/db rebuild.',
  'project/schema/000_database.sql contient : create database valmorin; puis scripts/db rebuild, et \\l dans scripts/db psql.'
];

export const points = 100;
