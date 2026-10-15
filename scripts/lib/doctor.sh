# doctor : ce qui doit être vrai sur le poste avant le cours ; chaque ligne dit quoi faire si elle est rouge.
# Rien n'y télécharge d'image : hors ligne ou derrière un proxy, doctor doit encore pouvoir conclure.

DOCTOR_FAILED=0
doctor_line() {
  case $1 in
    ok) printf '  ✓ %s\n' "$2" ;;
    warn) printf '  ⚠ %s\n    → %s\n' "$2" "$3" ;;
    *)
      printf '  ✗ %s\n    → %s\n' "$2" "$3"
      DOCTOR_FAILED=1
      ;;
  esac
}

# Noyaux 6.19.0 à 7.0.13 : MongoDB 8 et plus y plante au démarrage, ou refuse de démarrer (SERVER-121912).
kernel_in_mongo_risk() {
  local major minor patch
  IFS=. read -r major minor patch <<<"${1%%-*}"
  [[ $major =~ ^[0-9]+$ && $minor =~ ^[0-9]+$ ]] || return 1
  if [[ ${patch:-0} =~ ^[0-9]+ ]]; then patch=${BASH_REMATCH[0]}; else patch=0; fi
  local n=$((major * 1000000 + minor * 1000 + patch))
  ((n >= 6019000 && n <= 7000013))
}

# Le réglage de la mémoire n'est pas au même endroit sous macOS et sous Windows avec WSL2.
memory_advice() {
  printf '%s' "macOS : Docker Desktop → Réglages → Resources → Memory, 4 Go ou plus ; Windows (WSL2) : dans %UserProfile%\\.wslconfig, section [wsl2], memory=4GB, puis wsl --shutdown et relance Docker Desktop"
}

cmd_doctor() {
  info "Vérification du poste"
  if ! docker info >/dev/null 2>&1; then
    doctor_line ko "Docker répond" "lance Docker Desktop (ou le service docker), puis relance scripts/db doctor"
    return 1
  fi
  doctor_line ok "Docker répond"
  load_env

  local mem_bytes mem_mib
  mem_bytes="$(docker info --format '{{.MemTotal}}' 2>/dev/null)"
  if [[ $mem_bytes =~ ^[0-9]+$ ]]; then
    mem_mib=$((mem_bytes / 1024 / 1024))
    # Docker Desktop réglé sur 4 Go en annonce environ 3,8 Gio : le seuil est à 3,5 Gio, le conseil reste 4 Go.
    if ((mem_mib >= 3584)); then doctor_line ok "mémoire de Docker : $((mem_mib / 1024)),$((mem_mib % 1024 * 10 / 1024)) Gio"; else
      doctor_line ko "mémoire de Docker : $((mem_mib / 1024)),$((mem_mib % 1024 * 10 / 1024)) Gio (4 Go conseillés)" "$(memory_advice)"
    fi
  else
    doctor_line ko "mémoire de Docker illisible" "relance Docker Desktop, puis scripts/db doctor"
  fi

  # Le devcontainer tourne sur la même machine virtuelle et le même disque que les bases : on les lit d'ici.
  local free_kib
  free_kib="$(df -Pk / 2>/dev/null | awk 'NR == 2 { print $4 }')"
  if [[ $free_kib =~ ^[0-9]+$ ]]; then
    if ((free_kib / 1024 / 1024 >= 10)); then doctor_line ok "disque libre pour Docker : $((free_kib / 1024 / 1024)) Go"; else
      doctor_line ko "disque libre pour Docker : $((free_kib / 1024 / 1024)) Go (10 au moins)" "libère de la place : docker system prune, ou agrandis le disque de Docker Desktop"
    fi
  else
    doctor_line ko "disque libre illisible" "lance scripts/db doctor depuis le terminal du devcontainer"
  fi

  local arch
  arch="$(docker info --format '{{.Architecture}}' 2>/dev/null)"
  if [[ $arch == x86_64 ]]; then
    if grep -qw avx /proc/cpuinfo 2>/dev/null; then doctor_line ok "processeur : AVX disponible (MongoDB 8)"; else
      doctor_line ko "processeur sans AVX : MongoDB 8 ne démarre pas" "travaille sur GitHub Codespaces (docs/AVANT-LE-COURS.md)"
    fi
  else
    doctor_line ok "processeur : ${arch:-inconnu}"
  fi

  local kernel
  kernel="$(docker info --format '{{.KernelVersion}}' 2>/dev/null)"
  if kernel_in_mongo_risk "$kernel"; then
    doctor_line warn "noyau $kernel : MongoDB 8 y est sujet à des plantages au démarrage (SERVER-121912)" \
      "mets Docker Desktop à jour (noyau 7.0.14 ou plus récent) ; en attendant, préviens le formateur"
  else
    doctor_line ok "noyau : ${kernel:-inconnu}"
  fi

  local image
  for image in "$DBA_PG_IMAGE" "$DBA_MONGO_IMAGE"; do
    if docker image inspect "$image" >/dev/null 2>&1; then doctor_line ok "image présente : ${image%@*}"; else
      doctor_line ko "image absente : ${image%@*}" "scripts/db up la télécharge ; à faire avant le cours, sur une bonne connexion"
    fi
  done
  return "$DOCTOR_FAILED"
}
