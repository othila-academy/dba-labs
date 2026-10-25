import { assert } from '@othila-academy/lab';
import { withPg } from '../../shared/db.mjs';

export const title = 'Voir ce que le serveur exécute';
export const explain = "Quelles sont les deux requêtes les plus coûteuses, et qu'est-ce qui les distingue des autres ?";
export const instructions = `Active l'extension pg_stat_statements, qui compte ce que le serveur exécute. Elle se fait en deux temps :
  - elle se charge au démarrage du serveur : écris project/config/postgres/conf.d/10-monitoring.conf avec
    shared_preload_libraries ; essaie scripts/db reload pg, lis ce qu'il dit, puis scripts/db restart pg ;
  - elle se crée dans la base : project/post/020_perf.sql (joué après les données), puis scripts/db rebuild.
Rejoue ensuite la charge de l'application :
  scripts/db psql postgres valmorin -f .othila-lab/labs/requete-lente/application.sql
(il remet d'abord les compteurs à zéro : sinon, les insertions de données du rebuild arriveraient en tête), puis, dans
scripts/db psql postgres valmorin, cherche dans la vue pg_stat_statements les requêtes qui coûtent le plus (total_exec_time,
calls, mean_exec_time).

À expliquer (npx lab submit requete-lente surveiller) : quelles sont les deux requêtes les plus coûteuses, et qu'est-ce qui les distingue des autres ?`;

export const prediction = {
  promptId: 'requete-lente-reload',
  question: 'Une fois shared_preload_libraries écrit dans conf.d, scripts/db reload pg suffit-il à charger pg_stat_statements ?',
  choices: ['oui', 'non'],
  expected: 'non'
};

export const checks = [
  {
    id: 'preload',
    label: 'le serveur charge pg_stat_statements au démarrage (shared_preload_libraries)',
    run: () =>
      withPg(async (client) => {
        const { rows: [r] } = await client.query('show shared_preload_libraries');
        const libraries = r.shared_preload_libraries.split(',').map((s) => s.trim());
        assert(
          libraries.includes('pg_stat_statements'),
          `Attendu : pg_stat_statements dans shared_preload_libraries. Constaté : « ${r.shared_preload_libraries} ». Ce paramètre ne se lit qu'au démarrage : que dit scripts/db reload pg ?`
        );
      })
  },
  {
    id: 'extension',
    label: 'l’extension pg_stat_statements existe dans la base valmorin',
    run: () =>
      withPg(async (client) => {
        const { rows } = await client.query("select 1 from pg_extension where extname = 'pg_stat_statements'");
        assert(rows.length === 1, 'Attendu : l’extension pg_stat_statements dans valmorin. Constaté : absente. Une extension se crée dans chaque base, par un fichier que scripts/db rebuild rejoue.');
      })
  }
];

export const hints = [
  'Deux gestes distincts : charger une bibliothèque dans le serveur, et créer l’extension dans une base. Lequel demande un redémarrage ?',
  'shared_preload_libraries = \'pg_stat_statements\' dans conf.d, puis scripts/db restart pg ; create extension dans project/post/020_perf.sql, puis scripts/db rebuild.',
  '10-monitoring.conf : shared_preload_libraries = \'pg_stat_statements\' ; 020_perf.sql : create extension if not exists pg_stat_statements; ensuite : select calls, round(total_exec_time) as total_ms, query from pg_stat_statements order by total_exec_time desc limit 5;'
];

export const points = 100;
