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
