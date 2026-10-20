import { assert } from '@othila-academy/lab';
import { withPg } from '../../shared/db.mjs';

export const title = 'Débloquer le guichet';
export const instructions = `Lance scripts/db incident verrou, et lis ce qui vient de se passer. Puis, en postgres (scripts/db psql postgres valmorin) :
  - pg_stat_activity montre chaque session : qui (usename, application_name), dans quel état (state), depuis quand
    (xact_start, state_change) et ce qu'elle attend (wait_event_type) ;
  - pg_blocking_pids(pid) donne, pour une session qui attend, celles qui la bloquent.
Trouve la session qui bloque le guichet et termine-la (pg_terminate_backend), elle seule : le prêt du guichet doit passer.

À expliquer (npx lab submit incident-verrou debloquer) : comment as-tu reconnu la session fautive, et pourquoi la terminer elle plutôt que le guichet ?`;

export const prediction = {
  promptId: 'verrou-cancel',
  question: 'pg_cancel_backend sur la session fautive suffit-il à débloquer le guichet ?',
  choices: ['oui', 'non'],
  expected: 'non'
};

// Le prêt que le guichet tente d'enregistrer (.othila-lab/incidents/verrou.sh) : les données n'ont aucun emprunt après le
// 30 septembre 2026.
const PRET = "select count(*)::int as n from emprunt where date_emprunt = date '2026-10-15' and date_retour_prevue = date '2026-11-05'";

export const checks = [
  {
    id: 'session-fautive-terminee',
    label: 'la session d’inventaire restée « idle in transaction » n’existe plus',
    run: () =>
      withPg(async (client) => {
        const { rows } = await client.query("select pid, state from pg_stat_activity where application_name = 'inventaire'");
        assert(
          rows.length === 0,
          `Attendu : plus de session d'inventaire. Constaté : ${rows.length} (pid ${rows.map((r) => r.pid).join(', ')}, ${rows[0]?.state}). pg_cancel_backend annule la requête en cours : celle-ci n'en a pas.`
        );
      })
  },
  {
    id: 'aucune-session-bloquee',
    label: 'aucune session n’attend un verrou tenu par une autre (pg_blocking_pids)',
    run: () =>
      withPg(async (client) => {
        const { rows } = await client.query(
          'select pid, application_name, pg_blocking_pids(pid) as par from pg_stat_activity where cardinality(pg_blocking_pids(pid)) > 0'
        );
        assert(
          rows.length === 0,
          `Attendu : aucune session bloquée. Constaté : ${rows.map((r) => `${r.application_name || r.pid} attend ${r.par.join(', ')}`).join(' ; ')}. Qui tient le verrou ?`
        );
      })
  },
  {
    id: 'pret-enregistre',
    label: 'le prêt que le guichet tentait d’enregistrer est dans emprunt',
    run: () =>
      withPg(async (client) => {
        // Le guichet réessaie chaque seconde : son prêt arrive au plus une seconde après la levée du verrou.
        for (let i = 0; i < 15; i += 1) {
          const { rows: [pret] } = await client.query(PRET);
          if (pret.n > 0) return;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        throw new Error(
          'Attendu : le prêt du guichet, daté du 15 octobre 2026, dans emprunt. Constaté : absent. Le guichet attend-il encore (application_name guichet-centre) ? As-tu lancé scripts/db incident verrou ? Un scripts/db rebuild efface l’incident : relance-le.'
        );
      })
  }
];

export const hints = [
  'Le guichet attend : quoi, et qui ? Dans pg_stat_activity, regarde state et wait_event_type. Une session « idle in transaction » ne fait rien, mais garde ses verrous.',
  "select pid, application_name, state, wait_event_type, pg_blocking_pids(pid) from pg_stat_activity where datname = 'valmorin'; le pid cité par pg_blocking_pids est le fautif ; puis select pg_terminate_backend(<pid>);",
  "select pg_terminate_backend(pid) from pg_stat_activity where pid in (select unnest(pg_blocking_pids(pid)) from pg_stat_activity where application_name = 'guichet-centre');"
];

export const points = 150;
