import { assert } from '@othila-academy/lab';
import { TIMEOUT_MS, withMongo } from '../../shared/db.mjs';
import { RS_URI, etat, rsStatus } from './rs.mjs';

export const title = 'Répliquer';
export const explain = 'Avec trois membres, combien peuvent tomber sans que les écritures majority échouent, et pourquoi pas deux membres seulement ?';
export const instructions = `rs0 tourne sur un seul nœud : qu'il tombe, et le catalogue est perdu. Passe-le à trois membres :
  - ajoute le profil rs à project/stack.env (COMPOSE_PROFILES=rs), puis scripts/db up : mongo2 et mongo3 démarrent, vides,
    hors de rs0 ;
  - écris project/mongo/010_replica.js (joué par scripts/db rebuild, après 001_catalogue.js). Il ajoute mongo2:27017 et
    mongo3:27017 à rs0 s'ils n'y sont pas (rs.add), fixe la préoccupation d'écriture par défaut à majority
    (db.adminCommand({ setDefaultRWConcern: 1, … })), puis attend que les deux nouveaux membres soient SECONDARY et votent
    (un membre ajouté ne vote qu'après sa synchronisation initiale : rs.status().writableVotingMembersCount) ;
  - scripts/db rebuild, puis scripts/db status : un PRIMARY, deux SECONDARY.
Toujours mongo2:27017, jamais localhost : chaque membre doit pouvoir joindre les autres sous ce nom.

À expliquer (npx lab submit replica-set repliquer) : avec trois membres, combien peuvent tomber sans que les écritures majority échouent, et pourquoi pas deux membres seulement ?`;

export const checks = [
  {
    id: 'trois-membres',
    label: 'rs0 a trois membres sains : un PRIMARY et deux SECONDARY',
    run: () =>
      withMongo(async (client) => {
        const { members } = await rsStatus(client);
        const vus = members.map((m) => `${m.name} ${etat(m)}`).join(', ');
        assert(members.length === 3, `Attendu : 3 membres. Constaté : ${vus}. project/mongo/010_replica.js les ajoute-t-il, et le profil rs est-il dans project/stack.env ?`);
        const etats = members.map(etat).sort().join(',');
        assert(etats === 'PRIMARY,SECONDARY,SECONDARY', `Attendu : un PRIMARY et deux SECONDARY, tous sains. Constaté : ${vus}. Un nœud arrêté se relance par scripts/db up.`);
      }, { uri: RS_URI })
  },
  {
    id: 'ecriture-majoritaire',
    label: 'w: "majority" est la préoccupation d’écriture de rs0 (source global), et une écriture majoritaire passe (puis est effacée)',
    run: () =>
      withMongo(async (client) => {
        const rw = await client.db('admin').command({ getDefaultRWConcern: 1 });
        assert(
          rw.defaultWriteConcernSource === 'global' && rw.defaultWriteConcern?.w === 'majority',
          `Attendu : w: "majority", fixé pour tout rs0 (source global). Constaté : ${JSON.stringify(rw.defaultWriteConcern ?? {})}, source ${rw.defaultWriteConcernSource}. Depuis MongoDB 5, majority est le défaut implicite, mais il dépend de la topologie : setDefaultRWConcern le fixe.`
        );
        try {
          await client.db('lab_check').collection('ecriture').insertOne({ at: new Date() }, { writeConcern: { w: 'majority', wtimeoutMS: TIMEOUT_MS } });
        } catch (error) {
          throw new Error(`Attendu : une écriture acquittée par la majorité de rs0. Constaté : « ${error.message} ». Combien de membres sont sains ?`);
        } finally {
          await client.db('lab_check').dropDatabase().catch(() => {});
        }
      }, { uri: RS_URI })
  }
];

export const hints = [
  'Un membre s’ajoute depuis le primaire, sous le nom que les autres nœuds utilisent pour le joindre. La préoccupation d’écriture par défaut se règle une fois, pour tout le cluster.',
  "rs.conf().members liste les hôtes déjà là ; rs.add({ host: 'mongo2:27017' }) ; db.adminCommand({ setDefaultRWConcern: 1, defaultWriteConcern: { w: 'majority' } }) ; rs.status().writableVotingMembersCount pour attendre.",
  "const hotes = rs.conf().members.map((m) => m.host); for (const host of ['mongo2:27017', 'mongo3:27017']) if (!hotes.includes(host)) rs.add({ host }); db.adminCommand({ setDefaultRWConcern: 1, defaultWriteConcern: { w: 'majority' } }); puis une boucle avec sleep(500) jusqu'à writableVotingMembersCount = 3."
];

export const points = 150;
