import { assert } from '@othila-academy/lab';
import { expectRejected, inRollback, withPg } from '../../shared/db.mjs';
import { FOREIGN_KEYS } from '../../shared/valmorin.mjs';
import { exemplaireRow, fixture, insertSite } from './fixture.mjs';

export const title = 'Les clés étrangères';
export const instructions = `Relie les tables : chaque colonne <table>_id du dictionnaire désigne une ligne d'une autre table, et
la base doit refuser une référence vers une ligne qui n'existe pas. Décide aussi ce qui arrive quand on supprime une ligne
référencée : la fiche dit qu'on ne supprime jamais un adhérent qui a un historique d'emprunts.
Complète 001_schema.sql, puis scripts/db rebuild.

À expliquer (npx lab submit schema cles-etrangeres) : que deviendrait l'historique des prêts avec ON DELETE CASCADE sur emprunt.adherent_id ?`;

export const prediction = {
  promptId: 'schema-suppression-referencee',
  question: 'Sans clause ON DELETE, supprimer un adhérent qui a des emprunts…\n  a) est refusé\n  b) supprime aussi ses emprunts\n  c) laisse des emprunts orphelins',
  choices: ['a', 'b', 'c'],
  expected: 'a'
};

export const checks = [
  {
    id: 'fk-declarees',
    label: 'les 7 clés étrangères du MCD sont déclarées',
    run: () =>
      withPg(async (client) => {
        const { rows } = await client.query(
          `select c.relname as tbl, a.attname as col, r.relname as ref
           from pg_constraint k
           join pg_class c on c.oid = k.conrelid
           join pg_class r on r.oid = k.confrelid
           join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
           where k.contype = 'f' and c.relnamespace = 'public'::regnamespace and cardinality(k.conkey) = 1`
        );
        const declared = new Set(rows.map((r) => `${r.tbl}.${r.col} → ${r.ref}`));
        const missing = FOREIGN_KEYS.map(([t, c, ref]) => `${t}.${c} → ${ref}`).filter((fk) => !declared.has(fk));
        assert(missing.length === 0, `Attendu : une clé étrangère pour chaque lien du MCD. Constaté : il manque ${missing.join(', ')}.`);
      })
  },
  {
    id: 'rejet-exemplaire-orphelin',
    label: 'la base refuse un exemplaire dont l’ouvrage n’existe pas',
    run: () =>
      inRollback(async (client) => {
        const site = await insertSite(client);
        const { rows } = await client.query('select coalesce(max(id), 0) + 1000 as id from ouvrage');
        await expectRejected(client, exemplaireRow(rows[0].id, site), 'un exemplaire dont l’ouvrage n’existe pas');
      })
  },
  {
    id: 'rejet-suppression-adherent',
    label: 'la base refuse de supprimer un adhérent qui a des emprunts',
    run: () =>
      inRollback(async (client) => {
        const { adherent } = await fixture(client);
        await expectRejected(client, { sql: 'delete from adherent where id = $1', params: [adherent] }, 'la suppression d’un adhérent qui a des emprunts');
      })
  }
];

export const hints = [
  'Une colonne qui désigne une ligne d’une autre table : quel mot-clé SQL le dit à la base ?',
  'Une clé étrangère par colonne <table>_id, sept en tout. Sans clause ON DELETE, la suppression d’une ligne référencée est refusée : c’est ce que veut la fiche.',
  'adherent : site_id integer not null references site (id) ; emprunt : adherent_id integer not null references adherent (id) on delete restrict ; idem pour les cinq autres.'
];

export const points = 150;
