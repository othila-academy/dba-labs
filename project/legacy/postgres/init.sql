-- Ce que l'ancien prestataire a créé : un rôle applicatif tout-puissant, au mot de passe en md5, et sa base.
set password_encryption = 'md5';
create role app_mediatheque login superuser password 'mediatheque2019';
create database mediatheque owner app_mediatheque;
\connect mediatheque
create table abonne (id integer primary key, nom text, email text);
insert into abonne values (1, 'Durand', 'durand@valmorin.example'), (2, 'Leroy', 'leroy@valmorin.example');
