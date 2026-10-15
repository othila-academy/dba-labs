// Initialise rs0 en mono-nœud (mongo1:27017, jamais localhost), une seule fois ; puis attend un primaire.
try {
  rs.status();
  print('rs0 déjà initialisé');
} catch (error) {
  if (error.codeName !== 'NotYetInitialized') throw error;
  rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: 'mongo1:27017' }] });
  print('rs0 initialisé avec mongo1:27017');
}
for (let i = 0; i < 60 && !db.hello().isWritablePrimary; i += 1) sleep(500);
if (!db.hello().isWritablePrimary) throw new Error('rs0 sans primaire après 30 s');
