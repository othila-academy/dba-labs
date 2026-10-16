export const title = 'Sauvegarde et restauration';
export const steps = ['sauvegarder', 'restaurer'];
export const duration = '1 h 15';
export const summary = `Une base sans sauvegarde testée est une base perdue en sursis. Tu écris le script de sauvegarde de valmorin
et tu le lances. Puis un incident survient : tu restaures ce qui a disparu, sans perdre ce qui a été fait depuis, et tu
écris le runbook pour la prochaine fois.
Repères : le RPO est la quantité de données qu'on accepte de perdre (le temps écoulé depuis la dernière sauvegarde), le RTO
le temps qu'on accepte pour revenir en service. Une sauvegarde logique (pg_dump) se restaure objet par objet, même sur une
autre version ; une sauvegarde physique (pg_basebackup) copie les fichiers du serveur et, avec les journaux (WAL), permet de
revenir à n'importe quel instant (PITR). Ce lab travaille en logique.`;
export const objectives = [
  'écrire un script de sauvegarde qui échoue bruyamment',
  'vérifier une sauvegarde sans la restaurer (pg_restore --list)',
  'restaurer un seul objet et ce qui en dépend, depuis un dump',
  'consigner une procédure de reprise exécutable : un runbook'
];
// Le rejeu seul : l'apprenant fait ces gestes lui-même.
export const replay = {
  start: ['scripts/db incident sauvegarde'],
  solution: ['project/ops/backup.sh', 'scripts/db incident sauvegarde', 'project/runbooks/sauvegarde.sh']
};
