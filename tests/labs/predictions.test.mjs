// Une prédiction n'est juste que si l'apprenant retape exactement le choix attendu : chaque choix est donc un mot court,
// sans accent, espace ni apostrophe (oui, non, un chiffre, une lettre). Les options longues vont dans la question.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

const labs = new URL('../../.othila-lab/labs/', import.meta.url);

test('les choix de chaque prédiction se tapent sans faute : un mot court, en ASCII', async () => {
  const problemes = [];
  for (const lab of readdirSync(labs, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of readdirSync(new URL(`${lab.name}/`, labs)).filter((f) => f.endsWith('.mjs'))) {
      const { prediction } = await import(new URL(`${lab.name}/${f}`, labs).href);
      if (!prediction) continue;
      for (const choix of prediction.choices ?? []) {
        if (!/^[a-z0-9]{1,3}$/.test(choix)) problemes.push(`${lab.name}/${f} : « ${choix} »`);
      }
      const lettres = (prediction.choices ?? []).filter((c) => /^[a-z]$/.test(c));
      for (const l of lettres) {
        if (!prediction.question.includes(`${l}) `)) problemes.push(`${lab.name}/${f} : la question ne dit pas ce qu'est ${l})`);
      }
    }
  }
  assert.deepEqual(problemes, []);
});
