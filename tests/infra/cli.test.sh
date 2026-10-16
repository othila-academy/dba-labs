# Usage et erreurs de scripts/db, sans dépendre d'une stack démarrée.
DB="$DBA_ROOT/scripts/db"

check "sans commande : usage, code 2" expect_exit 2 "$DB"
check "sans commande : l'usage liste rebuild" output_matches 'rebuild +reconstruit tout depuis project/' "$DB"
check "aide : code 0" expect_exit 0 "$DB" help
check "commande inconnue : message en français" output_matches '^commande inconnue : nope' "$DB" nope
check "commande inconnue : code 2" expect_exit 2 "$DB" nope
check "restart sans service : code 2" expect_exit 2 "$DB" restart
check "Docker injoignable : message en français" output_matches 'Docker ne répond pas' env DOCKER_HOST=unix:///nonexistent "$DB" status
check "Docker injoignable : code 1, pas de trace Bash" expect_exit 1 env DOCKER_HOST=unix:///nonexistent "$DB" up

# Un clone Windows en CRLF casserait les shebangs et les fichiers sourcés : git doit garder LF partout.
no_crlf() { ! grep -rlI $'\r' "$DBA_ROOT/scripts" "$DBA_ROOT/infra" "$DBA_ROOT/tests" "$DBA_ROOT/project"; }
check "fins de ligne LF imposées par .gitattributes" grep -qx '\* text=auto eol=lf' "$DBA_ROOT/.gitattributes"
check "aucun CRLF dans scripts, infra, tests, project" no_crlf

check "rebuild avec un argument : code 2" expect_exit 2 "$DB" rebuild rs
check "down avec un argument : code 2" expect_exit 2 "$DB" down x
check "status avec un argument : code 2" expect_exit 2 "$DB" status x
check "attach avec un argument : code 2" expect_exit 2 "$DB" attach x
check "doctor avec un argument : code 2" expect_exit 2 "$DB" doctor x

# stack.env est lu comme un fichier .env, jamais exécuté.
BADENV="$(mktemp -d)"
cp -R "$DBA_PROJECT" "$BADENV/project"
echo 'COMPOSE_PROFILES=rs legacy' >"$BADENV/project/stack.env"
check "stack.env avec une espace : message qui montre la virgule" output_matches 'stack\.env.*sépare les profils par des virgules' env DBA_PROJECT="$BADENV/project" "$DB" status
check "stack.env avec une espace : rien n'est exécuté" bash -c "! DBA_PROJECT='$BADENV/project' '$DB' status 2>&1 | grep -qE 'command not found|line [0-9]+:'"
echo 'COMPOSE_PROFILES=rss' >"$BADENV/project/stack.env"
check "stack.env avec un profil inconnu : refusé, avec la liste" output_matches 'profil inconnu : rss.*project/stack\.env' env DBA_PROJECT="$BADENV/project" "$DB" up
echo 'DBA_AUTRE=1' >"$BADENV/project/stack.env"
check "stack.env avec une autre clé : refusée" output_matches 'stack\.env : DBA_AUTRE.*seule la clé COMPOSE_PROFILES' env DBA_PROJECT="$BADENV/project" "$DB" status
rm -rf "$BADENV"
check "psql sans Docker : message français" output_matches 'Docker ne répond pas' env DOCKER_HOST=unix:///nonexistent "$DB" psql

# incident : la panne d'un lab, décrite dans les définitions du cours.
FIX_INCIDENTS="$DBA_ROOT/tests/infra/fixtures/incidents"
check "aide : incident listé" output_matches 'incident \[nom\]' "$DB" help
check "incident sans nom : code 2" expect_exit 2 env DBA_INCIDENTS="$FIX_INCIDENTS" "$DB" incident
check "incident sans nom : la liste des incidents" output_matches 'incidents : essai, panne' env DBA_INCIDENTS="$FIX_INCIDENTS" "$DB" incident
check "incident inconnu : message et code 1" output_matches '^erreur : incident inconnu : nope' env DBA_INCIDENTS="$FIX_INCIDENTS" "$DB" incident nope
check "incident hors du dossier : refusé" expect_exit 1 env DBA_INCIDENTS="$FIX_INCIDENTS" "$DB" incident ../cli
check "incident avec deux noms : code 2" expect_exit 2 env DBA_INCIDENTS="$FIX_INCIDENTS" "$DB" incident essai panne
