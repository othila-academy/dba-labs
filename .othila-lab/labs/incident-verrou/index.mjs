export const title = 'Incident : le guichet bloqué';
export const steps = ['debloquer', 'prevenir'];
export const duration = '1 h';
export const summary = `Mardi, 10 h : les guichets de la médiathèque centrale n'enregistrent plus aucun prêt. Rien n'est en panne, tout
attend. Tu remontes l'attente jusqu'à la session qui la cause, tu la termines, elle seule, puis tu poses les garde-fous qui
l'auraient évitée, et tu écris le runbook pour la prochaine fois.
Repères : une transaction ouverte garde ses verrous jusqu'à son COMMIT ou son ROLLBACK, même quand elle ne fait plus rien
(« idle in transaction ») ; une session qui veut la même ligne attend, sans limite par défaut.`;
export const objectives = [
  'lire pg_stat_activity : état, attente, transaction ouverte',
  'remonter une attente jusqu’à la session qui bloque (pg_blocking_pids)',
  'terminer une session, et elle seule',
  'poser des garde-fous sur un rôle : idle_in_transaction_session_timeout, lock_timeout',
  'consigner le diagnostic dans un runbook exécutable'
];
// Le rejeu seul : l'apprenant lance l'incident lui-même, pendant le lab.
export const replay = {
  start: ['scripts/db incident verrou'],
  solution: ['scripts/db incident verrou', 'project/runbooks/verrou.sh']
};
