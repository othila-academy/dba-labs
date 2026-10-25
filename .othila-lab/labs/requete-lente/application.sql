-- La charge de l'application des médiathèques, à rejouer pour pg_stat_statements :
--   scripts/db psql postgres valmorin -f .othila-lab/labs/requete-lente/application.sql
\o /dev/null
-- Les compteurs remis à zéro (si l'extension existe) : sans cela, les insertions de données du rebuild arrivent en tête.
do $$ begin if exists (select from pg_extension where extname = 'pg_stat_statements') then perform pg_stat_statements_reset(); end if; end $$;
select count(*) from site;
select id, nom, prenom from adherent where numero_carte = 'VAL004242';
select titre from ouvrage where isbn = '9780000004242';
-- Q1, l'historique d'un adhérent (fiche de l'adhérent, au guichet), trois fois.
select e.date_emprunt, e.date_retour, o.titre
from emprunt e
join exemplaire x on x.id = e.exemplaire_id
join ouvrage o on o.id = x.ouvrage_id
where e.adherent_id = 4242
  and e.date_emprunt between date '2025-01-01' and date '2025-12-31'
order by e.date_emprunt;
\g
\g
-- Q2, les retards en cours par site (tableau du matin), trois fois.
select s.nom, count(*) as retards
from emprunt e
join exemplaire x on x.id = e.exemplaire_id
join site s on s.id = x.site_id
where e.date_retour is null
  and e.date_retour_prevue < date '2026-10-15'
group by s.nom
order by s.nom;
\g
\g
\o
\echo charge rejouée ; à lire : select calls, round(total_exec_time) as total_ms, query from pg_stat_statements order by total_exec_time desc limit 5;
