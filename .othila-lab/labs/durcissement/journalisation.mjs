import { assert } from '@othila-academy/lab';
import { withLegacyPg } from './legacy.mjs';

export const title = 'Facultatif : journaliser';
export const explain = 'Quel seuil as-tu choisi pour les requêtes lentes, et que coûterait 0 ?';
export const instructions = `Facultatif. Sur le serveur hérité, personne ne sait qui se connecte, ni ce qui est lent. Dans postgresql.conf, journalise :
  - les connexions et les déconnexions (log_connections, log_disconnections) ;
  - les requêtes plus lentes qu'un seuil que tu choisis (log_min_duration_statement).
Puis scripts/db rebuild, connecte-toi, et lis le journal : docker compose -p dba logs pg-legacy.

À expliquer (npx lab submit durcissement journalisation) : quel seuil as-tu choisi pour les requêtes lentes, et que coûterait 0 ?`;

export const checks = [
  {
    id: 'journal-connexions',
    label: 'pg-legacy journalise les connexions et les déconnexions (log_connections, log_disconnections)',
    run: () =>
      withLegacyPg(async (client) => {
        const { rows: [r] } = await client.query("select current_setting('log_connections') as c, current_setting('log_disconnections') as d");
        // PostgreSQL 18 : log_connections prend une liste d'aspects (receipt, authentication, …) ; on reste accepté.
        assert(r.c !== '' && r.c !== 'off', `Attendu : log_connections actif. Constaté : « ${r.c || 'off'} ».`);
        assert(r.d === 'on', `Attendu : log_disconnections = on. Constaté : ${r.d}.`);
      })
  },
  {
    id: 'journal-requetes-lentes',
    label: 'pg-legacy journalise les requêtes lentes (log_min_duration_statement défini)',
    run: () =>
      withLegacyPg(async (client) => {
        const { rows: [r] } = await client.query("select setting::int as ms from pg_settings where name = 'log_min_duration_statement'");
        assert(r.ms >= 0, 'Attendu : un seuil pour log_min_duration_statement. Constaté : -1 (désactivé).');
      })
  }
];

export const hints = [
  'Trois paramètres de postgresql.conf, tous dans la famille log_. Lesquels disent qui entre, qui sort, et ce qui traîne ?',
  'log_connections = on ; log_disconnections = on ; log_min_duration_statement = <un seuil, avec son unité>.',
  "postgresql.conf : log_connections = on, log_disconnections = on, log_min_duration_statement = '500ms'."
];

export const points = 75;
