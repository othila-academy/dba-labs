// Les plans de PostgreSQL vus par les checks : EXPLAIN (FORMAT JSON), sans exécuter la requête.

// Le nœud et tous ses descendants (Plans), en profondeur.
export function* nodesOf(plan) {
  yield plan;
  for (const child of plan.Plans ?? []) yield* nodesOf(child);
}

// Les parcours séquentiels d'une table dans un plan (parallèles compris).
export const seqScansOn = (plan, relation) =>
  [...nodesOf(plan)].filter((node) => node['Node Type'] === 'Seq Scan' && node['Relation Name'] === relation);

// Le plan d'une requête, sans l'exécuter.
export async function planOf(client, sql) {
  const { rows } = await client.query(`explain (format json) ${sql}`);
  return rows[0]['QUERY PLAN'][0].Plan;
}
