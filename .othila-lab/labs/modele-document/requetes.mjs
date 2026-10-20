// Les deux requêtes de l'application, mot pour mot celles de la fiche, de application.js et des checks.
export const Q1 = { filter: { type: 'livre', tags: 'policier' }, sort: { note_moyenne: -1 }, limit: 10 };
export const Q2 = { filter: { auteurs: 'Claire Faure' }, sort: { annee: -1 } };
// rs0 par mongo1 : les écritures et explain() vont au primaire.
export const RS0 = { uri: 'mongodb://mongo1:27017/?replicaSet=rs0' };

// Les étapes d'un plan explain(), à toute profondeur (inputStage, inputStages, queryPlan…).
export function stagesOf(node, out = []) {
  if (Array.isArray(node)) {
    for (const child of node) stagesOf(child, out);
  } else if (node && typeof node === 'object') {
    if (typeof node.stage === 'string') out.push(node.stage);
    for (const value of Object.values(node)) if (value && typeof value === 'object') stagesOf(value, out);
  }
  return out;
}

// Les étapes du plan retenu pour une requête, sans l'exécuter.
export async function planOf(client, q) {
  let cursor = client.db('valmorin').collection('catalogue').find(q.filter).sort(q.sort);
  if (q.limit) cursor = cursor.limit(q.limit);
  const explain = await cursor.explain('queryPlanner');
  return stagesOf(explain.queryPlanner.winningPlan);
}
