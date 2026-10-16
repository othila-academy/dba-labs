export const title = 'Démarrage';
export const steps = ['explorer', 'base'];
export const duration = '30 min';
export const summary = `Tu reprends l'administration des bases du réseau de médiathèques de Valmorin. Tout tourne dans des
conteneurs jetables : PostgreSQL pour les prêts, MongoDB pour le catalogue enrichi. Rien de ce que tu tapes dans psql ne
survit à scripts/db rebuild : l'état des bases vient de tes fichiers, dans project/.
Avant ce lab : npx lab init, puis scripts/db rebuild.`;
export const objectives = [
  'situer chaque service de la stack et s’y connecter (psql, mongosh)',
  'lire l’état d’un replica set MongoDB',
  'décrire l’état d’une base dans un fichier, rejoué à chaque reconstruction'
];
