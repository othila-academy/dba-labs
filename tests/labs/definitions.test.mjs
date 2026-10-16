// Les règles d'écriture des labs du cours, au-delà de ce que lab-cli vérifie.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { problemsOf } from './definitions.mjs';

const root = new URL('../../', import.meta.url);
const formation = JSON.parse(readFileSync(new URL('.othila-lab/formation.json', root), 'utf8'));
// Les seuls checks qui passent au départ de leur lab (RECON 8.E).
const PASSES_ON_START = ['demarrage/pg-repond', 'demarrage/rs0-primaire', 'roles/aucun-superuser'];

test('chaque lab de formation.json suit les règles du cours', async () => {
  const prompts = new Set();
  for (const id of formation.seances.flatMap((s) => s.labs)) {
    const dir = new URL(`.othila-lab/labs/${id}/`, root);
    assert.deepEqual(await problemsOf(dir, id, { prompts, passesOnStart: PASSES_ON_START }), [], id);
  }
});

test('un lab qui enfreint les règles est signalé', async () => {
  const dir = new URL('fixtures/lab-invalide/', import.meta.url);
  const problems = await problemsOf(dir, 'lab-invalide', { prompts: new Set(), passesOnStart: [] });
  for (const expected of [/libellé de plus de 200/, /3 indices attendus/, /npx lab submit lab-invalide etape/, /expected absent des choix/, /passesOnStart non prévu/]) {
    assert.ok(problems.some((p) => expected.test(p)), `${expected} absent de : ${problems.join(' ; ')}`);
  }
});
