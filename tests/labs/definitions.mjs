// Les règles d'écriture des labs, au-delà de ce que lab-cli vérifie : libellés de 200 caractères au plus (borne du
// contrat othila-lab), trois indices par étape, une question de soumission, des passesOnStart prévus, des prédictions cohérentes.
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const load = (dir, file) => import(new URL(file, dir).href);

export async function problemsOf(dir, labId, { prompts, passesOnStart }) {
  const problems = [];
  const index = await load(dir, 'index.mjs');
  for (const key of ['title', 'duration', 'summary']) if (!index[key]) problems.push(`${labId} : ${key} manquant`);
  if (!index.objectives?.length) problems.push(`${labId} : objectives manquant`);
  const checkIds = new Set();
  for (const stepId of index.steps ?? []) {
    const where = `${labId}/${stepId}`;
    if (!SLUG.test(stepId)) problems.push(`${where} : identifiant d'étape invalide`);
    const step = await load(dir, `${stepId}.mjs`);
    if (!step.title) problems.push(`${where} : title manquant`);
    if (!step.instructions?.includes(`npx lab submit ${labId} ${stepId}`))
      problems.push(`${where} : la consigne doit poser la question de soumission (npx lab submit ${labId} ${stepId})`);
    if (step.hints?.length !== 3) problems.push(`${where} : 3 indices attendus, ${step.hints?.length ?? 0} trouvé(s)`);
    if (!Number.isInteger(step.points)) problems.push(`${where} : points manquant`);
    for (const check of step.checks ?? []) {
      if (!SLUG.test(check.id ?? '')) problems.push(`${where} : identifiant de check invalide (${check.id})`);
      if (checkIds.has(check.id)) problems.push(`${where} : check ${check.id} en double dans le lab`);
      checkIds.add(check.id);
      if ((check.label ?? '').length > 200) problems.push(`${where}/${check.id} : libellé de plus de 200 caractères`);
      if (check.passesOnStart && !passesOnStart.includes(`${labId}/${check.id}`))
        problems.push(`${where}/${check.id} : passesOnStart non prévu (RECON 8.E)`);
    }
    if (step.prediction) {
      const { promptId, choices = [], expected } = step.prediction;
      if (prompts.has(promptId)) problems.push(`${where} : promptId ${promptId} déjà utilisé`);
      prompts.add(promptId);
      if (expected !== undefined && !choices.includes(expected)) problems.push(`${where} : expected absent des choix`);
    }
  }
  return problems;
}
