-- Après les données : la surveillance des requêtes et les index des deux requêtes de l'application.
create extension if not exists pg_stat_statements;

-- Q1, l'historique d'un adhérent : l'égalité sur adherent_id d'abord, la plage de dates ensuite.
create index emprunt_adherent_date_emprunt_idx on emprunt (adherent_id, date_emprunt);

-- Q2, les retards en cours : 33 000 emprunts en cours sur 2 millions ; l'index partiel ne range que ceux-là.
create index emprunt_en_cours_retour_prevue_idx on emprunt (date_retour_prevue) where date_retour is null;

-- L'ancien prestataire avait posé deux fois le même index, et il ne sert aucune requête de l'application.
drop index idx_emprunt_dateprevue;
