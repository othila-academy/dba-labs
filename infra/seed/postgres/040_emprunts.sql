-- 2 000 000 emprunts du 1er octobre 2021 au 30 septembre 2026. « Aujourd'hui », dans le fil rouge, c'est le 15 octobre 2026.
select setseed(0.44);

-- 1 967 000 emprunts rendus, au plus tard le 15 octobre 2026. L'historique vient de l'ancien logiciel :
-- les périodes d'emprunt d'un même exemplaire peuvent s'y chevaucher.
insert into emprunt (id, exemplaire_id, adherent_id, date_emprunt, date_retour_prevue, date_retour)
select g, ex, ad, d, d + 21, least(d + 1 + floor(random() * 40)::int, date '2026-10-15')
from (
  select g,
         1 + floor(random() * 250000)::int as ex,
         1 + floor(random() * 50000)::int as ad,
         date '2021-10-01' + floor(random() * 1826)::int as d
  from generate_series(1, 1967000) g
) s;

-- 33 000 emprunts en cours, jamais deux pour le même exemplaire (k * 7 reste distinct jusqu'à 250 000) :
-- 23 000 d'août et septembre 2026, 10 000 plus anciens et jamais rendus.
insert into emprunt (id, exemplaire_id, adherent_id, date_emprunt, date_retour_prevue, date_retour)
select 1967000 + k, 1 + ((k * 7) % 250000), ad, d, d + 21, null
from (
  select k,
         1 + floor(random() * 50000)::int as ad,
         case when k <= 23000 then date '2026-08-01' + floor(random() * 61)::int
              else date '2021-10-01' + floor(random() * 1765)::int end as d
  from generate_series(1, 33000) k
) s;
