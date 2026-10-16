# Le starter : ce que l'apprenant reçoit au tag base, sans solution.
equals() { [[ "$1" == "$2" ]] || { echo "« $1 », attendu « $2 »"; return 1; }; }
empty_dir() { [[ -z "$(find "$DBA_ROOT/project/$1" -type f ! -name .gitkeep)" ]]; }
for dir in schema post mongo ops runbooks; do
  check "starter : project/$dir vide (aucune solution)" empty_dir "$dir"
done
check "formation.json : la préparation du rejeu est scripts/db rebuild" equals "$(jq -r .prepare "$DBA_ROOT/.othila-lab/formation.json")" "scripts/db rebuild"
check "formation.json : lu par lab-cli (catalogue)" output_matches '"prise-en-main"' npx --no-install lab catalog --json
check ".othila-lab/local ignoré par git" grep -qx 'local/' "$DBA_ROOT/.othila-lab/.gitignore"
check "backups/ ignoré par git" bash -c "cd '$DBA_ROOT' && git check-ignore -q backups/x"
