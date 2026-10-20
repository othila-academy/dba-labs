export const title = 'Durcissement du serveur hérité';
export const steps = ['authentification', 'role-applicatif', 'chiffrement', 'journalisation', 'mongo', 'reseau', 'plan-securite', 'tls-mongo'];
export const duration = '1 h 30';
export const summary = `Mise en situation. L'ancien prestataire a laissé deux serveurs à la médiathèque, pg-legacy et mongo-legacy, aussi
ouverts qu'on peut l'être. Tu les sécurises, un point après l'autre, dans project/legacy/ : c'est là qu'est leur configuration,
et scripts/db rebuild les recrée depuis tes fichiers. Puis tu écris la stratégie de sécurité des deux bases. La dernière étape,
facultative, chiffre aussi MongoDB.
Avant ce lab : COMPOSE_PROFILES=rs,legacy dans project/stack.env, puis scripts/db rebuild (lis project/legacy/README.md).`;
export const objectives = [
  'lire et corriger pg_hba.conf',
  'passer des mots de passe de md5 à SCRAM',
  'retirer à un rôle applicatif ce dont il n’a pas besoin',
  'chiffrer les connexions (SSL) sans mettre la clé dans git',
  'journaliser connexions et requêtes lentes',
  'activer l’authentification de MongoDB',
  'argumenter une stratégie de sécurité'
];
// Au départ, le serveur hérité tel que l'a laissé le prestataire : actif, et reconstruit depuis sa configuration d'origine.
export const replay = {
  start: ["printf 'COMPOSE_PROFILES=rs,legacy\\n' > project/stack.env", 'scripts/db rebuild']
};
