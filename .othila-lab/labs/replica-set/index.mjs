export const title = 'Le replica set';
export const steps = ['repliquer', 'basculer', 'sauvegarder', 'connecter'];
export const duration = '1 h 35';
export const summary = `Le catalogue ne tient que sur mongo1 : qu'il tombe, et l'application s'arrête. Tu passes rs0 à trois membres, tu
donnes à l'application sa chaîne de connexion, puis tu provoques la panne du primaire et tu regardes rs0 élire un remplaçant.
Enfin, tu sauvegardes MongoDB en lisant sur un secondaire : une réplique n'est pas une sauvegarde. La dernière étape,
facultative, écrit la chaîne de connexion de l'application.
Repères : la réplication copie les mêmes données sur plusieurs nœuds (disponibilité, lectures réparties) ; le sharding les
répartit entre plusieurs replica sets selon une clé de partition (volume, débit d'écriture). Le formateur le montre en
démonstration. Avant ce lab : COMPOSE_PROFILES=rs dans project/stack.env (étape repliquer).`;
export const objectives = [
  'passer un replica set de un à trois membres',
  'fixer la préoccupation d’écriture par défaut, et dire ce qu’elle garantit',
  'écrire la chaîne de connexion d’une application à un replica set',
  'observer une élection, puis le retour d’un nœud',
  'sauvegarder MongoDB en lisant sur un secondaire (mongodump, mongorestore --dryRun)'
];
// Le rejeu seul : l'apprenant provoque la panne et relance le nœud lui-même.
export const replay = {
  solution: ['scripts/db incident primaire', 'scripts/db up', 'project/ops/backup-mongo.sh']
};
