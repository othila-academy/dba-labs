# shellcheck shell=bash
# L'incident du lab sauvegarde, joué par scripts/db incident sauvegarde (avec ses fonctions et ses identifiants).
# Il n'altère que les données, jamais project/ ; le rejouer ne change rien de plus.
[[ -n "$(run_psql postgres -tAc "select 1 from pg_database where datname = 'valmorin'")" ]] \
  || die "la base valmorin n'existe pas : scripts/db rebuild d'abord"
[[ -n "$(run_psql valmorin -tAc "select to_regclass('public.adherent')")" ]] \
  || die "la table adherent n'existe pas : le lab schema doit être fait (puis scripts/db rebuild)"

# 12 inscriptions depuis la sauvegarde du matin (cartes VAL050001 à VAL050012, vérifiées par le lab), puis le nettoyage fautif.
run_psql valmorin -1 <<'SQL'
insert into adherent (numero_carte, nom, prenom, email, telephone, date_inscription, site_id)
select 'VAL' || lpad((50000 + g)::text, 6, '0'),
       (array['Morel','Girard','André','Mercier','Blanc','Guérin','Boyer','Garnier','Chevalier','François','Legrand','Gauthier'])[g],
       (array['Lina','Malo','Zoé','Tom','Alice','Noah','Lou','Ethan','Mila','Léo','Anna','Marius'])[g],
       'nouvel.adherent.' || g || '@valmorin.example',
       null,
       date '2026-10-15',
       1 + g % 6
from generate_series(1, 12) g
where not exists (select 1 from adherent a where a.numero_carte = 'VAL' || lpad((50000 + g)::text, 6, '0'));
drop table if exists emprunt cascade;
SQL

info ""
info "16:42 — L'accueil de la médiathèque centrale appelle : plus aucun prêt ne passe, l'application affiche"
info "        « relation \"emprunt\" does not exist »."
info "16:45 — Un stagiaire reconnaît avoir lancé son script de nettoyage sur la base de production, au lieu de sa copie."
info "        Depuis la sauvegarde de ce matin, 12 lecteurs se sont inscrits aux guichets : ils ne doivent pas être perdus."
info "16:46 — À toi : remets les emprunts en service, sans perdre ces inscriptions."
