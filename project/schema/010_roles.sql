-- Les rôles de la base valmorin : un propriétaire, l'application, la lecture analytique.
-- Mots de passe de lab, imposés par la fiche : jamais en production.

-- Le propriétaire du schéma : il fait évoluer la structure, sans aucun pouvoir sur le serveur.
create role dba_valmorin login password 'dba-valmorin-lab' nosuperuser nocreaterole nocreatedb;
alter table site owner to dba_valmorin;
alter table adherent owner to dba_valmorin;
alter table auteur owner to dba_valmorin;
alter table ouvrage owner to dba_valmorin;
alter table ouvrage_auteur owner to dba_valmorin;
alter table exemplaire owner to dba_valmorin;
alter table emprunt owner to dba_valmorin;
grant usage, create on schema public to dba_valmorin;

-- L'application : les lignes, jamais la structure.
create role app_valmorin login password 'app-valmorin-lab';
grant select, insert, update, delete on all tables in schema public to app_valmorin;
grant usage on all sequences in schema public to app_valmorin;

-- Le service culturel : tout lire, sauf les coordonnées des adhérents ; ne rien écrire.
create role analyste login password 'analyste-lab';
grant select on site, auteur, ouvrage, ouvrage_auteur, exemplaire, emprunt to analyste;
grant select (id, numero_carte, nom, prenom, date_inscription, site_id) on adherent to analyste;
