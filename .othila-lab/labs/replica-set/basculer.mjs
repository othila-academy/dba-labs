import { assert } from '@othila-academy/lab';
import { withMongo } from '../../shared/db.mjs';
import { RS_URI, etat, rsStatus } from './rs.mjs';

export const title = 'La panne du primaire';
export const explain = 'Pourquoi le nœud relancé ne reprend-il pas sa place de primaire ?';
export const instructions = `Lance scripts/db incident primaire. Puis connecte-toi à rs0 comme l'application, par les trois hôtes :
scripts/db mongosh ne connaît que mongo1, arrêté pendant la panne.
  mongosh "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/valmorin?replicaSet=rs0"
  - rs.status().members.map((m) => [m.name, m.stateStr]) : qui est devenu primaire, et en combien de temps ?
  - écris pendant la panne : db.journal.insertOne({ a: new Date() }, { writeConcern: { w: 'majority' } }) ;
scripts/db status montre les conteneurs ; scripts/db mongosh mongo2 joint un nœud précis.
Relance le nœud arrêté : scripts/db up. Il revient SECONDARY : il rattrape ce qu'il a manqué, depuis l'oplog des autres.

À expliquer (npx lab submit replica-set basculer) : pourquoi le nœud relancé ne reprend-il pas sa place de primaire ?`;

export const prediction = {
  promptId: 'replica-ecriture-panne',
  question: 'Pendant la panne du primaire, une écriture w: "majority" finit-elle par réussir sur rs0 à trois membres ?',
  choices: ['oui', 'non'],
  expected: 'oui'
};

export const checks = [
  {
    id: 'bascule-observee',
    label: 'un nouveau primaire a été élu après une panne (term de rs0 ≥ 2), et les trois membres sont de nouveau sains',
    run: () =>
      withMongo(async (client) => {
        const status = await rsStatus(client);
        assert(
          status.term >= 2,
          `Attendu : au moins une élection depuis la mise en place de rs0. Constaté : term ${status.term}, aucune. scripts/db incident primaire arrête le primaire ; un scripts/db rebuild remet le term à 1 : relance alors l'incident.`
        );
        const malades = status.members.filter((m) => !['PRIMARY', 'SECONDARY'].includes(etat(m))).map((m) => `${m.name} ${etat(m)}`);
        assert(
          status.members.length === 3 && malades.length === 0,
          `Attendu : les trois membres de nouveau sains. Constaté : ${malades.join(', ') || `${status.members.length} membre(s)`}. scripts/db up relance un nœud arrêté.`
        );
      }, { uri: RS_URI })
  }
];

export const hints = [
  'Un replica set élit un primaire quand la majorité de ses membres le peut. Que voit rs.status() juste après l’arrêt ?',
  'scripts/db incident primaire ; mongosh "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/valmorin?replicaSet=rs0", puis rs.status() plusieurs fois ; enfin scripts/db up.',
  'scripts/db incident primaire, puis scripts/db up : le term de rs0 passe à 2 et les trois membres redeviennent sains.'
];

export const points = 100;
