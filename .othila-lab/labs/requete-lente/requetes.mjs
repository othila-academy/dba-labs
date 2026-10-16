// Les deux requêtes de l'application, mot pour mot celles de la fiche, de application.sql et des checks.
export const Q1 = `select e.date_emprunt, e.date_retour, o.titre
from emprunt e
join exemplaire x on x.id = e.exemplaire_id
join ouvrage o on o.id = x.ouvrage_id
where e.adherent_id = 4242
  and e.date_emprunt between date '2025-01-01' and date '2025-12-31'
order by e.date_emprunt`;

export const Q2 = `select s.nom, count(*) as retards
from emprunt e
join exemplaire x on x.id = e.exemplaire_id
join site s on s.id = x.site_id
where e.date_retour is null
  and e.date_retour_prevue < date '2026-10-15'
group by s.nom
order by s.nom`;
