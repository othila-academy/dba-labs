import { assert } from '@othila-academy/lab';
import { APP_PG, withLegacyPg } from './legacy.mjs';

export const title = 'Le rôle de l’application';
export const instructions = `Le rôle de l'application, app_mediatheque, est superuser : une injection SQL dans l'application donnerait tout
le serveur, jusqu'à la machine (COPY … TO PROGRAM exécute une commande). Dans init.sql, retire-lui ce pouvoir, et ceux dont il
n'a pas besoin (CREATEROLE, CREATEDB), sans casser l'application : elle doit toujours lire et écrire les tables de mediatheque.
Attention : la table abonne est créée par postgres, après \\connect. À qui appartient-elle alors ?

À expliquer (npx lab submit durcissement role-applicatif) : de quoi l'application a-t-elle réellement besoin, et qui doit posséder ses tables ?`;

export const checks = [
  {
    id: 'app-sans-pouvoirs',
    label: 'app_mediatheque n’est ni superuser, ni CREATEROLE, ni CREATEDB, et l’application lit toujours ses abonnés',
    run: () =>
      withLegacyPg(async (client) => {
        const { rows: [r] } = await client.query("select rolsuper, rolcreaterole, rolcreatedb from pg_roles where rolname = 'app_mediatheque'");
        assert(r, "Attendu : le rôle app_mediatheque, dont l'application a besoin. Constaté : absent.");
        const pouvoirs = [r.rolsuper && 'SUPERUSER', r.rolcreaterole && 'CREATEROLE', r.rolcreatedb && 'CREATEDB'].filter(Boolean);
        assert(pouvoirs.length === 0, `Attendu : app_mediatheque sans pouvoir sur le serveur. Constaté : ${pouvoirs.join(', ')} (\\du dans psql).`);
        try {
          await withLegacyPg((app) => app.query('select count(*) from abonne'), APP_PG);
        } catch (error) {
          throw new Error(`Attendu : l'application lit toujours abonne, avec son mot de passe. Constaté : « ${error.message} ». Qui possède la table, et quels droits a l'application ?`);
        }
      })
  }
];

export const hints = [
  '\\du montre les attributs des rôles. Que perd l’application si tu retires seulement superuser ?',
  'create role app_mediatheque login password … (sans superuser) ; après la création de la table : alter table abonne owner to app_mediatheque, ou des grant select, insert, update, delete.',
  "init.sql : create role app_mediatheque login password 'mediatheque2019'; create database mediatheque owner app_mediatheque; \\connect mediatheque ; create table abonne (…); alter table abonne owner to app_mediatheque; insert …"
];

export const points = 100;
