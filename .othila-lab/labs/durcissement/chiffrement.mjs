import { existsSync } from 'node:fs';
import path from 'node:path';
import { assert } from '@othila-academy/lab';
import { DOWN, ROOT, withPg } from '../../shared/db.mjs';
import { gitStatusOf } from '../../shared/fichiers.mjs';
import { APP_PG, LEGACY_DOWN, withLegacyPg } from './legacy.mjs';

export const title = 'Chiffrer les connexions';
export const instructions = `Mots de passe et données passent en clair sur le réseau. Active le chiffrement de pg-legacy :
  - écris project/legacy/gen-cert.sh, exécutable : il génère, s'ils manquent, un certificat auto-signé et sa clé privée
    (openssl req -x509 -newkey rsa:2048 -nodes …) dans project/legacy/postgres/ ; scripts/db le lance avant de démarrer le
    serveur hérité, à chaque up et à chaque rebuild ;
  - la clé privée ne va jamais dans git : un .gitignore dans project/legacy/ l'écarte (git status ne doit pas la montrer) ;
  - postgresql.conf : ssl = on, et ssl_cert_file et ssl_key_file vers /etc/dba/legacy/postgres/… (scripts/db y copie project/legacy/) ;
  - pg_hba.conf : hostssl au lieu de host, pour refuser toute connexion en clair.
Puis scripts/db rebuild, et : psql "host=pg-legacy user=postgres sslmode=require" -c 'select * from pg_stat_ssl where pid = pg_backend_pid()'.

À expliquer (npx lab submit durcissement chiffrement) : contre quoi protège un certificat auto-signé, et contre quoi ne protège-t-il pas ?`;

const COPIE = '/etc/dba/legacy/';

export const checks = [
  {
    id: 'ssl-actif',
    label: 'pg-legacy a ssl = on, et une connexion chiffrée aboutit (pg_stat_ssl)',
    run: () =>
      withLegacyPg(async (client) => {
        const { rows: [r] } = await client.query("select current_setting('ssl') as ssl, (select ssl from pg_stat_ssl where pid = pg_backend_pid()) as chiffree");
        assert(r.ssl === 'on', 'Attendu : ssl = on. Constaté : off. Le serveur trouve-t-il son certificat et sa clé ?');
        assert(r.chiffree, 'Attendu : une connexion chiffrée. Constaté : en clair.');
      })
  },
  {
    id: 'connexion-claire-refusee',
    label: 'pg-legacy refuse une connexion non chiffrée, même avec le bon mot de passe',
    run: async () => {
      try {
        await withPg(async () => {}, { host: 'pg-legacy', ...APP_PG, ssl: false });
      } catch (error) {
        if (/no encryption|rejects connection/.test(error.message)) return;
        throw error.message === DOWN ? new Error(LEGACY_DOWN) : error;
      }
      throw new Error('Attendu : pg-legacy refuse une connexion en clair. Constaté : acceptée. Une règle host laisse passer le clair ; hostssl, non.');
    }
  },
  {
    id: 'cle-hors-git',
    label: 'la clé privée du certificat de pg-legacy vient de project/legacy/ et n’est pas suivie par git',
    run: () =>
      withLegacyPg(async (client) => {
        const { rows: [r] } = await client.query("select current_setting('ssl') as ssl, current_setting('ssl_key_file') as cle");
        assert(r.ssl === 'on', 'Attendu : ssl = on, avec une clé générée dans project/legacy/. Constaté : ssl = off.');
        assert(r.cle.startsWith(COPIE), `Attendu : une clé copiée depuis project/legacy/ (${COPIE}…). Constaté : ssl_key_file = ${r.cle}.`);
        const rel = `project/legacy/${r.cle.slice(COPIE.length)}`;
        assert(existsSync(path.join(ROOT, rel)), `Attendu : ${rel}, générée par project/legacy/gen-cert.sh. Constaté : absente.`);
        const etat = gitStatusOf(ROOT, rel);
        assert(etat !== 'suivi', `Attendu : ${rel} hors de git. Constaté : elle est suivie (git ls-files). git rm --cached, puis un .gitignore.`);
        assert(etat === 'ignore', `Attendu : ${rel} écartée par un .gitignore. Constaté : git status la montre : un git add -A l'enverrait.`);
      })
  }
];

export const hints = [
  'Il faut trois choses : un certificat et sa clé, que le serveur les trouve, et que pg_hba.conf exige le chiffrement. Et une quatrième : que la clé ne parte jamais avec le code.',
  "openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj /CN=pg-legacy -keyout postgres/server.key -out postgres/server.crt ; postgresql.conf : ssl = on, ssl_cert_file = '/etc/dba/legacy/postgres/server.crt', ssl_key_file = '/etc/dba/legacy/postgres/server.key' ; un .gitignore avec *.key.",
  'gen-cert.sh : set -euo pipefail ; cd "$(dirname "$0")" ; [[ -f postgres/server.key ]] || openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj /CN=pg-legacy -keyout postgres/server.key -out postgres/server.crt ; project/legacy/.gitignore : *.key, *.pem, *.crt ; pg_hba.conf : hostssl all all 0.0.0.0/0 scram-sha-256.'
];

export const points = 150;
