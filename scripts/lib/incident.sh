# incident <nom> : la panne d'un lab. Elle est décrite dans .othila-lab/incidents/<nom>.sh : c'est une définition du
# cours, que lab update met à jour comme les labs. Le script est joué avec les fonctions de scripts/db (run_psql, info, die).

incidents_list() {
  local file names=() joined
  shopt -s nullglob
  for file in "$DBA_INCIDENTS"/*.sh; do names+=("$(basename "$file" .sh)"); done
  shopt -u nullglob
  if [[ ${#names[@]} -eq 0 ]]; then printf 'aucun'; return; fi
  joined="$(printf '%s, ' "${names[@]}")"
  printf '%s' "${joined%, }"
}

cmd_incident() {
  [[ $# -le 1 ]] || usage_error "incident attend un seul nom, par exemple : scripts/db incident sauvegarde"
  [[ $# -eq 1 ]] || usage_error "incident attend le nom d'une panne (incidents : $(incidents_list))"
  local name=$1
  [[ $name =~ ^[a-z0-9-]+$ && -f "$DBA_INCIDENTS/$name.sh" ]] \
    || die "incident inconnu : $name (incidents : $(incidents_list)) ; npx lab update récupère ceux des nouveaux labs"
  require_stack
  load_env
  # Un sous-shell : un die de l'incident n'arrête que lui, et scripts/db sort avec son code.
  # shellcheck source=/dev/null
  (source "$DBA_INCIDENTS/$name.sh")
}
