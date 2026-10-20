// Les aides communes des checks, contre la vraie stack (scripts/db up) et contre des hôtes injoignables.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  DOWN, connectionMessage, expectRejected, inRollback, readEnv, withMongo, withPg
} from '../../.othila-lab/shared/db.mjs';
import { seqScansOn } from '../../.othila-lab/shared/plan.mjs';
import { gitStatusOf, latestFile, missingSections } from '../../.othila-lab/shared/fichiers.mjs';
import { Q1, Q2 } from '../../.othila-lab/labs/requete-lente/requetes.mjs';

test('readEnv lit les identifiants de lab', () => {
  assert.equal(readEnv('infra/.env.lab').POSTGRES_PASSWORD, 'valmorin-lab');
});

test('connectionMessage : une panne réseau donne le message unique', () => {
  for (const code of ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', '57P03']) {
    assert.equal(connectionMessage({ code, message: '' }, {}), DOWN, code);
  }
  assert.equal(connectionMessage({ message: 'Connection terminated due to connection timeout' }, {}), DOWN);
});

test('connectionMessage : base absente, mot de passe refusé, autre erreur', () => {
  assert.match(connectionMessage({ code: '3D000', message: '' }, { database: 'valmorin' }), /la base valmorin n'existe pas/);
  assert.match(connectionMessage({ code: '28P01', message: '' }, { user: 'analyste' }), /^analyste ne se connecte pas/);
  assert.equal(connectionMessage({ code: '42P01', message: '' }, {}), null);
});

test('withPg : un hôte injoignable donne DOWN, en moins de 6 s', async () => {
  const started = Date.now();
  await assert.rejects(withPg(async () => {}, { host: 'nope.invalid' }), { message: DOWN });
  assert.ok(Date.now() - started < 6000);
});

test('withMongo : un hôte injoignable donne DOWN', async () => {
  await assert.rejects(
    withMongo(async () => {}, { uri: 'mongodb://nope.invalid:27017/?directConnection=true' }),
    { message: DOWN }
  );
});

test('inRollback ne laisse aucune trace', async () => {
  await inRollback((c) => c.query('create table lab_trace (x int)'), { database: 'postgres' });
  const { rows } = await withPg((c) => c.query("select to_regclass('lab_trace') as t"), { database: 'postgres' });
  assert.equal(rows[0].t, null);
});

test('expectRejected : refus par une règle, acceptation, autre erreur', async () => {
  await inRollback(async (c) => {
    await c.query('create temp table r (x int check (x > 0))');
    await expectRejected(c, 'insert into r values (-1)', 'un x négatif');
    await assert.rejects(expectRejected(c, 'insert into r values (1)', 'un x positif'), /Constaté : elle l'accepte/);
    await assert.rejects(expectRejected(c, 'insert into r (y) values (1)', 'une colonne inconnue'), /une autre erreur/);
  }, { database: 'postgres' });
});

test('seqScansOn trouve un Seq Scan imbriqué, et seulement sur la table demandée', () => {
  const plan = {
    'Node Type': 'Hash Join',
    Plans: [
      { 'Node Type': 'Seq Scan', 'Relation Name': 'exemplaire' },
      { 'Node Type': 'Hash', Plans: [{ 'Node Type': 'Seq Scan', 'Relation Name': 'emprunt' }] }
    ]
  };
  assert.equal(seqScansOn(plan, 'emprunt').length, 1);
  assert.equal(seqScansOn(plan, 'site').length, 0);
});

test('application.sql joue mot pour mot Q1 et Q2', () => {
  const sql = readFileSync(new URL('../../.othila-lab/labs/requete-lente/application.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes(`${Q1};`), 'Q1');
  assert.ok(sql.includes(`${Q2};`), 'Q2');
});

test('missingSections : titres de tout niveau, apostrophes et casse indifférentes', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'sections-'));
  const file = path.join(dir, 'doc.md');
  writeFileSync(file, '# Titre\n\n## Choix d’imbrication\ntexte\n### surveillance\n');
  assert.deepEqual(missingSections(file, ["Choix d'imbrication", 'Surveillance', 'Menaces']), ['Menaces']);
});

test('latestFile : le plus récent qui suit le motif, ou null', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'latest-'));
  assert.equal(latestFile(path.join(dir, 'absent'), /x/), null);
  writeFileSync(path.join(dir, 'a-1.dump'), '');
  writeFileSync(path.join(dir, 'autre.txt'), '');
  assert.equal(path.basename(latestFile(dir, /^a-\d\.dump$/)), 'a-1.dump');
});

test('gitStatusOf : suivi, ignoré, visible', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'git-'));
  execFileSync('git', ['init', '-q', dir]);
  writeFileSync(path.join(dir, '.gitignore'), '*.key\n');
  writeFileSync(path.join(dir, 'a.key'), '');
  writeFileSync(path.join(dir, 'b.txt'), '');
  assert.equal(gitStatusOf(dir, 'a.key'), 'ignore');
  assert.equal(gitStatusOf(dir, 'b.txt'), 'visible');
  execFileSync('git', ['-C', dir, 'add', '-f', 'a.key']);
  assert.equal(gitStatusOf(dir, 'a.key'), 'suivi');
});
