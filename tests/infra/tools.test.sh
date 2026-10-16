# Le devcontainer fournit tout l'outillage : clients de la même version majeure que les serveurs, Docker, Node, lab.
node_major() { node -p 'process.versions.node.split(".")[0] >= 22' | grep -qx true; }

check "psql est en version 18" output_matches '^psql \(PostgreSQL\) 18\.' psql --version
check "pg_dump et pg_restore sont en version 18" output_matches ' 18\.' pg_restore --version
check "mongosh répond" mongosh --version
check "mongodump et mongorestore répondent" mongorestore --version
check "Docker CLI et Compose v2" docker compose version
check "Node 22 ou plus" node_major
check "jq, openssl et shellcheck présents" bash -c 'command -v jq && command -v openssl && command -v shellcheck'
check "npx lab répond dans le conteneur" npx --no-install lab --help

# Sur Docker Desktop, le dépôt monté paraît parfois appartenir à un autre utilisateur juste après une écriture :
# git refuse alors de le lire (« dubious ownership »), et lab init ne trouve plus le tag base.
git_stable() {
  local i
  for i in $(seq 1 10); do
    git -C "$DBA_ROOT" config dba.essai "$i" && git -C "$DBA_ROOT" rev-parse --verify --quiet HEAD >/dev/null || return 1
  done
  git -C "$DBA_ROOT" config --unset dba.essai
}
check "git lit le dépôt monté juste après une écriture (safe.directory)" git_stable
