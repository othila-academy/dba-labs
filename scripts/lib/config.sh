# La configuration de project/ entre dans les bases par copie, jamais par montage :
# même comportement dans un worktree de rejeu, sous Windows, sur Codespaces et en CI.

config_sync() {
  docker volume create dba-config >/dev/null
  tar -cf - -C "$DBA_ROOT/infra" postgres -C "$DBA_PROJECT" config \
    | docker run --rm -i --user 0 --entrypoint sh -v dba-config:/cfg "$DBA_PG_IMAGE" -euc '
        mkdir -p /tmp/src && tar -xf - -C /tmp/src
        rm -rf /cfg/postgres /cfg/project
        mkdir -p /cfg/postgres /cfg/project
        cp /tmp/src/postgres/base.conf /cfg/postgres/postgresql.conf
        cp /tmp/src/postgres/pg_ident.conf /cfg/postgres/pg_ident.conf
        cp -R /tmp/src/config/postgres /cfg/project/postgres
        chown -R 999:999 /cfg
        find /cfg -type d -exec chmod 755 {} +
        find /cfg -type f -exec chmod 644 {} +' \
    || die "copie de la configuration de project/ impossible : vérifie project/config/postgres/"
}
