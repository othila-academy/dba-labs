import { withLegacyMongo } from './legacy.mjs';

export const title = 'Facultatif : TLS pour MongoDB';
export const explain = "Que faudrait-il pour passer en requireTLS sans gêner l'exploitation ?";
export const instructions = `Facultatif. Chiffre aussi mongo-legacy. gen-cert.sh génère un second certificat (CN=mongo-legacy) dans
project/legacy/mongo/. mongod attend un seul fichier PEM, clé et certificat bout à bout, et, depuis MongoDB 7, une autorité de
confiance (CAFile) : ici, le certificat lui-même. Dans mongod.conf, net.tls :
  mode: preferTLS, certificateKeyFile, CAFile, et allowConnectionsWithoutCertificates: true (les clients n'ont pas de certificat).
preferTLS et non requireTLS : le contrôle de santé et l'initialisation de scripts/db se connectent en clair, depuis le
conteneur. En production, ce serait requireTLS. Le PEM contient la clé : il reste hors de git.
Puis scripts/db rebuild, et : mongosh "mongodb://mongo-legacy:27017/?directConnection=true&tls=true&tlsAllowInvalidCertificates=true".

À expliquer (npx lab submit durcissement tls-mongo) : que faudrait-il pour passer en requireTLS sans gêner l'exploitation ?`;

export const checks = [
  {
    id: 'mongo-tls',
    label: 'mongo-legacy accepte les connexions TLS (certificat auto-signé de gen-cert.sh)',
    run: async () => {
      await withLegacyMongo((client) => client.db('admin').command({ ping: 1 }));
      try {
        await withLegacyMongo((client) => client.db('admin').command({ ping: 1 }), { tls: true, tlsAllowInvalidCertificates: true });
      } catch (error) {
        throw new Error(`Attendu : une connexion TLS à mongo-legacy. Constaté : « ${error.message} ». net.tls dans mongod.conf, puis scripts/db rebuild.`);
      }
    }
  }
];

export const hints = [
  'Le serveur a besoin de sa clé et de son certificat dans un seul fichier, et d’une autorité pour vérifier les certificats.',
  'cat mongo/server.key mongo/server.crt > mongo/server.pem ; mongod.conf : net.tls.mode, certificateKeyFile, CAFile, allowConnectionsWithoutCertificates.',
  'net: { tls: { mode: preferTLS, certificateKeyFile: /etc/dba/legacy/mongo/server.pem, CAFile: /etc/dba/legacy/mongo/server.crt, allowConnectionsWithoutCertificates: true } }'
];

export const points = 50;
