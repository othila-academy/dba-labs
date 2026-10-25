import { assert } from '@othila-academy/lab';
import { withLegacyPg } from './legacy.mjs';

export const title = 'L’authentification de PostgreSQL';
export const instructions = `Le serveur hérité est décrit dans project/legacy/ (lis son README). Active-le : COMPOSE_PROFILES=rs,legacy dans
project/stack.env, puis scripts/db rebuild. Connecte-toi : psql -h pg-legacy -U postgres. Aucun mot de passe demandé : pourquoi ?
Corrige l'authentification, dans project/legacy/postgres/ :
  - pg_hba.conf : plus aucune règle trust ; scram-sha-256 pour toute connexion par le réseau ; en local (le socket du
    conteneur, par lequel scripts/db initialise le serveur), peer pour postgres ;
  - postgresql.conf : password_encryption = scram-sha-256 ;
  - init.sql : un mot de passe haché en md5 doit être redonné pour être haché en SCRAM. Attention, init.sql commence par
    set password_encryption = 'md5', qui l'emporte sur postgresql.conf pendant qu'il s'exécute : retire cette ligne.
Une fois trust retiré, psql -h pg-legacy -U postgres demande un mot de passe : celui du cours, valmorin-lab (infra/.env.lab).
Le mot de passe de l'application ne change pas (mediatheque2019) : l'équipe applicative ne peut pas le modifier aujourd'hui.
Puis scripts/db rebuild : il recrée le serveur hérité depuis tes fichiers. pg_hba_file_rules et pg_authid montrent l'effet.

À expliquer (npx lab submit durcissement authentification) : pourquoi un mot de passe haché en md5 ne devient-il pas SCRAM quand on change seulement password_encryption ?`;

export const prediction = {
  promptId: 'durcissement-trust',
  question: 'Avec la règle « host all all 0.0.0.0/0 trust », un mot de passe faux est-il refusé ?',
  choices: ['oui', 'non'],
  expected: 'non'
};

const RESEAU = new Set(['scram-sha-256', 'reject']);
const LOCAL = new Set(['peer', 'scram-sha-256', 'reject']);

export const checks = [
  {
    id: 'hba-sans-trust',
    label: 'pg_hba de pg-legacy : aucune règle trust, scram-sha-256 pour toute connexion réseau (peer accepté en local)',
    run: () =>
      withLegacyPg(async (client) => {
        const { rows } = await client.query('select line_number, type, user_name, auth_method, error from pg_hba_file_rules order by line_number');
        const fautes = rows.flatMap((r) => {
          if (r.error) return [`ligne ${r.line_number} : ${r.error}`];
          const ok = r.type === 'local' ? LOCAL.has(r.auth_method) : RESEAU.has(r.auth_method);
          return ok ? [] : [`ligne ${r.line_number} : ${r.type} ${r.user_name.join(',')} ${r.auth_method}`];
        });
        assert(fautes.length === 0, `Attendu : ni trust, ni md5, ni password ; scram-sha-256 par le réseau. Constaté : ${fautes.join(' ; ')} (select * from pg_hba_file_rules).`);
      })
  },
  {
    id: 'mots-de-passe-scram',
    label: 'pg-legacy hache les mots de passe en SCRAM (password_encryption), et ceux des rôles de connexion le sont',
    run: () =>
      withLegacyPg(async (client) => {
        const { rows: [r] } = await client.query(
          `select current_setting('password_encryption') as enc,
             coalesce(string_agg(rolname || ' (' || left(rolpassword, 3) || ')', ', ')
               filter (where rolpassword not like 'SCRAM-SHA-256$%'), '') as hors_scram
           from pg_authid where rolcanlogin and rolpassword is not null`
        );
        assert(r.enc === 'scram-sha-256', `Attendu : password_encryption = scram-sha-256. Constaté : ${r.enc}.`);
        assert(!r.hors_scram, `Attendu : chaque mot de passe en SCRAM. Constaté : ${r.hors_scram}. Un hachage ne se convertit pas : il faut redonner le mot de passe.`);
      })
  }
];

export const hints = [
  'Chaque ligne de pg_hba.conf dit : type de connexion, base, rôle, adresse, méthode. La première qui correspond gagne. Laquelle accepte tout le monde ?',
  "select line_number, type, user_name, auth_method from pg_hba_file_rules; select rolname, left(rolpassword, 14) from pg_authid where rolcanlogin; puis retire « set password_encryption = 'md5' » de init.sql.",
  'pg_hba.conf : local all postgres peer, puis host all all 0.0.0.0/0 scram-sha-256 et host all all ::/0 scram-sha-256 (hostssl une fois le SSL en place) ; postgresql.conf : password_encryption = scram-sha-256 ; init.sql sans la ligne md5.'
];

export const points = 150;
