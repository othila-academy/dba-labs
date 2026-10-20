// rs0 vu des checks du lab replica-set : les trois nœuds en graines, pour joindre le replica set même quand mongo1 est arrêté.
export const RS_URI = 'mongodb://mongo1:27017,mongo2:27017,mongo3:27017/?replicaSet=rs0';
export const rsStatus = (client) => client.db('admin').command({ replSetGetStatus: 1 });
export const etat = (m) => (m.health === 1 ? m.stateStr : 'injoignable');

// Les hôtes (port 27017 par défaut) et les options d'une chaîne mongodb:// ; null si elle n'en est pas une.
// Plusieurs hôtes : WHATWG URL ne sait pas la lire.
export function parseMongoUri(uri) {
  const m = /^mongodb:\/\/(?:[^@/]*@)?([^/?]+)\/?[^?]*(?:\?(.*))?$/.exec(uri ?? '');
  if (!m) return null;
  const hosts = m[1].split(',').map((h) => (h.includes(':') ? h : `${h}:27017`));
  return { hosts, options: new URLSearchParams(m[2] ?? '') };
}
