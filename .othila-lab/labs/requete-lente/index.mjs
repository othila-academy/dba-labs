export const title = 'La requête lente';
export const steps = ['surveiller', 'indexer', 'doublon'];
export const duration = '1 h 15';
export const summary = `Les bibliothécaires se plaignent : l'historique d'un adhérent met du temps à s'afficher au guichet, et le
tableau des retards du matin aussi. Tu outilles le serveur pour voir ce qu'il exécute, tu lis le plan des deux requêtes, puis
tu poses les index qui leur conviennent. La dernière étape, facultative, fait le ménage dans les index de l'ancien prestataire.`;
export const objectives = [
  'activer pg_stat_statements et y repérer les requêtes coûteuses',
  'lire un plan avec EXPLAIN (ANALYZE, BUFFERS)',
  'choisir un index composite ou partiel pour une requête donnée',
  'repérer un index inutile, et dire ce qu’il coûte'
];
