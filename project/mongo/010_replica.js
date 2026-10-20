// rs0 à trois membres : mongo2 et mongo3 rejoignent mongo1, sous le nom que les autres nœuds résolvent (jamais localhost).
// La préoccupation d'écriture par défaut est fixée à majority ; puis on attend que les trois membres votent (2 min au plus) :
// un membre ajouté ne vote qu'après sa synchronisation initiale, et sans trois votants une panne n'élirait personne.
const hotes = rs.conf().members.map((m) => m.host);
for (const host of ['mongo2:27017', 'mongo3:27017']) {
  if (!hotes.includes(host)) rs.add({ host });
}
db.adminCommand({ setDefaultRWConcern: 1, defaultWriteConcern: { w: 'majority' } });
const pret = () => {
  const status = rs.status();
  return status.writableVotingMembersCount === 3 && status.members.filter((m) => m.stateStr === 'SECONDARY').length === 2;
};
for (let i = 0; i < 240 && !pret(); i += 1) sleep(500);
const etats = rs.status().members.map((m) => `${m.name} ${m.stateStr}`).join(', ');
if (!pret()) throw new Error(`rs0 n'a pas trois membres votants, dont deux secondaires, après 2 min : ${etats}`);
print(`rs0 : ${etats}`);
