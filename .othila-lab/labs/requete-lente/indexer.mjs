import { assert } from '@othila-academy/lab';
import { withPg } from '../../shared/db.mjs';
import { planOf, seqScansOn } from '../../shared/plan.mjs';
import { Q1, Q2 } from './requetes.mjs';

export const title = 'Lire les plans, poser les index';
export const instructions = `Les deux requêtes de l'application (elles sont aussi dans application.sql) :

Q1, l'historique d'un adhérent :
${Q1};

Q2, les retards en cours par site :
${Q2};

Lis leur plan avec explain (analyze, buffers) : quel nœud lit le plus de pages, et combien de lignes garde-t-il ? Pose dans
project/post/020_perf.sql l'index qui convient à chacune, puis scripts/db rebuild (qui refait ANALYZE), et relis les plans.
Si ton schéma pose déjà un index sur emprunt (au lab schema), regarde s'il sert Q1 ou Q2, et dis-le dans ton explication.

À expliquer (npx lab submit requete-lente indexer) : pour Q2, pourquoi l'index déjà posé sur date_retour_prevue ne sert-il à rien, et que fait de mieux le tien ?`;

export const prediction = {
  promptId: 'requete-lente-index-existant',
  question: 'Un index existe déjà sur emprunt (date_retour_prevue). Le planificateur s’en sert-il pour Q2 ?',
  choices: ['oui', 'non'],
  expected: 'non'
};

// Le plan d'une requête ne doit pas lire emprunt en entier.
const noSeqScan = (sql, name, gesture) => () =>
  withPg(async (client) => {
    const scans = seqScansOn(await planOf(client, sql), 'emprunt');
    assert(scans.length === 0, `Attendu : un plan de ${name} sans Seq Scan sur emprunt. Constaté : emprunt lue en entier (filtre : ${scans[0]?.Filter ?? '?'}). ${gesture}`);
  });

export const checks = [
  {
    id: 'q1-sans-seq-scan',
    label: 'le plan de Q1 ne parcourt pas toute la table emprunt (aucun Seq Scan sur emprunt)',
    run: noSeqScan(Q1, 'Q1', 'Lance explain (analyze, buffers) sur Q1 : combien de lignes ce parcours lit-il pour en garder une dizaine ?')
  },
  {
    id: 'q2-sans-seq-scan',
    label: 'le plan de Q2 ne parcourt pas toute la table emprunt (aucun Seq Scan sur emprunt)',
    run: noSeqScan(Q2, 'Q2', 'Lance explain (analyze, buffers) sur Q2 : quelle part des emprunts est encore en cours ?')
  }
];

export const hints = [
  'Dans le plan, quelle condition le Seq Scan sur emprunt applique-t-il (Filter), et combien de lignes en retire-t-il (Rows Removed by Filter) ?',
  'Q1 : un index sur les colonnes de son where, dans le bon ordre (l’égalité d’abord, la plage ensuite). Q2 : très peu d’emprunts sont en cours ; un index partiel (create index … where …) ne range que ceux-là.',
  'create index on emprunt (adherent_id, date_emprunt); create index on emprunt (date_retour_prevue) where date_retour is null; dans project/post/020_perf.sql, puis scripts/db rebuild.'
];

export const points = 200;
