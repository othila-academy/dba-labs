-- Le rôle applicatif sans pouvoir sur le serveur, son mot de passe haché en SCRAM (password_encryption), et sa base,
-- dont il possède les tables : il lit et écrit les siennes, rien d'autre.
create role app_mediatheque login password 'mediatheque2019';
create database mediatheque owner app_mediatheque;
\connect mediatheque
create table abonne (id integer primary key, nom text, email text);
alter table abonne owner to app_mediatheque;
insert into abonne values (1, 'Durand', 'durand@valmorin.example'), (2, 'Leroy', 'leroy@valmorin.example');
