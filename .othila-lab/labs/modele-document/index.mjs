export const title = 'Le modèle document';
export const steps = ['modeliser', 'indexer', 'justifier'];
export const duration = '1 h 25';
export const summary = `Le catalogue enrichi de l'application vit dans MongoDB : un document par notice, lu d'un coup à l'écran. Il
vient de deux exports bruts et hétérogènes, que tu transformes en documents validés. Puis tu indexes les deux requêtes de
l'application et tu surveilles ce que le serveur exécute. Enfin, tu justifies ton modèle pour l'équipe qui le maintiendra.`;
export const objectives = [
  'concevoir un document pour les lectures de l’application (imbrication, motif « subset »)',
  'imposer un contrat avec un validateur $jsonSchema',
  'transformer des données hétérogènes par un pipeline d’agrégation ($lookup, $project, $merge)',
  'indexer une requête et lire son explain()',
  'surveiller MongoDB : profiler, mongotop, mongostat'
];
