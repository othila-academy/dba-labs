-- « L'ancien prestataire » a posé deux fois le même index, sous deux noms. Il ralentit chaque écriture
-- dans emprunt et ne sert aucune des requêtes de l'application (lab requete-lente).
create index emprunt_date_retour_prevue_idx on emprunt (date_retour_prevue);
create index idx_emprunt_dateprevue on emprunt (date_retour_prevue);
