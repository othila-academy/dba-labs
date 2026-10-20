// Initialise rs0 en mono-nœud (mongo1:27017, jamais localhost), une seule fois. Puis attend un primaire, où qu'il soit, et
// que chaque membre déclaré soit sain : après la panne d'un primaire (lab replica-set), le nœud relancé revient secondaire.
try {
  rs.status();
  print('rs0 déjà initialisé');
} catch (error) {
  if (error.codeName !== 'NotYetInitialized') throw error;
  rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongo1:27017' }] });
  print('rs0 initialisé avec mongo1:27017');
}
const sain = (m) => m.health === 1 && ['PRIMARY', 'SECONDARY'].includes(m.stateStr);
// La vue du primaire : c'est lui qu'interrogent les applications et les checks, et il peut voir un nœud relancé un battement
// de cœur (2 s) après que ce nœud se voit lui-même sain.
const vueDuPrimaire = (nom) => {
  try {
    return new Mongo(`mongodb://${nom}/?directConnection=true`).getDB('admin').runCommand({ replSetGetStatus: 1 }).members ?? [];
  } catch {
    return [];
  }
};
let membres = [];
for (let i = 0; i < 120; i += 1) {
  membres = rs.status().members;
  const primaire = membres.find((m) => m.stateStr === 'PRIMARY');
  if (primaire && membres.every(sain) && (primaire.self || vueDuPrimaire(primaire.name).every(sain))) break;
  // Sans primaire au bout de 10 s, avec des membres injoignables : il n'en viendra pas, inutile d'attendre davantage.
  if (!primaire && i >= 20 && membres.some((m) => m.health !== 1)) break;
  sleep(500);
}
const absents = membres.filter((m) => !sain(m)).map((m) => m.name).join(', ');
if (!membres.some((m) => m.stateStr === 'PRIMARY')) {
  throw new Error(absents
    ? `rs0 sans primaire : ${absents} ne répondent pas, et rs0 n'a plus la majorité de ses membres. Le profil rs est-il dans project/stack.env ?`
    : 'rs0 sans primaire après 60 s');
}
if (absents) throw new Error(`rs0 a un primaire, mais ${absents} ne sont pas sains après 60 s : scripts/db status`);
const primaire = membres.find((m) => m.stateStr === 'PRIMARY');
const vus = primaire.self ? [] : vueDuPrimaire(primaire.name).filter((m) => !sain(m)).map((m) => m.name);
if (vus.length) throw new Error(`rs0 : le primaire ${primaire.name} ne voit pas encore ${vus.join(', ')} après 60 s : scripts/db status`);
