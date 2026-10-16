#!/usr/bin/env bash
# Sauvegarde logique d'une base du fil rouge : pg_dump au format custom, horodaté, vérifié par pg_restore --list.
# Usage : project/ops/backup.sh [base]   (valmorin par défaut). Affiche le chemin du dump ; code 1 en cas d'échec.
set -euo pipefail
cd "$(dirname "$0")/../.."
base=${1:-valmorin}
# shellcheck source=/dev/null
source infra/.env.lab
export PGPASSWORD=$POSTGRES_PASSWORD
mkdir -p backups
dump="backups/$base-$(date +%Y%m%d-%H%M%S).dump"
if ! pg_dump -h pg -U postgres -Fc -f "$dump" "$base"; then
  rm -f "$dump"
  echo "sauvegarde de $base en échec" >&2
  exit 1
fi
if ! pg_restore --list "$dump" >/dev/null; then
  echo "dump illisible : $dump" >&2
  exit 1
fi
echo "$dump"
