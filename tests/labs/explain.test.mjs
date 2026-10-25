// La question de l'explication (explain) : lab-cli la rappelle au vert et à la soumission. C'est celle que la fiche
// annonce après « À expliquer », pour que l'apprenant la retrouve sans remonter dans son terminal.
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { test } from 'node:test';

const labs = new URL('../../.othila-lab/labs/', import.meta.url);

test('chaque étape exporte explain, la question « À expliquer » de sa fiche', async () => {
  const problemes = [];
  for (const lab of readdirSync(labs, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const { steps } = await import(new URL(`${lab.name}/index.mjs`, labs).href);
    for (const s of steps) {
      const { explain, instructions } = await import(new URL(`${lab.name}/${s}.mjs`, labs).href);
      const annoncee = /À expliquer \([^)]*\) : (.+)$/s.exec(instructions)?.[1].trim();
      if (typeof explain !== 'string') problemes.push(`${lab.name}/${s} : explain manque`);
      else if (!annoncee || explain.toLowerCase() !== annoncee.toLowerCase()) problemes.push(`${lab.name}/${s} : explain diffère de la fiche`);
    }
  }
  assert.deepEqual(problemes, []);
});
