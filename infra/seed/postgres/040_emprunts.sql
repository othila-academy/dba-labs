-- 2 000 000 emprunts du 1er octobre 2021 au 30 septembre 2026, rendus au plus tard le 15 octobre 2026
-- (l'« aujourd'hui » du fil rouge). Non rendus : 35 % des emprunts d'août et septembre 2026, et 0,5 % des plus anciens.
select setseed(0.44);
insert into emprunt (id, exemplaire_id, adherent_id, date_emprunt, date_retour_prevue, date_retour)
select g, ex, ad, d, d + 21,
       case when d >= date '2026-08-01' and r < 0.35 then null
            when r < 0.005 then null
            else least(d + 1 + floor(random() * 40)::int, date '2026-10-15') end
from (
  select g,
         1 + floor(random() * 250000)::int as ex,
         1 + floor(random() * 50000)::int as ad,
         date '2021-10-01' + floor(random() * 1826)::int as d,
         random() as r
  from generate_series(1, 2000000) g
) s;
