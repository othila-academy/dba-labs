# La configuration de project/ entre dans les bases par copie, jamais par montage :
# même comportement dans un worktree de rejeu, sous Windows, sur Codespaces et en CI.

# Les clés du serveur hérité ne sont jamais dans git : project/legacy/gen-cert.sh, s'il existe, génère celles qui manquent,
# avant chaque démarrage (up, restart, reload, rebuild). Un clone neuf redémarre ainsi sans rien d'autre à faire.
legacy_certs() {
  legacy_active || return 0
  local script="$DBA_PROJECT/legacy/gen-cert.sh"
  [[ -e $script ]] || return 0
  [[ -x $script ]] || die "project/legacy/gen-cert.sh n'est pas exécutable : chmod +x project/legacy/gen-cert.sh"
  info "project/legacy/gen-cert.sh : certificats du serveur hérité"
  "$script" || die "project/legacy/gen-cert.sh a échoué (message ci-dessus) : corrige-le, puis relance la commande"
}

config_sync() {
  legacy_certs
  docker volume create dba-config >/dev/null
  tar -cf - -C "$DBA_ROOT/infra" postgres -C "$DBA_PROJECT" config -C "$DBA_PROJECT" legacy \
    | docker run --rm -i --user 0 --entrypoint sh -v dba-config:/cfg "$DBA_PG_IMAGE" -euc '
        mkdir -p /tmp/src && tar -xf - -C /tmp/src
        rm -rf /cfg/postgres /cfg/project
        mkdir -p /cfg/postgres /cfg/project
        cp /tmp/src/postgres/base.conf /cfg/postgres/postgresql.conf
        cp /tmp/src/postgres/pg_ident.conf /cfg/postgres/pg_ident.conf
        cp -R /tmp/src/config/postgres /cfg/project/postgres
        rm -rf /cfg/legacy
        if [ -d /tmp/src/legacy ]; then cp -R /tmp/src/legacy /cfg/legacy; fi
        chown -R 999:999 /cfg
        find /cfg -type d -exec chmod 755 {} +
        find /cfg -type f -exec chmod 644 {} +
        find /cfg -type f -name "*.key" -exec chmod 600 {} +' \
    || die "copie de la configuration de project/ impossible : vérifie project/config/postgres/"
}
