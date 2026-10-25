// Le jour 2 allégé : les étapes facultatives en fin de lab et annoncées comme telles, des squelettes à compléter pour le
// runbook et le catalogue, et les pièges du serveur hérité dits dans la fiche.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../../', import.meta.url);
const lab = (id) => import(new URL(`.othila-lab/labs/${id}/index.mjs`, root).href);
const step = (id, s) => import(new URL(`.othila-lab/labs/${id}/${s}.mjs`, root).href);
const FACULTATIVES = { 'replica-set': ['connecter'], durcissement: ['chiffrement', 'journalisation', 'reseau', 'tls-mongo'] };

for (const [id, facultatives] of Object.entries(FACULTATIVES)) {
  test(`${id} : les étapes facultatives sont en fin de lab, et annoncées comme telles`, async () => {
    const { steps, summary } = await lab(id);
    assert.deepEqual(steps.slice(-facultatives.length), facultatives);
    assert.match(summary, /facultatives?/i);
    for (const s of facultatives) {
      const { title, instructions } = await step(id, s);
      assert.match(title, /^Facultatif : /, `${id}/${s}`);
      assert.match(instructions, /^Facultatif\./, `${id}/${s}`);
    }
  });
}

test('incident-verrou : un squelette de runbook à compléter, valide en Bash, cité par la fiche', async () => {
  const fichier = new URL('.othila-lab/labs/incident-verrou/verrou-squelette.sh', root);
  assert.ok(existsSync(fichier));
  execFileSync('bash', ['-n', fichier.pathname]);
  const { instructions, hints } = await step('incident-verrou', 'prevenir');
  assert.match(instructions, /verrou-squelette\.sh/);
  assert.match(hints.join(' '), /dans la minute/);
});

test('modele-document : un squelette de catalogue à compléter, valide en JavaScript, cité par la fiche', async () => {
  const fichier = new URL('.othila-lab/labs/modele-document/catalogue-squelette.js', root);
  assert.ok(existsSync(fichier));
  execFileSync('node', ['--check', fichier.pathname]);
  const { instructions } = await step('modele-document', 'modeliser');
  assert.match(instructions, /catalogue-squelette\.js/);
  assert.match(instructions, /scripts\/db mongosh project\/mongo\/001_catalogue\.js/);
});

test('durcissement : la fiche donne le mot de passe de postgres et désigne la ligne md5 de init.sql', async () => {
  const { instructions } = await step('durcissement', 'authentification');
  assert.match(instructions, /valmorin-lab/);
  assert.match(instructions, /set password_encryption = 'md5'/);
});

test('durcissement : le plan de sécurité est la section 6 du dossier', async () => {
  const { instructions } = await step('durcissement', 'plan-securite');
  assert.match(instructions, /dossier/);
});

test('replica-set : le sharding est expliqué au tableau, sans démonstration', async () => {
  const { summary } = await lab('replica-set');
  assert.doesNotMatch(summary, /démonstration/);
});

test('incident primaire : le récit donne la chaîne à trois hôtes, pas project/app.env (étape facultative)', () => {
  const recit = readFileSync(new URL('.othila-lab/incidents/primaire.sh', root), 'utf8');
  assert.doesNotMatch(recit, /app\.env/);
  assert.match(recit, /mongo1:27017,mongo2:27017,mongo3:27017/);
});

test('incident-verrou : soumettre debloquer avant le rebuild de prevenir, qui efface le prêt du guichet', async () => {
  const { instructions } = await step('incident-verrou', 'prevenir');
  assert.match(instructions, /npx lab submit incident-verrou debloquer/);
});
