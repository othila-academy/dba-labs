-- 50 000 adhérents, inscrits entre 2015 et septembre 2021, avant le premier emprunt de l'historique. Graine fixe : mêmes données à chaque rebuild.
select setseed(0.42);
insert into adherent (id, numero_carte, nom, prenom, email, telephone, date_inscription, site_id)
select g,
       'VAL' || lpad(g::text, 6, '0'),
       nom,
       prenom,
       translate(lower(prenom), 'éèëêàçïîôö', 'eeeeaciioo') || '.' || lower(nom) || '.' || g || '@valmorin.example',
       telephone,
       inscription,
       site
from (
  select g,
         (array['Martin','Bernard','Dubois','Thomas','Robert','Richard','Petit','Durand','Leroy','Moreau',
                'Simon','Laurent','Lefebvre','Michel','Garcia','David','Bertrand','Roux','Vincent','Fournier'])[1 + floor(random() * 20)::int] as nom,
         (array['Camille','Léa','Manon','Chloé','Inès','Jade','Louise','Emma','Lucas','Hugo',
                'Louis','Gabriel','Arthur','Jules','Adam','Nathan','Paul','Sacha','Nina','Rose'])[1 + floor(random() * 20)::int] as prenom,
         case when random() < 0.3 then null else '06' || lpad(floor(random() * 100000000)::bigint::text, 8, '0') end as telephone,
         date '2015-01-01' + floor(random() * 2465)::int as inscription,
         1 + floor(random() * 6)::int as site
  from generate_series(1, 50000) g
) s;
