import path from 'node:path';
import { assert } from '@othila-academy/lab';
import { ROOT, withPg } from '../../shared/db.mjs';
import { requireExecutable } from '../../shared/fichiers.mjs';
import { as } from '../../shared/valmorin.mjs';

export const title = 'Prévenir la récidive';
export const instructions = `Pour que cela ne se reproduise pas, pose deux garde-fous sur le seul rôle app_valmorin, dans
project/schema/030_garde-fous.sql :
  - idle_in_transaction_session_timeout (5 min au plus) : une session qui oublie son COMMIT est coupée, et ses verrous tombent ;
  - lock_timeout : une requête de l'application qui attend un verrou abandonne au lieu d'attendre sans fin ; l'application réessaie.
ALTER ROLE … SET … s'applique aux nouvelles connexions du rôle. Puis scripts/db rebuild, et vérifie en te connectant avec lui :
psql -h pg -U app_valmorin -d valmorin -c 'show lock_timeout'.
Écris enfin project/runbooks/verrou.sh, exécutable : il montre les sessions bloquées et celles qui les bloquent, termine les
sessions « idle in transaction » qui bloquent quelqu'un, et elles seules, puis vérifie qu'il n'y a plus d'attente. Attention :
l'application réessaie ; entre deux essais, personne n'attend. Le runbook observe donc quelques secondes, plus que le
lock_timeout de l'application, avant de conclure.
Rejoue-le : scripts/db incident verrou, puis project/runbooks/verrou.sh.

À expliquer (npx lab submit incident-verrou prevenir) : pourquoi poser ces délais sur le rôle de l'application plutôt que sur tout le serveur ?`;

export const RUNBOOK = path.join(ROOT, 'project/runbooks/verrou.sh');
// Un réglage reçu du rôle : ALTER ROLE … SET (user), ou ALTER ROLE … IN DATABASE … SET (database user).
const DU_ROLE = ['user', 'database user'];

// Un réglage tel que app_valmorin le reçoit en se connectant à valmorin (en ms), et d'où il vient.
const reglage = (name) =>
  withPg(async (client) => {
    const { rows: [r] } = await client.query('select setting::bigint as ms, source from pg_settings where name = $1', [name]);
    return { ms: Number(r.ms), source: r.source };
  }, as('app_valmorin'));

function requireDuRole(name, { ms, source }) {
  assert(ms > 0, `Attendu : ${name} actif pour app_valmorin. Constaté : 0 (désactivé). Connecte-toi avec app_valmorin : show ${name}.`);
  assert(
    DU_ROLE.includes(source),
    `Attendu : ${name} posé sur le rôle app_valmorin. Constaté : réglé pour tout le serveur (source : ${source}) : une session d'administration en serait coupée aussi.`
  );
}

export const checks = [
  {
    id: 'delai-inactivite',
    label: 'app_valmorin reçoit de son rôle un idle_in_transaction_session_timeout de 5 min au plus',
    run: async () => {
      const r = await reglage('idle_in_transaction_session_timeout');
      requireDuRole('idle_in_transaction_session_timeout', r);
      assert(r.ms <= 300000, `Attendu : 5 min au plus. Constaté : ${r.ms / 60000} min : une transaction oubliée bloquerait encore les guichets tout ce temps.`);
    }
  },
  {
    id: 'delai-verrou',
    label: 'app_valmorin reçoit de son rôle un lock_timeout',
    run: async () => requireDuRole('lock_timeout', await reglage('lock_timeout'))
  },
  {
    id: 'runbook-verrou-executable',
    label: 'project/runbooks/verrou.sh existe et est exécutable',
    run: async () => requireExecutable(RUNBOOK)
  }
];

export const hints = [
  'Un réglage se pose pour tout le serveur, pour une base, ou pour un rôle. Lequel ne gêne ni postgres ni les autres applications ?',
  "alter role app_valmorin set idle_in_transaction_session_timeout = '…' ; idem pour lock_timeout. Le runbook : psql -h pg -U postgres -d valmorin, une requête sur pg_stat_activity et pg_blocking_pids, puis pg_terminate_backend.",
  "030_garde-fous.sql : alter role app_valmorin set idle_in_transaction_session_timeout = '1min'; alter role app_valmorin set lock_timeout = '10s'; runbook : une boucle de 15 s (sleep 0.5) qui lance select pg_terminate_backend(pid, 5000) from pg_stat_activity where state = 'idle in transaction' and pid in (select unnest(pg_blocking_pids(pid)) from pg_stat_activity), et s'arrête quand elle a terminé une session et que plus personne n'attend."
];

export const points = 150;
