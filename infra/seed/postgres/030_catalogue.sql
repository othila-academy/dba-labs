-- Le catalogue : 20 000 auteurs, 100 000 ouvrages (1 à 3 auteurs chacun), 250 000 exemplaires sur les 6 sites.
select setseed(0.43);
insert into auteur (id, nom, prenom)
select g,
       (array['Arnaud','Benoît','Carré','Delmas','Esnault','Faure','Gauthier','Hamon','Imbert','Joly',
              'Klein','Lemaire','Marchand','Noël','Olivier','Perrin','Quentin','Renaud','Sauvage','Tessier'])[1 + floor(random() * 20)::int],
       (array['Anne','Bruno','Claire','Denis','Élise','François','Gisèle','Henri','Iris','Jean',
              'Karine','Luc','Marie','Noé','Odile','Pierre','Rémi','Sophie','Théo','Yvonne'])[1 + floor(random() * 20)::int]
from generate_series(1, 20000) g;

insert into ouvrage (id, isbn, titre, annee, editeur)
select g,
       case when random() < 0.15 then null else '978' || lpad(g::text, 10, '0') end,
       (array['Le jardin','La rivière','Les voyages','Le silence','La maison','Les nuits','La mémoire','Le port','La forêt','Les secrets'])[1 + floor(random() * 10)::int]
         || ' ' ||
       (array['oublié','du nord','des brumes','perdu','de Valmorin','sans fin','d''hiver','retrouvé','du Morin','éternel'])[1 + floor(random() * 10)::int],
       1950 + floor(random() * 76)::int,
       case when random() < 0.1 then null
            else (array['Gallimard','Seuil','Actes Sud','Flammarion','Albin Michel','Grasset','P.O.L','Minuit','Stock','Fayard'])[1 + floor(random() * 10)::int] end
from generate_series(1, 100000) g;

-- 1 à 3 auteurs distincts par ouvrage : k * 7919 garde les auteurs d'un même ouvrage différents.
insert into ouvrage_auteur (ouvrage_id, auteur_id)
select o, 1 + ((o * 31 + k * 7919) % 20000)
from (select o, 1 + floor(random() * 3)::int as n from generate_series(1, 100000) o) s,
     lateral generate_series(1, s.n) k;

insert into exemplaire (id, ouvrage_id, site_id, code_barre, etat)
select g,
       1 + floor(random() * 100000)::int,
       1 + floor(random() * 6)::int,
       'EX' || lpad(g::text, 8, '0'),
       (array['neuf','bon','bon','bon','abime','retire'])[1 + floor(random() * 6)::int]
from generate_series(1, 250000) g;
