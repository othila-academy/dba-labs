# shellcheck shell=bash
# L'incident du lab incident-verrou, joué par scripts/db incident verrou. Un script d'inventaire (app_valmorin) verrouille un
# exemplaire et reste « idle in transaction » ; le guichet de la médiathèque centrale tente d'en enregistrer le prêt, et
# attend. Les deux sessions tournent dans le conteneur pg (docker compose exec -d) : elles survivent à cette commande et au
# devcontainer. Seules les données bougent ; rejoué pendant que l'inventaire tient son verrou, il ne relance rien.
[[ -n "$(run_psql postgres -tAc "select 1 from pg_roles where rolname = 'app_valmorin'")" ]] \
  || die "le rôle app_valmorin n'existe pas : le lab roles doit être fait (puis scripts/db rebuild)"
[[ -n "$(run_psql valmorin -tAc "select to_regclass('public.emprunt')")" ]] \
  || die "la table emprunt n'existe pas : scripts/db rebuild (ou le runbook du lab sauvegarde)"

# Le nombre de sessions d'une application, avec une condition de plus sur pg_stat_activity.
sessions() { run_psql postgres -tAc "select count(*) from pg_stat_activity where application_name = '$1'${2:+ and $2}"; }
# Attendre une session dans un état donné, 10 s au plus.
attendre() {
  local _
  for _ in $(seq 1 50); do
    [[ "$(sessions "$1" "$2")" -gt 0 ]] && return 0
    sleep 0.2
  done
  return 1
}

if [[ "$(sessions inventaire)" -gt 0 ]]; then
  info "l'inventaire tient toujours son verrou : rien de plus à lancer"
else
  # Un exemplaire en rayon sans emprunt en cours, et le premier adhérent : un prêt que toute solution du lab schema accepte.
  read -r ex ad < <(run_psql valmorin -tAF' ' -c "select (select min(x.id) from exemplaire x where x.etat <> 'retire'
      and not exists (select 1 from emprunt e where e.exemplaire_id = x.id and e.date_retour is null)), (select min(id) from adherent)")
  # shellcheck disable=SC2016 # $SQL est développé par le sh du conteneur, pas ici
  compose exec -d -T -u postgres -e PGAPPNAME=inventaire -e SQL="select id from exemplaire where id = $ex for update" pg \
    sh -c '(printf "begin;\n%s;\n" "$SQL"; sleep 3600) | psql -qX -U app_valmorin -d valmorin >/dev/null 2>&1'
  attendre inventaire "state = 'idle in transaction'" || die "la session d'inventaire ne démarre pas : scripts/db status"
  # Le guichet réessaie chaque seconde, 10 min au plus, comme l'application : avec un lock_timeout, chaque essai abandonne vite.
  # shellcheck disable=SC2016 # $SQL est développé par le sh du conteneur, pas ici
  compose exec -d -T -u postgres -e PGAPPNAME=guichet-centre \
    -e SQL="insert into emprunt (exemplaire_id, adherent_id, date_emprunt, date_retour_prevue) values ($ex, $ad, date '2026-10-15', date '2026-11-05')" pg \
    sh -c 'for i in $(seq 1 600); do psql -qX -U app_valmorin -d valmorin -c "$SQL" >/dev/null 2>&1 && break; sleep 1; done'
  attendre guichet-centre "wait_event_type = 'Lock'" || true
fi

info ""
info "09:58 — La médiathèque centrale appelle : au guichet, l'enregistrement d'un prêt tourne sans fin."
info "10:01 — L'équipe applicative a lancé ce matin un script d'inventaire des exemplaires ; « il tourne encore »."
info "10:02 — À toi : trouve ce qui bloque le guichet, débloque-le sans perdre son prêt, et fais en sorte que cela ne se reproduise pas."
