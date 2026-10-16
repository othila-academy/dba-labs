-- Les id ont été posés explicitement : chaque séquence repart après le plus grand. Sans séquence
-- (un id saisi à la main), pg_get_serial_sequence rend null et setval ne fait rien.
select setval(pg_get_serial_sequence('site', 'id'), (select max(id) from site));
select setval(pg_get_serial_sequence('adherent', 'id'), (select max(id) from adherent));
select setval(pg_get_serial_sequence('auteur', 'id'), (select max(id) from auteur));
select setval(pg_get_serial_sequence('ouvrage', 'id'), (select max(id) from ouvrage));
select setval(pg_get_serial_sequence('exemplaire', 'id'), (select max(id) from exemplaire));
select setval(pg_get_serial_sequence('emprunt', 'id'), (select max(id) from emprunt));
