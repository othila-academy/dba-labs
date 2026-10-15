# doctor : ce qui doit être vrai sur le poste avant le cours ; chaque ligne dit quoi faire si elle est rouge.

DOCTOR_FAILED=0
doctor_line() {
  if [[ $1 == ok ]]; then
    printf '  ✓ %s\n' "$2"
  else
    printf '  ✗ %s\n    → %s\n' "$2" "$3"
    DOCTOR_FAILED=1
  fi
}

cmd_doctor() {
  info "Vérification du poste"
  if ! docker info >/dev/null 2>&1; then
    doctor_line ko "Docker répond" "lance Docker Desktop (ou le service docker), puis relance scripts/db doctor"
    return 1
  fi
  doctor_line ok "Docker répond"
  load_env
  local mem_mib disk_gib arch
  # Docker Desktop réglé sur 4 Go en annonce environ 3,8 Gio : le seuil est à 3,5 Gio, le conseil reste 4 Go.
  mem_mib=$(($(docker info --format '{{.MemTotal}}') / 1024 / 1024))
  if ((mem_mib >= 3584)); then doctor_line ok "mémoire de Docker : $((mem_mib / 1024)),$((mem_mib % 1024 * 10 / 1024)) Gio"; else
    doctor_line ko "mémoire de Docker : $((mem_mib / 1024)),$((mem_mib % 1024 * 10 / 1024)) Gio (4 Go conseillés)" "Docker Desktop → Réglages → Resources → Memory : 4 Go ou plus"
  fi
  disk_gib=$(($(docker run --rm "$DBA_PG_IMAGE" df -Pk / | awk 'NR == 2 { print $4 }') / 1024 / 1024))
  if ((disk_gib >= 10)); then doctor_line ok "disque libre pour Docker : ${disk_gib} Go"; else
    doctor_line ko "disque libre pour Docker : ${disk_gib} Go (10 au moins)" "libère de la place : docker system prune, ou agrandis le disque de Docker Desktop"
  fi
  arch="$(docker info --format '{{.Architecture}}')"
  if [[ $arch == x86_64 ]]; then
    if docker run --rm "$DBA_PG_IMAGE" grep -qw avx /proc/cpuinfo; then doctor_line ok "processeur : AVX disponible (MongoDB 8)"; else
      doctor_line ko "processeur sans AVX : MongoDB 8 ne démarre pas" "travaille sur GitHub Codespaces (docs/AVANT-LE-COURS.md)"
    fi
  else
    doctor_line ok "processeur : $arch"
  fi
  local image
  for image in "$DBA_PG_IMAGE" "$DBA_MONGO_IMAGE"; do
    if docker image inspect "$image" >/dev/null 2>&1; then doctor_line ok "image présente : ${image%@*}"; else
      doctor_line ko "image absente : ${image%@*}" "scripts/db up la télécharge ; à faire avant le cours, sur une bonne connexion"
    fi
  done
  return "$DOCTOR_FAILED"
}
