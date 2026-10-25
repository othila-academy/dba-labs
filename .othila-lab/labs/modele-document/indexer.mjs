import { assert } from '@othila-academy/lab';
import { withMongo } from '../../shared/db.mjs';
import { Q1, Q2, RS0, planOf } from './requetes.mjs';

export const title = 'Indexer, et surveiller';
export const explain = 'Pourquoi tags, un champ de liste, peut-il entrer dans un index, et que coûte le profiler au niveau 2 ?';
export const instructions = `L'application lance deux requêtes (elles sont aussi dans application.js, à côté de cette fiche) :
  Q1, les mieux notés d'un thème : db.catalogue.find({ type: 'livre', tags: 'policier' }).sort({ note_moyenne: -1 }).limit(10)
  Q2, les œuvres d'un auteur : db.catalogue.find({ auteurs: 'Claire Faure' }).sort({ annee: -1 })
Lis leur plan, avec .explain('executionStats') : COLLSCAN parcourt toute la collection, IXSCAN passe par un index. Pose dans
001_catalogue.js les index qui leur conviennent (createIndex), dans l'ordre : champs d'égalité, puis tri.
Active aussi le profiler de valmorin, au niveau 1, depuis project/mongo : il note les opérations plus lentes que slowms, et il
se perd à chaque redémarrage du serveur. Repère : niveaux du profiler : 0 arrêté, 1 les opérations plus lentes que slowms,
2 toutes les opérations, chacune écrite dans system.profile. Après scripts/db rebuild, relance les requêtes, puis :
db.system.profile.find().sort({ ts: -1 }).limit(3) ; et, dans un autre terminal, pendant que tu les relances :
mongotop 2 --uri "mongodb://mongo1:27017/?replicaSet=rs0", puis mongostat --uri "mongodb://mongo1:27017/?replicaSet=rs0".

À expliquer (npx lab submit modele-document indexer) : pourquoi tags, un champ de liste, peut-il entrer dans un index, et que coûte le profiler au niveau 2 ?`;

export const prediction = {
  promptId: 'modele-mongotop',
  question: 'Que montre mongotop, collection par collection ?\n  a) le nombre de documents\n  b) la place occupée sur le disque\n  c) le temps passé en lecture et en écriture',
  choices: ['a', 'b', 'c'],
  expected: 'c'
};

function requireIndexScan(stages, nom) {
  // Sur une collection qui n'existe pas, MongoDB rend un plan EOF.
  assert(stages.length > 0 && !stages.includes('EOF'), `Attendu : un plan pour ${nom}. Constaté : aucun, la collection catalogue n'existe pas (scripts/db rebuild joue project/mongo).`);
  assert(!stages.includes('COLLSCAN'), `Attendu : ${nom} sans COLLSCAN. Constaté : ${stages.join(' ← ')}. Quel index servirait son filtre et son tri ?`);
  assert(stages.includes('IXSCAN'), `Attendu : un IXSCAN dans le plan de ${nom}. Constaté : ${stages.join(' ← ')}.`);
}

export const checks = [
  {
    id: 'q1-index',
    label: 'Q1 (les mieux notés d’un thème) passe par un index : IXSCAN, aucun COLLSCAN',
    run: () => withMongo(async (client) => requireIndexScan(await planOf(client, Q1), 'Q1'), RS0)
  },
  {
    id: 'q2-index',
    label: 'Q2 (les œuvres d’un auteur) passe par un index : IXSCAN, aucun COLLSCAN',
    run: () => withMongo(async (client) => requireIndexScan(await planOf(client, Q2), 'Q2'), RS0)
  },
  {
    id: 'profiler-actif',
    label: 'le profiler de valmorin est actif sur le primaire (niveau 1 ou 2)',
    run: () =>
      withMongo(async (client) => {
        const { was } = await client.db('valmorin').command({ profile: -1 });
        assert(was >= 1, `Attendu : profiler au niveau 1. Constaté : ${was}. Le niveau se perd au redémarrage du serveur : project/mongo le repose-t-il à chaque rebuild ?`);
      }, RS0)
  }
];

export const hints = [
  'Une requête qui filtre par égalité puis trie veut un index qui commence par ses champs d’égalité, puis son champ de tri.',
  'db.catalogue.createIndex({ type: 1, tags: 1, note_moyenne: -1 }) pour Q1 ; pour Q2, un index qui commence par auteurs. Le profiler : db.setProfilingLevel(…).',
  'À la fin de 001_catalogue.js : db.catalogue.createIndex({ type: 1, tags: 1, note_moyenne: -1 }); db.catalogue.createIndex({ auteurs: 1, annee: -1 }); db.setProfilingLevel(1);'
];

export const points = 150;
